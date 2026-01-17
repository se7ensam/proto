/**
 * Plan Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PlanService } from '../src/domain/services/plan.service'
import {
  createMockPlanSectionRepository,
  createMockMessageRepository,
  createMockConversationRepository,
  createTestPlanSection,
  createTestMessage,
  createTestConversation,
} from './helpers'
import { ValidationError, NotFoundError } from '../src/domain/errors'

describe('PlanService', () => {
  let planService: PlanService
  let mockPlanSectionRepo: ReturnType<typeof createMockPlanSectionRepository>
  let mockMessageRepo: ReturnType<typeof createMockMessageRepository>
  let mockConversationRepo: ReturnType<typeof createMockConversationRepository>

  beforeEach(() => {
    mockPlanSectionRepo = createMockPlanSectionRepository()
    mockMessageRepo = createMockMessageRepository()
    mockConversationRepo = createMockConversationRepository()

    planService = new PlanService(mockPlanSectionRepo, mockMessageRepo, mockConversationRepo)
  })

  describe('applyMessageToPlan', () => {
    it('should apply AI message to plan', async () => {
      const userId = 'user-1'
      const conversationId = 'conv-1'
      const messageId = 'msg-1'

      const conversation = createTestConversation({ id: conversationId, userId })
      const aiMessage = createTestMessage({ id: messageId, type: 'ai', content: 'AI suggestion' })
      const planSection = createTestPlanSection({ content: 'AI suggestion' })
      const planUpdateMessage = createTestMessage({ type: 'plan_update' })

      vi.mocked(mockConversationRepo.findById).mockResolvedValue(conversation)
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(aiMessage)
      vi.mocked(mockPlanSectionRepo.create).mockResolvedValue(planSection)
      vi.mocked(mockMessageRepo.create).mockResolvedValue(planUpdateMessage)

      const result = await planService.applyMessageToPlan(userId, conversationId, messageId)

      expect(result.planSection).toEqual(planSection)
      expect(result.planUpdateMessage).toEqual(planUpdateMessage)
    })

    it('should throw NotFoundError for non-existent conversation', async () => {
      vi.mocked(mockConversationRepo.findById).mockResolvedValue(null)

      await expect(
        planService.applyMessageToPlan('user-1', 'conv-1', 'msg-1')
      ).rejects.toThrow(NotFoundError)
    })

    it('should throw ValidationError for conversation not belonging to user', async () => {
      const conversation = createTestConversation({ userId: 'other-user' })
      vi.mocked(mockConversationRepo.findById).mockResolvedValue(conversation)

      await expect(
        planService.applyMessageToPlan('user-1', 'conv-1', 'msg-1')
      ).rejects.toThrow(ValidationError)
    })

    it('should throw ValidationError for non-AI message', async () => {
      const conversation = createTestConversation()
      const userMessage = createTestMessage({ type: 'user' })

      vi.mocked(mockConversationRepo.findById).mockResolvedValue(conversation)
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(userMessage)

      await expect(
        planService.applyMessageToPlan('user-1', 'conv-1', 'msg-1')
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('getPlanSections', () => {
    it('should return plan sections for conversation', async () => {
      const userId = 'user-1'
      const conversationId = 'conv-1'
      const sections = [
        createTestPlanSection({ id: 'section-1' }),
        createTestPlanSection({ id: 'section-2' }),
      ]

      const conversation = createTestConversation({ id: conversationId, userId })
      vi.mocked(mockConversationRepo.getOrCreate).mockResolvedValue(conversation)
      vi.mocked(mockPlanSectionRepo.findByConversationId).mockResolvedValue(sections)

      const result = await planService.getPlanSections(userId, conversationId)

      expect(result).toEqual(sections)
    })
  })

  describe('updatePlanSection', () => {
    it('should update plan section', async () => {
      const userId = 'user-1'
      const conversationId = 'conv-1'
      const sectionId = 'section-1'
      const updates = { content: 'Updated content' }

      const section = createTestPlanSection({ id: sectionId, userId, conversationId })
      const updatedSection = createTestPlanSection({ ...section, ...updates })

      vi.mocked(mockPlanSectionRepo.findById).mockResolvedValue(section)
      vi.mocked(mockPlanSectionRepo.update).mockResolvedValue(updatedSection)

      const result = await planService.updatePlanSection(userId, conversationId, sectionId, updates)

      expect(result).toEqual(updatedSection)
    })

    it('should throw NotFoundError for non-existent section', async () => {
      vi.mocked(mockPlanSectionRepo.findById).mockResolvedValue(null)

      await expect(
        planService.updatePlanSection('user-1', 'conv-1', 'section-1', {})
      ).rejects.toThrow(NotFoundError)
    })

    it('should throw ValidationError for section not belonging to user', async () => {
      const section = createTestPlanSection({ userId: 'other-user' })
      vi.mocked(mockPlanSectionRepo.findById).mockResolvedValue(section)

      await expect(
        planService.updatePlanSection('user-1', 'conv-1', 'section-1', {})
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('toggleSectionLock', () => {
    it('should lock a section', async () => {
      const userId = 'user-1'
      const conversationId = 'conv-1'
      const sectionId = 'section-1'

      const section = createTestPlanSection({ id: sectionId, userId, conversationId, locked: false })
      const lockedSection = createTestPlanSection({ ...section, locked: true })

      vi.mocked(mockPlanSectionRepo.findById).mockResolvedValue(section)
      vi.mocked(mockPlanSectionRepo.update).mockResolvedValue(lockedSection)

      const result = await planService.toggleSectionLock(userId, conversationId, sectionId, true)

      expect(result.locked).toBe(true)
    })
  })
})
