/**
 * Chat Domain Service - Business logic for chat operations
 * Framework-agnostic, testable, deterministic where possible
 */

import { IMessageRepository, IConversationRepository, IPlanningRulesRepository } from '../repositories'
import { Message, ConversationContext, LLMRequest } from '../types'
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
   * Get conversation history
   * Uses userId to leverage Redis cache for fast access
   */
  async getConversationHistory(userId: string, conversationId: string): Promise<Message[]> {
    // Use findByUserId to leverage Redis cache (much faster!)
    // This returns ALL user messages, which is what we want for context
    return this.messageRepo.findByUserId(userId, 100)
  }

  /**
   * Get conversation context for LLM
   * Uses userId to leverage Redis caching
   */
  private async getConversationContext(userId: string, conversationId: string): Promise<ConversationContext> {
    const [messages, planningRules] = await Promise.all([
      this.messageRepo.findByUserId(userId, 10), // Last 10 messages from Redis cache!
      this.planningRulesRepo.getRules(conversationId),
    ])

    return {
      messages,
      planSections: [], // Plan sections not needed for LLM context
      planningRules,
    }
  }
}
