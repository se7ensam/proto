/**
 * Chat Domain Service - Business logic for chat operations
 * Framework-agnostic, testable, deterministic where possible
 */

import { IMessageRepository, IConversationRepository, IPlanningRulesRepository } from '../repositories'
import { Message, ConversationContext, LLMRequest, Conversation } from '../types'
import { NotFoundError, ValidationError } from '../errors'

export interface ILLMService {
  generateResponse(request: LLMRequest): Promise<string>
  generateResponseStream(request: LLMRequest): AsyncGenerator<string, void, unknown>
}

export class ChatService {
  constructor(
    private messageRepo: IMessageRepository,
    private conversationRepo: IConversationRepository,
    private planningRulesRepo: IPlanningRulesRepository,
    private llmService: ILLMService
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
    await this.conversationRepo.getOrCreate(userId, conversationId)

    // Create user message
    const userMessage = await this.messageRepo.create({
      conversationId,
      userId,
      type: 'user',
      content: content.trim(),
    })

    // Get conversation context from Redis cache
    const context = await this.getConversationContext(userId, conversationId)

    // Generate AI response
    const aiContent = await this.llmService.generateResponse({
      userMessage: content,
      context,
    })

    // Create AI message
    const aiMessage = await this.messageRepo.create({
      conversationId,
      userId,
      type: 'ai',
      content: aiContent,
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
    const userMessage = await this.messageRepo.create({
      conversationId: conversation.id, // Use the actual UUID from conversation
      userId,
      type: 'user',
      content: content.trim(),
    })

    yield { type: 'user', message: userMessage }

    // Get conversation context from Redis cache (fast!)
    const context = await this.getConversationContext(userId, conversation.id)

    // Create a placeholder AI message ID
    const aiMessageId = crypto.randomUUID()
    yield { type: 'ai_start', messageId: aiMessageId }

    // Stream AI response
    let fullContent = ''
    for await (const chunk of this.llmService.generateResponseStream({
      userMessage: content,
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
   * Get conversation context for LLM
   */
  private async getConversationContext(userId: string, conversationId: string): Promise<ConversationContext> {
    // Ensure access to conversation
    const conversation = await this.conversationRepo.getOrCreate(userId, conversationId)

    const [messages, planningRules] = await Promise.all([
      this.messageRepo.findByConversationId(conversation.id, 10), // Last 10 messages of THIS chat
      this.planningRulesRepo.getRules(conversation.id),
    ])

    return {
      messages,
      planSections: [], // Plan sections not needed for LLM context
      planningRules,
    }
  }
}
