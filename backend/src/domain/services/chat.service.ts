/**
 * Chat Domain Service - Business logic for chat operations
 * Framework-agnostic, testable, deterministic where possible
 */

import {
  IMessageRepository,
  IConversationRepository,
  IPlanningRulesRepository,
  IPlanSectionRepository,
  IUserRepository,
} from '../repositories'
import { Message, ConversationContext, LLMRequest, Conversation } from '../types'
import { NotFoundError, ValidationError } from '../errors'
import { parsePlanPayload, renderPlanPayloadForUser } from './plan-json'

export interface ILLMService {
  generateResponse(request: LLMRequest): Promise<string>
  generateResponseStream(request: LLMRequest): AsyncGenerator<string, void, unknown>
  generateConversationTitle(seedMessage: string): Promise<string>
}

export class ChatService {
  constructor(
    private messageRepo: IMessageRepository,
    private conversationRepo: IConversationRepository,
    private planningRulesRepo: IPlanningRulesRepository,
    private planSectionRepo: IPlanSectionRepository,
    private llmService: ILLMService,
    private userRepo?: IUserRepository
  ) {}

  /**
   * Send a message and get AI response
   */
  async sendMessage(
    userId: string,
    conversationId: string,
    content: string
  ): Promise<{ userMessage: Message; aiMessage: Message }> {
    // Validate input
    if (!content.trim()) {
      throw new ValidationError('Message content cannot be empty')
    }

    // Ensure conversation exists
    const conversation = await this.conversationRepo.getOrCreate(userId, conversationId)
    const trimmedContent = content.trim()

    await this.ensureAutoConversationTitle(conversation, trimmedContent)

    // Create user message
    const userMessage = await this.messageRepo.create({
      conversationId: conversation.id,
      userId,
      type: 'user',
      content: trimmedContent,
    })

    // Get conversation context from Redis cache
    const context = await this.getConversationContext(userId, conversation.id)

    // Generate AI response
    const aiRawContent = await this.llmService.generateResponse({
      userMessage: trimmedContent,
      context,
    })
    const normalized = this.normalizeAiResponse(aiRawContent)

    // Create AI message
    const aiMessage = await this.messageRepo.create({
      conversationId: conversation.id,
      userId,
      type: 'ai',
      content: normalized.content,
      metadata: normalized.metadata,
    })

    return { userMessage, aiMessage }
  }

  /**
   * Send a message and stream AI response
   */
  async *sendMessageStream(
    userId: string,
    conversationId: string,
    content: string
  ): AsyncGenerator<
    | { type: 'user'; message: Message }
    | { type: 'ai_start'; messageId: string }
    | { type: 'chunk'; content: string }
    | { type: 'done'; message: Message },
    void,
    unknown
  > {
    // Validate input
    if (!content.trim()) {
      throw new ValidationError('Message content cannot be empty')
    }

    // Ensure conversation exists and get the actual conversation ID (UUID)
    const conversation = await this.conversationRepo.getOrCreate(userId, conversationId)

    // Create user message with the actual conversation UUID
    const trimmedContent = content.trim()
    await this.ensureAutoConversationTitle(conversation, trimmedContent)

    const userMessage = await this.messageRepo.create({
      conversationId: conversation.id, // Use the actual UUID from conversation
      userId,
      type: 'user',
      content: trimmedContent,
    })

    yield { type: 'user', message: userMessage }

    // Get conversation context from Redis cache (fast!)
    const context = await this.getConversationContext(userId, conversation.id)

    // Create a placeholder AI message ID
    const aiMessageId = crypto.randomUUID()
    yield { type: 'ai_start', messageId: aiMessageId }

    const shouldUseStructuredMode = this.shouldGenerateStructuredPlan(content)

    // For structured planning prompts, avoid streaming raw JSON to clients.
    if (shouldUseStructuredMode) {
      const aiRawContent = await this.llmService.generateResponse({
        userMessage: trimmedContent,
        context,
      })
      const normalized = this.normalizeAiResponse(aiRawContent)

      yield { type: 'chunk', content: normalized.content }

      const aiMessage = await this.messageRepo.create({
        id: aiMessageId,
        conversationId: conversation.id,
        userId,
        type: 'ai',
        content: normalized.content,
        metadata: normalized.metadata,
      })

      yield { type: 'done', message: aiMessage }
      return
    }

    // Stream AI response
    let fullContent = ''
    for await (const chunk of this.llmService.generateResponseStream({
      userMessage: trimmedContent,
      context,
    })) {
      fullContent += chunk
      yield { type: 'chunk', content: chunk }
    }

    // Create AI message with full content using the same ID and conversation UUID
    const aiMessage = await this.messageRepo.create({
      id: aiMessageId,
      conversationId: conversation.id, // Use the actual UUID from conversation
      userId,
      type: 'ai',
      content: fullContent,
    })

    yield { type: 'done', message: aiMessage }
  }

