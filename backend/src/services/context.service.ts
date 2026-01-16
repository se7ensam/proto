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
  constructor(private client: Redis) {}

  private getKey(conversationId: string): string {
    return `conversation:${conversationId}`
  }

  private async updateConversation(
    conversationId: string,
    updater: (context: ConversationContext) => ConversationContext
  ): Promise<ConversationContext> {
    const key = this.getKey(conversationId)
    const maxRetries = 3

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      await this.client.watch(key)
      const data = await this.client.get(key)
      const context: ConversationContext = data
        ? JSON.parse(data)
        : { messages: [], planSections: [], planningRules: [] }

      const updated = updater(context)
      const multi = this.client.multi()
      multi.set(key, JSON.stringify(updated))
      const result = await multi.exec()

      if (result) {
        return updated
      }

      await this.client.unwatch()
    }

    throw new Error('Failed to update conversation due to concurrent updates')
  }

  private async getOrCreateConversation(conversationId: string): Promise<ConversationContext> {
    const key = this.getKey(conversationId)
    const data = await this.client.get(key)

    if (data) {
      return JSON.parse(data)
    }

    const newContext: ConversationContext = {
      messages: [],
      planSections: [],
      planningRules: [],
    }

    // Store initial empty context
    await this.client.set(key, JSON.stringify(newContext))
    return newContext
  }

  async getConversation(conversationId: string): Promise<ConversationContext | null> {
    const key = this.getKey(conversationId)
    const data = await this.client.get(key)
    return data ? JSON.parse(data) : null
  }

  async addMessage(conversationId: string, message: Message): Promise<void> {
    await this.updateConversation(conversationId, (context) => {
      context.messages.push(message)
      return context
    })
  }

  async addMessageAndGetContext(
    conversationId: string,
    message: Message
  ): Promise<ConversationContext> {
    return this.updateConversation(conversationId, (context) => {
      context.messages.push(message)
      return context
    })
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const context = await this.getOrCreateConversation(conversationId)
    return context.messages
  }

  async addPlanSection(conversationId: string, section: PlanSection): Promise<void> {
    await this.updateConversation(conversationId, (context) => {
      context.planSections.push(section)
      return context
    })
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
    let updated = false

    await this.updateConversation(conversationId, (context) => {
      const section = context.planSections.find((s) => s.id === sectionId)
      if (section) {
        Object.assign(section, updates)
        updated = true
      }
      return context
    })

    return updated
  }

  async setPlanningRules(conversationId: string, rules: string[]): Promise<void> {
    await this.updateConversation(conversationId, (context) => {
      context.planningRules = rules
      return context
    })
  }

  async getPlanningRules(conversationId: string): Promise<string[]> {
    const context = await this.getOrCreateConversation(conversationId)
    return context.planningRules || []
  }

  async updateMessage(conversationId: string, messageId: string, updates: Partial<Message>): Promise<Message | null> {
    let updatedMessage: Message | null = null

    await this.updateConversation(conversationId, (context) => {
      const message = context.messages.find((m) => m.id === messageId)
      if (message) {
        Object.assign(message, updates)
        updatedMessage = message
      }
      return context
    })

    return updatedMessage
  }
}

export const contextService = new ContextService(redis)
