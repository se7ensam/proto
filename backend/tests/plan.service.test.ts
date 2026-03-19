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
    it('applies plain AI text as legacy plan section', async () => {
      const userId = 'user-1'
      const messageId = 'msg-1'

      const conversation = createTestConversation({ id: 'conv-1', userId })
      const aiMessage = createTestMessage({
        id: messageId,
        conversationId: conversation.id,
        type: 'ai',
        content: 'AI suggestion',
      })
      const planSection = createTestPlanSection({ content: 'AI suggestion' })
      const planUpdateMessage = createTestMessage({ type: 'plan_update' })

      vi.mocked(mockMessageRepo.findById).mockResolvedValue(aiMessage)
      vi.mocked(mockConversationRepo.getOrCreate).mockResolvedValue(conversation)
      vi.mocked(mockPlanSectionRepo.create).mockResolvedValue(planSection)
      vi.mocked(mockMessageRepo.create).mockResolvedValue(planUpdateMessage)

      const result = await planService.applyMessageToPlan(userId, conversation.id, messageId)

      expect(result.planSection).toEqual(planSection)
      expect(result.planSections).toEqual([planSection])
      expect(result.appliedMode).toBe('text')
      expect(result.planUpdateMessage).toEqual(planUpdateMessage)
    })

    it('applies structured full plan JSON by creating phase sections', async () => {
      const userId = 'user-1'
      const messageId = 'msg-2'
      const conversation = createTestConversation({
        id: 'conv-1',
        userId,
        metadata: { planRev: 0 },
      })

      const aiMessage = createTestMessage({
        id: messageId,
        conversationId: conversation.id,
        type: 'ai',
        content: JSON.stringify({
          v: 1,
          rev: 1,
          ph: [
            {
              id: 'p1',
              n: 'Research',
              o: 1,
              st: 'ip',
              sum: 'Audit architecture',
              it: [{ id: 't1', c: 'Map API dependencies', st: 'td' }],
            },
            {
              id: 'p2',
              n: 'Build',
              o: 2,
              st: 'td',
              sum: 'Implement service changes',
              it: [{ id: 't2', c: 'Add JSON parser', st: 'td' }],
            },
          ],
        }),
      })

      const section1 = createTestPlanSection({ id: 's1', phaseId: 'p1' })
      const section2 = createTestPlanSection({ id: 's2', phaseId: 'p2' })
      const updateMsg = createTestMessage({ type: 'plan_update' })

      vi.mocked(mockMessageRepo.findById).mockResolvedValue(aiMessage)
      vi.mocked(mockConversationRepo.getOrCreate).mockResolvedValue(conversation)
      vi.mocked(mockPlanSectionRepo.findByConversationId).mockResolvedValue([])
      vi.mocked(mockPlanSectionRepo.create)
        .mockResolvedValueOnce(section1)
        .mockResolvedValueOnce(section2)
      vi.mocked(mockConversationRepo.update).mockResolvedValue(conversation)
      vi.mocked(mockMessageRepo.create).mockResolvedValue(updateMsg)

      const result = await planService.applyMessageToPlan(userId, conversation.id, messageId)

      expect(result.appliedMode).toBe('plan_doc')
      expect(result.planRevision).toBe(1)
      expect(result.planSections).toHaveLength(2)
      expect(mockPlanSectionRepo.create).toHaveBeenCalledTimes(2)
      expect(mockConversationRepo.update).toHaveBeenCalledWith(conversation.id, {
        metadata: { planRev: 1, planVersion: 1 },
      })
    })

    it('applies phase_replace JSON by updating only one phase', async () => {
      const userId = 'user-1'
      const messageId = 'msg-3'
      const conversation = createTestConversation({
        id: 'conv-1',
        userId,
        metadata: { planRev: 1 },
      })

      const aiMessage = createTestMessage({
        id: messageId,
        conversationId: conversation.id,
        type: 'ai',
        content: JSON.stringify({
          v: 1,
          rev: 2,
          op: 'phase_replace',
          pid: 'p1',
          ph: {
            id: 'p1',
            n: 'Research',
            o: 1,
            st: 'dn',
            sum: 'Audit complete',
            it: [{ id: 't1', c: 'Map API dependencies', st: 'dn' }],
          },
        }),
      })

      const existing = createTestPlanSection({ id: 'section-1', phaseId: 'p1', locked: false })
      const updated = createTestPlanSection({ id: 'section-1', phaseId: 'p1', content: 'updated' })
      const updateMsg = createTestMessage({ type: 'plan_update' })

      vi.mocked(mockMessageRepo.findById).mockResolvedValue(aiMessage)
      vi.mocked(mockConversationRepo.getOrCreate).mockResolvedValue(conversation)
      vi.mocked(mockPlanSectionRepo.findByConversationId).mockResolvedValue([existing])
      vi.mocked(mockPlanSectionRepo.update).mockResolvedValue(updated)
      vi.mocked(mockConversationRepo.update).mockResolvedValue(conversation)
      vi.mocked(mockMessageRepo.create).mockResolvedValue(updateMsg)

      const result = await planService.applyMessageToPlan(userId, conversation.id, messageId)

      expect(result.appliedMode).toBe('phase_replace')
      expect(result.planSections).toEqual([updated])
      expect(mockPlanSectionRepo.update).toHaveBeenCalledTimes(1)
    })

    it('accepts stale revision and advances to next server revision', async () => {
      const conversation = createTestConversation({
        id: 'conv-1',
        userId: 'user-1',
        metadata: { planRev: 3 },
      })
      const aiMessage = createTestMessage({
        id: 'msg-stale',
        conversationId: conversation.id,
        type: 'ai',
        content: JSON.stringify({
          v: 1,
          rev: 2,
          ph: [
            {
              id: 'p1',
              n: 'Research',
              o: 1,
              st: 'ip',
              sum: 'x',
              it: [{ id: 't1', c: 'y', st: 'td' }],
            },
          ],
        }),
      })

      vi.mocked(mockMessageRepo.findById).mockResolvedValue(aiMessage)
      vi.mocked(mockConversationRepo.getOrCreate).mockResolvedValue(conversation)
      vi.mocked(mockPlanSectionRepo.findByConversationId).mockResolvedValue([])
      vi.mocked(mockPlanSectionRepo.create).mockResolvedValue(createTestPlanSection({ id: 'new-1' }))
      vi.mocked(mockConversationRepo.update).mockResolvedValue(conversation)
      vi.mocked(mockMessageRepo.create).mockResolvedValue(createTestMessage({ type: 'plan_update' }))

      const result = await planService.applyMessageToPlan('user-1', 'conv-1', 'msg-stale')
      expect(result.planRevision).toBe(4)
      expect(mockConversationRepo.update).toHaveBeenCalledWith(conversation.id, {
        metadata: { planRev: 4, planVersion: 1 },
      })
    })

    it('creates a phase when phase_replace targets unknown phase id', async () => {
      const conversation = createTestConversation({
        id: 'conv-1',
        userId: 'user-1',
        metadata: { planRev: 1 },
      })
      const aiMessage = createTestMessage({
        id: 'msg-unknown',
        conversationId: conversation.id,
        type: 'ai',
        content: JSON.stringify({
          v: 1,
          rev: 2,
          op: 'phase_replace',
          pid: 'missing',
          ph: {
            id: 'missing',
            n: 'Missing',
            o: 1,
            st: 'td',
            sum: 'x',
            it: [{ id: 't1', c: 'y', st: 'td' }],
          },
        }),
      })

      vi.mocked(mockMessageRepo.findById).mockResolvedValue(aiMessage)
      vi.mocked(mockConversationRepo.getOrCreate).mockResolvedValue(conversation)
      vi.mocked(mockPlanSectionRepo.findByConversationId).mockResolvedValue([])
      vi.mocked(mockPlanSectionRepo.create).mockResolvedValue(
        createTestPlanSection({ id: 'created-missing', phaseId: 'missing' })
      )
      vi.mocked(mockConversationRepo.update).mockResolvedValue(conversation)
      vi.mocked(mockMessageRepo.create).mockResolvedValue(createTestMessage({ type: 'plan_update' }))

      const result = await planService.applyMessageToPlan('user-1', 'conv-1', 'msg-unknown')
      expect(result.appliedMode).toBe('phase_replace')
      expect(result.planSections).toHaveLength(1)
      expect(result.planSections[0].phaseId).toBe('missing')
    })

    it('throws NotFoundError for non-existent message', async () => {
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(null)

      await expect(planService.applyMessageToPlan('user-1', 'conv-1', 'msg-1')).rejects.toThrow(NotFoundError)
    })

    it('throws ValidationError for non-AI message', async () => {
      const userMessage = createTestMessage({ type: 'user' })
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(userMessage)

      await expect(planService.applyMessageToPlan('user-1', 'conv-1', 'msg-1')).rejects.toThrow(ValidationError)
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