  /**
   * Regenerate an AI message
   */
  async regenerateMessage(userId: string, conversationId: string, messageId: string): Promise<Message> {
    // Find the message
    const message = await this.messageRepo.findById(messageId)
    if (!message) {
      throw new NotFoundError('Message', messageId)
    }

    if (message.type !== 'ai') {
      throw new ValidationError('Only AI messages can be regenerated')
    }

    if (message.conversationId !== conversationId) {
      throw new ValidationError('Message does not belong to this conversation')
    }

    // Get all messages to find the preceding user message
    const messages = await this.messageRepo.findByConversationId(conversationId)
    const messageIndex = messages.findIndex((m) => m.id === messageId)

    if (messageIndex <= 0) {
      throw new ValidationError('Cannot regenerate: no preceding user message found')
    }

    const userMessage = messages[messageIndex - 1]
    if (userMessage.type !== 'user') {
      throw new ValidationError('Cannot regenerate: preceding message is not a user message')
    }

    // Get conversation context from Redis cache
    const context = await this.getConversationContext(userId, conversationId)

    // Generate new response
    const newContent = await this.llmService.generateResponse({
      userMessage: userMessage.content,
      context,
    })

    // Update the message
    const updated = await this.messageRepo.update(messageId, {
      content: newContent,
      timestamp: new Date(),
    })

    if (!updated) {
      throw new NotFoundError('Message', messageId)
    }

    return updated
  }

  /**
   * Get all conversations for a user
   */
  async getConversations(userId: string): Promise<Conversation[]> {
    return this.conversationRepo.findByUserId(userId)
  }

  /**
   * Get conversation summaries with emptiness info
   */
  async getConversationSummaries(
    userId: string
  ): Promise<Array<Conversation & { isEmpty: boolean; deletedAt?: string; title: string }>> {
    const conversations = await this.conversationRepo.findByUserId(userId)
    return this.buildConversationSummaries(conversations)
  }

  /**
   * Get deleted conversation summaries for recycle bin
   */
  async getDeletedConversationSummaries(
    userId: string
  ): Promise<Array<Conversation & { isEmpty: boolean; deletedAt?: string; title: string }>> {
    const conversations = await this.conversationRepo.findDeletedByUserId(userId)
    return this.buildConversationSummaries(conversations)
  }

  /**
   * Create a new conversation for a user
   */
  async createConversation(userId: string): Promise<Conversation> {
    return this.conversationRepo.create({
      userId,
      metadata: {
        title: 'New chat',
        titleEdited: false,
      },
    })
  }

  /**
   * Rename a conversation
   */
  async updateConversationTitle(userId: string, conversationId: string, title: string): Promise<Conversation> {
    const normalizedTitle = title.trim().replace(/\s+/g, ' ')
    if (!normalizedTitle) {
      throw new ValidationError('Conversation title cannot be empty')
    }

    const conversation = await this.assertConversationOwner(userId, conversationId)
    const metadata = this.asRecord(conversation.metadata)

    const updated = await this.conversationRepo.update(conversation.id, {
      metadata: {
        ...metadata,
        title: normalizedTitle,
        titleEdited: true,
      },
    })

    if (!updated) {
      throw new NotFoundError('Conversation', conversation.id)
    }

    return updated
  }

