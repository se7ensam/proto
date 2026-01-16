import Redis from 'ioredis'
import { ConversationContext, Message, PlanSection } from '../types'

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

redis.on('error', (err) => {
  console.error('[Redis] Error:', err)
})

redis.on('connect', () => {
  console.log('[Redis] Connected')
})

export class ContextService {
  private async getOrCreateConversation(conversationId: string): Promise<ConversationContext> {
    const key = `conversation:${conversationId}`
    const data = await redis.get(key)

    if (data) {
      return JSON.parse(data)
    }

    const newContext: ConversationContext = {
      messages: [],
      planSections: [],
      planningRules: [],
    }

    // Store initial empty context
    await redis.set(key, JSON.stringify(newContext))
    return newContext
  }

  private async saveConversation(conversationId: string, context: ConversationContext): Promise<void> {
    const key = `conversation:${conversationId}`
    await redis.set(key, JSON.stringify(context))
  }

  async getConversation(conversationId: string): Promise<ConversationContext | null> {
    const key = `conversation:${conversationId}`
    const data = await redis.get(key)
    return data ? JSON.parse(data) : null
  }

  async addMessage(conversationId: string, message: Message): Promise<void> {
    const context = await this.getOrCreateConversation(conversationId)
    context.messages.push(message)
    await this.saveConversation(conversationId, context)
  }

  async addMessageAndGetContext(
    conversationId: string,
    message: Message
  ): Promise<ConversationContext> {
    const context = await this.getOrCreateConversation(conversationId)
    context.messages.push(message)
    await this.saveConversation(conversationId, context)
    return context
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const context = await this.getOrCreateConversation(conversationId)
    return context.messages
  }

  async addPlanSection(conversationId: string, section: PlanSection): Promise<void> {
    const context = await this.getOrCreateConversation(conversationId)
    context.planSections.push(section)
    await this.saveConversation(conversationId, context)
  }

  async getPlanSections(conversationId: string): Promise<PlanSection[]> {
    const context = await this.getOrCreateConversation(conversationId)
    return context.planSections
  }

  async updatePlanSection(
    conversationId: string,
    sectionId: string,
    updates: Partial<PlanSection>
  ): Promise<boolean> {
    const context = await this.getOrCreateConversation(conversationId)
    const section = context.planSections.find((s) => s.id === sectionId)

    if (section) {
      Object.assign(section, updates)
      await this.saveConversation(conversationId, context)
      return true
    }
    return false
  }

  async setPlanningRules(conversationId: string, rules: string[]): Promise<void> {
    const context = await this.getOrCreateConversation(conversationId)
    context.planningRules = rules
    await this.saveConversation(conversationId, context)
  }

  async getPlanningRules(conversationId: string): Promise<string[]> {
    const context = await this.getOrCreateConversation(conversationId)
    return context.planningRules || []
  }

  async updateMessage(conversationId: string, messageId: string, updates: Partial<Message>): Promise<Message | null> {
    const context = await this.getOrCreateConversation(conversationId)
    const message = context.messages.find((m) => m.id === messageId)

    if (message) {
      Object.assign(message, updates)
      await this.saveConversation(conversationId, context)
      return message
    }
    return null
  }
}

export const contextService = new ContextService()
