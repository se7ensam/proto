import { ConversationContext, Message, PlanSection } from '../types'

// In-memory storage (replace with database in production)
const conversations = new Map<string, ConversationContext>()

export class ContextService {
  private getOrCreateConversation(conversationId: string): ConversationContext {
    if (!conversations.has(conversationId)) {
      conversations.set(conversationId, {
        messages: [],
        planSections: [],
        planningRules: [],
      })
    }
    return conversations.get(conversationId)!
  }

  getConversation(conversationId: string): ConversationContext | null {
    return conversations.get(conversationId) || null
  }

  addMessage(conversationId: string, message: Message): void {
    const context = this.getOrCreateConversation(conversationId)
    context.messages.push(message)
  }

  getMessages(conversationId: string): Message[] {
    const context = this.getOrCreateConversation(conversationId)
    return context.messages
  }

  addPlanSection(conversationId: string, section: PlanSection): void {
    const context = this.getOrCreateConversation(conversationId)
    context.planSections.push(section)
  }

  getPlanSections(conversationId: string): PlanSection[] {
    const context = this.getOrCreateConversation(conversationId)
    return context.planSections
  }

  updatePlanSection(
    conversationId: string,
    sectionId: string,
    updates: Partial<PlanSection>
  ): boolean {
    const context = this.getOrCreateConversation(conversationId)
    const section = context.planSections.find((s) => s.id === sectionId)
    if (section) {
      Object.assign(section, updates)
      return true
    }
    return false
  }

  setPlanningRules(conversationId: string, rules: string[]): void {
    const context = this.getOrCreateConversation(conversationId)
    context.planningRules = rules
  }

  getPlanningRules(conversationId: string): string[] {
    const context = this.getOrCreateConversation(conversationId)
    return context.planningRules || []
  }
}

export const contextService = new ContextService()