  /**
   * Soft delete conversation and clear plan sections
   */
  async deleteConversation(userId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.assertConversationOwner(userId, conversationId)

    await this.planSectionRepo.deleteByConversationId(conversation.id)
    const deleted = await this.conversationRepo.softDelete(conversation.id)
    if (!deleted) {
      throw new NotFoundError('Conversation', conversation.id)
    }

    return deleted
  }

  /**
   * Restore conversation from recycle bin
   */
  async restoreConversation(userId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.assertConversationOwner(userId, conversationId)
    const restored = await this.conversationRepo.restore(conversation.id)
    if (!restored) {
      throw new NotFoundError('Conversation', conversation.id)
    }

    return restored
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(userId: string, conversationId: string): Promise<Message[]> {
    // Ensure the user actually has access to this conversation
    const conversation = await this.conversationRepo.getOrCreate(userId, conversationId)
    
    // Fetch messages specifically for ONLY this conversation
    return this.messageRepo.findByConversationId(conversation.id, 100)
  }

  /**
   * Add a member to a conversation
   */
  async addMember(userId: string, conversationId: string, memberId: string): Promise<void> {
    const conversation = await this.conversationRepo.getOrCreate(userId, conversationId)
    if (conversation.userId !== userId) {
      throw new ValidationError('Only the host can add members')
    }

    await this.conversationRepo.addMember(conversation.id, memberId, 'member')
  }

  /**
   * Remove a member from a conversation
   */
  async removeMember(userId: string, conversationId: string, memberId: string): Promise<void> {
    const conversation = await this.conversationRepo.getOrCreate(userId, conversationId)
    if (conversation.userId !== userId) {
      throw new ValidationError('Only the host can remove members')
    }

    const removed = await this.conversationRepo.removeMember(conversation.id, memberId)
    if (!removed) {
      throw new NotFoundError('Member', memberId)
    }
  }

  /**
   * Get member list with emails for a conversation.
   */
  async getConversationMembers(
    userId: string,
    conversationId: string
  ): Promise<Array<{ userId: string; email: string; role: 'host' | 'member' }>> {
    const conversation = await this.conversationRepo.getOrCreate(userId, conversationId)
    const members = await this.conversationRepo.getMembers(conversation.id)

    const memberRows: Array<{ userId: string; role: 'host' | 'member' }> = [
      { userId: conversation.userId, role: 'host' },
      ...members.map((member) => ({ userId: member.userId, role: 'member' as const })),
    ]

    const deduped = Array.from(new Map(memberRows.map((row) => [row.userId, row])).values())

    if (!this.userRepo) {
      return deduped.map((row) => ({
        userId: row.userId,
        email: '',
        role: row.role,
      }))
    }

    const hydrated = await Promise.all(
      deduped.map(async (row) => {
        const user = await this.userRepo!.findById(row.userId)
        return {
          userId: row.userId,
          email: user?.email ?? '',
          role: row.role,
        }
      })
    )

    return hydrated.filter((row) => row.email)
  }

  /**
   * Get conversation context for LLM
   */
  private async getConversationContext(userId: string, conversationId: string): Promise<ConversationContext> {
    // Ensure access to conversation
    const conversation = await this.conversationRepo.getOrCreate(userId, conversationId)

    const [messages, planningRules, planSections] = await Promise.all([
      this.messageRepo.findByConversationId(conversation.id, 10), // Last 10 messages of THIS chat
      this.planningRulesRepo.getRules(conversation.id),
      this.planSectionRepo.findByConversationId(conversation.id),
    ])

    const metadata = conversation.metadata as Record<string, unknown> | undefined
    const planRevision =
      typeof metadata?.planRev === 'number' && Number.isInteger(metadata.planRev) && metadata.planRev >= 0
        ? metadata.planRev
        : 0

    return {
      messages,
      planSections,
      planningRules,
      planRevision,
    }
  }

  private shouldGenerateStructuredPlan(userMessage: string): boolean {
    return /\b(plan|phase|roadmap|milestone|timeline|update\s+plan|revise\s+plan)\b/i.test(userMessage)
  }

  private normalizeAiResponse(content: string): { content: string; metadata?: Record<string, unknown> } {
    const payload = parsePlanPayload(content)
    if (!payload) {
      return { content }
    }

    return {
      content: renderPlanPayloadForUser(payload),
      metadata: {
        responseFormat: 'plan_json',
        planPayload: payload,
      },
    }
  }

  private async buildConversationSummaries(
    conversations: Conversation[]
  ): Promise<Array<Conversation & { isEmpty: boolean; deletedAt?: string; title: string }>> {
    return Promise.all(
      conversations.map(async (conversation) => {
        const [messages, planSections] = await Promise.all([
          this.messageRepo.findByConversationId(conversation.id, 1),
          this.planSectionRepo.findByConversationId(conversation.id),
        ])

        const metadata = conversation.metadata as Record<string, unknown> | undefined
        const deletedAt = typeof metadata?.deletedAt === 'string' ? metadata.deletedAt : undefined
        const storedTitle = typeof metadata?.title === 'string' ? metadata.title : undefined
        const titleEdited = metadata?.titleEdited === true
        const generatedTitle = messages.length > 0 ? this.generateConversationTitleFromMessage(messages[0].content) : undefined

        return {
          ...conversation,
          isEmpty: messages.length === 0 && planSections.length === 0,
          deletedAt,
          title: this.resolveConversationTitle(storedTitle, titleEdited, generatedTitle),
        }
      })
    )
  }

  private async assertConversationOwner(userId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findById(conversationId)
    if (!conversation) {
      throw new NotFoundError('Conversation', conversationId)
    }

    if (conversation.userId !== userId) {
      throw new ValidationError('Only the host can modify this conversation')
    }

    return conversation
  }

  private async ensureAutoConversationTitle(conversation: Conversation, userMessage: string): Promise<void> {
    const metadata = this.asRecord(conversation.metadata)
    const rawTitle = typeof metadata.title === 'string' ? metadata.title.trim() : ''
    const hasTitle = rawTitle.length > 0
    const titleEdited = metadata.titleEdited === true
    const isPlaceholderTitle = !hasTitle || rawTitle.toLowerCase() === 'new chat'

    if (titleEdited || !isPlaceholderTitle) {
      return
    }

    const title = await this.generateConversationTitleWithFallback(userMessage)
    await this.conversationRepo.update(conversation.id, {
      metadata: {
        ...metadata,
        title,
        titleEdited: false,
      },
    })
  }

  private generateConversationTitleFromMessage(content: string): string {
    const normalized = content.replace(/\s+/g, ' ').trim()
    if (!normalized) {
      return 'New chat'
    }

    const words = normalized.split(' ')
    const clipped = words.slice(0, 7).join(' ')
    return clipped.length > 60 ? `${clipped.slice(0, 57)}...` : clipped
  }

  private async generateConversationTitleWithFallback(userMessage: string): Promise<string> {
    try {
      const aiTitle = await this.llmService.generateConversationTitle(userMessage)
      const normalized = this.normalizeConversationTitle(aiTitle)
      if (normalized) {
        return normalized
      }
    } catch {
      // Fall back to deterministic local generation below.
    }

    return this.generateConversationTitleFromMessage(userMessage)
  }

  private normalizeConversationTitle(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null
    }

    const withoutPrefix = value.replace(/^title\s*:\s*/i, '')
    const withoutQuotes = withoutPrefix.replace(/^["'`]+|["'`]+$/g, '')
    const normalized = withoutQuotes.replace(/\s+/g, ' ').trim()

    if (!normalized) {
      return null
    }

    const words = normalized.split(' ')
    const clippedWords = words.slice(0, 7).join(' ')
    return clippedWords.length > 60 ? `${clippedWords.slice(0, 57)}...` : clippedWords
  }

  private resolveConversationTitle(
    storedTitle: string | undefined,
    titleEdited: boolean,
    generatedTitle: string | undefined
  ): string {
    const normalizedStoredTitle = storedTitle?.trim()
    const hasStoredTitle = Boolean(normalizedStoredTitle)
    const isPlaceholder = normalizedStoredTitle?.toLowerCase() === 'new chat'

    if (hasStoredTitle && (!isPlaceholder || titleEdited)) {
      return normalizedStoredTitle!
    }

    return generatedTitle || normalizedStoredTitle || 'New chat'
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { ...(value as Record<string, unknown>) }
    }

    return {}
  }
}
