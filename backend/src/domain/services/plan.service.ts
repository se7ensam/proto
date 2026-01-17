/**
 * Plan Domain Service - Business logic for plan management
 * Framework-agnostic, testable, deterministic
 */

import { IPlanSectionRepository, IMessageRepository, IConversationRepository } from '../repositories'
import { PlanSection, Message } from '../types'
import { NotFoundError, ValidationError } from '../errors'

export class PlanService {
  constructor(
    private planSectionRepo: IPlanSectionRepository,
    private messageRepo: IMessageRepository,
    private conversationRepo: IConversationRepository
  ) {}

  /**
   * Apply an AI message to the plan
   */
  async applyMessageToPlan(
    userId: string,
    conversationId: string,
    messageId: string
  ): Promise<{ planSection: PlanSection; planUpdateMessage: Message }> {
    // Verify conversation belongs to user
    const conversation = await this.conversationRepo.findById(conversationId)
    if (!conversation) {
      throw new NotFoundError('Conversation', conversationId)
    }
    if (conversation.userId !== userId) {
      throw new ValidationError('Conversation does not belong to user')
    }

    // Find the message
    const message = await this.messageRepo.findById(messageId)
    if (!message) {
      throw new NotFoundError('Message', messageId)
    }

    if (message.type !== 'ai') {
      throw new ValidationError('Only AI messages can be applied to plan')
    }

    if (message.conversationId !== conversationId) {
      throw new ValidationError('Message does not belong to this conversation')
    }

    // Create plan section
    const planSection = await this.planSectionRepo.create({
      conversationId,
      userId,
      content: message.content,
      locked: false,
      sourceMessageId: messageId,
    })

    // Create plan update message
    const planUpdateMessage = await this.messageRepo.create({
      conversationId,
      userId,
      type: 'plan_update',
      content: `Applied message ${messageId} to plan`,
    })

    return { planSection, planUpdateMessage }
  }

  /**
   * Get all plan sections for a conversation
   */
  async getPlanSections(userId: string, conversationId: string): Promise<PlanSection[]> {
    // Get or create conversation (handles non-UUID IDs)
    const conversation = await this.conversationRepo.getOrCreate(userId, conversationId)

    return this.planSectionRepo.findByConversationId(conversation.id)
  }

  /**
   * Update a plan section
   */
  async updatePlanSection(
    userId: string,
    conversationId: string,
    sectionId: string,
    updates: { content?: string; locked?: boolean }
  ): Promise<PlanSection> {
    // Verify section exists and belongs to user
    const section = await this.planSectionRepo.findById(sectionId)
    if (!section) {
      throw new NotFoundError('Plan section', sectionId)
    }

    if (section.userId !== userId) {
      throw new ValidationError('Plan section does not belong to user')
    }

    if (section.conversationId !== conversationId) {
      throw new ValidationError('Plan section does not belong to this conversation')
    }

    // Update section
    const updated = await this.planSectionRepo.update(sectionId, updates)
    if (!updated) {
      throw new NotFoundError('Plan section', sectionId)
    }

    return updated
  }

  /**
   * Lock or unlock a plan section
   */
  async toggleSectionLock(
    userId: string,
    conversationId: string,
    sectionId: string,
    locked: boolean
  ): Promise<PlanSection> {
    return this.updatePlanSection(userId, conversationId, sectionId, { locked })
  }

  /**
   * Delete a plan section
   */
  async deletePlanSection(userId: string, conversationId: string, sectionId: string): Promise<void> {
    // Verify section exists and belongs to user
    const section = await this.planSectionRepo.findById(sectionId)
    if (!section) {
      throw new NotFoundError('Plan section', sectionId)
    }

    if (section.userId !== userId) {
      throw new ValidationError('Plan section does not belong to user')
    }

    if (section.conversationId !== conversationId) {
      throw new ValidationError('Plan section does not belong to this conversation')
    }

    await this.planSectionRepo.delete(sectionId)
  }
}
