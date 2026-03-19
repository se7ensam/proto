/**
 * Chat Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChatService } from '../src/domain/services/chat.service'
import {
  createMockMessageRepository,
  createMockConversationRepository,
  createMockPlanningRulesRepository,
  createMockPlanSectionRepository,
  createMockLLMService,
  createTestMessage,
  createTestConversation,
} from './helpers'
import { ValidationError, NotFoundError } from '../src/domain/errors'

describe('ChatService', () => {
  let chatService: ChatService
  let mockMessageRepo: ReturnType<typeof createMockMessageRepository>
  let mockConversationRepo: ReturnType<typeof createMockConversationRepository>
  let mockPlanningRulesRepo: ReturnType<typeof createMockPlanningRulesRepository>
  let mockPlanSectionRepo: ReturnType<typeof createMockPlanSectionRepository>
  let mockLLMService: ReturnType<typeof createMockLLMService>

  beforeEach(() => {
    mockMessageRepo = createMockMessageRepository()
    mockConversationRepo = createMockConversationRepository()
    mockPlanningRulesRepo = createMockPlanningRulesRepository()
    mockPlanSectionRepo = createMockPlanSectionRepository()
    mockLLMService = createMockLLMService()

    chatService = new ChatService(
      mockMessageRepo,
      mockConversationRepo,
      mockPlanningRulesRepo,
      mockPlanSectionRepo,
      mockLLMService
    )
  })

  describe('sendMessage', () => {
    it('should send a message and get AI response', async () => {
      const userId = 'user-1'
      const conversationId = 'conv-1'
      const content = 'Hello, AI!'

      const conversation = createTestConversation({ id: conversationId, userId })
      const userMessage = createTestMessage({ id: 'msg-1', type: 'user', content })
      const aiMessage = createTestMessage({ id: 'msg-2', type: 'ai', content: 'Hello, human!' })

      vi.mocked(mockConversationRepo.getOrCreate).mockResolvedValue(conversation)
      vi.mocked(mockMessageRepo.create)
        .mockResolvedValueOnce(userMessage)
        .mockResolvedValueOnce(aiMessage)
      vi.mocked(mockMessageRepo.findByConversationId).mockResolvedValue([])
      vi.mocked(mockPlanningRulesRepo.getRules).mockResolvedValue([])
      vi.mocked(mockPlanSectionRepo.findByConversationId).mockResolvedValue([])
      vi.mocked(mockLLMService.generateResponse).mockResolvedValue('Hello, human!')

      const result = await chatService.sendMessage(userId, conversationId, content)

      expect(result.userMessage).toEqual(userMessage)
      expect(result.aiMessage).toEqual(aiMessage)
      expect(mockConversationRepo.getOrCreate).toHaveBeenCalledWith(userId, conversationId)
      expect(mockLLMService.generateResponse).toHaveBeenCalled()
    })

    it('should throw ValidationError for empty content', async () => {
      await expect(
        chatService.sendMessage('user-1', 'conv-1', '   ')
      ).rejects.toThrow(ValidationError)
    })

    it('streams human-readable content for plan prompts and stores JSON in metadata', async () => {
      const userId = 'user-1'
      const conversationId = 'conv-1'
      const content = 'Create a plan for this migration'

      const conversation = createTestConversation({ id: conversationId, userId })
      const userMessage = createTestMessage({ id: 'msg-1', type: 'user', content })
      const aiMessage = createTestMessage({ id: 'msg-2', type: 'ai', content: 'normalized plan text' })

      vi.mocked(mockConversationRepo.getOrCreate).mockResolvedValue(conversation)
      vi.mocked(mockMessageRepo.create)
        .mockResolvedValueOnce(userMessage)
        .mockResolvedValueOnce(aiMessage)
      vi.mocked(mockMessageRepo.findByConversationId).mockResolvedValue([])
      vi.mocked(mockPlanningRulesRepo.getRules).mockResolvedValue([])
      vi.mocked(mockPlanSectionRepo.findByConversationId).mockResolvedValue([])
      vi.mocked(mockLLMService.generateResponse).mockResolvedValue(
        JSON.stringify({
          v: 1,
          rev: 1,
          ph: [
            {
              id: 'p1',
              n: 'Research',
              o: 1,
              st: 'ip',
              sum: 'Audit architecture',
              it: [{ id: 't1', c: 'Map APIs', st: 'td' }],
            },
          ],
        })
      )

      const events: Array<{ type: string; content?: string }> = []
      for await (const event of chatService.sendMessageStream(userId, conversationId, content)) {
        if (event.type === 'chunk') {
          events.push({ type: event.type, content: event.content })
        }
      }

      expect(events.some((event) => event.content?.includes('Research (in_progress)'))).toBe(true)
      expect(events.some((event) => event.content?.trim().startsWith('{'))).toBe(false)
      expect(mockMessageRepo.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          type: 'ai',
          content: expect.stringContaining('Research (in_progress)'),
          metadata: expect.objectContaining({
            responseFormat: 'plan_json',
          }),
        })
      )
    })

    it('auto-generates title when conversation has placeholder title', async () => {
      const userId = 'user-1'
      const conversationId = 'conv-1'
      const content = 'Plan migration from REST API to GraphQL gateway'

      const conversation = createTestConversation({
        id: conversationId,
        userId,
        metadata: {
          title: 'New chat',
          titleEdited: false,
        },
      })
      const userMessage = createTestMessage({ id: 'msg-1', type: 'user', content })
      const aiMessage = createTestMessage({ id: 'msg-2', type: 'ai', content: 'Done' })

      vi.mocked(mockConversationRepo.getOrCreate).mockResolvedValue(conversation)
      vi.mocked(mockConversationRepo.update).mockResolvedValue(
        createTestConversation({
          id: conversationId,
          userId,
          metadata: {
            title: 'Plan migration from REST API to GraphQL',
            titleEdited: false,
          },
        })
      )
      vi.mocked(mockMessageRepo.create)
        .mockResolvedValueOnce(userMessage)
        .mockResolvedValueOnce(aiMessage)
      vi.mocked(mockMessageRepo.findByConversationId).mockResolvedValue([])
      vi.mocked(mockPlanningRulesRepo.getRules).mockResolvedValue([])
      vi.mocked(mockPlanSectionRepo.findByConversationId).mockResolvedValue([])
      vi.mocked(mockLLMService.generateResponse).mockResolvedValue('Done')

      await chatService.sendMessage(userId, conversationId, content)

      expect(mockConversationRepo.update).toHaveBeenCalledWith(conversationId, {
        metadata: expect.objectContaining({
          title: 'Plan migration from REST API to GraphQL',
          titleEdited: false,
        }),
      })
    })

    it('uses AI-generated conversation title when available', async () => {
      const userId = 'user-1'
      const conversationId = 'conv-1'
      const content = 'Plan migration from REST API to GraphQL gateway'

      const conversation = createTestConversation({
        id: conversationId,
        userId,
        metadata: {
          title: 'New chat',
          titleEdited: false,
        },
      })
      const userMessage = createTestMessage({ id: 'msg-1', type: 'user', content })
      const aiMessage = createTestMessage({ id: 'msg-2', type: 'ai', content: 'Done' })

      vi.mocked(mockConversationRepo.getOrCreate).mockResolvedValue(conversation)
      vi.mocked(mockConversationRepo.update).mockResolvedValue(
        createTestConversation({
          id: conversationId,
          userId,
          metadata: {
            title: 'Migration plan and API scope',
            titleEdited: false,
          },
        })
      )
      vi.mocked(mockLLMService.generateConversationTitle).mockResolvedValue('Migration plan and API scope')
      vi.mocked(mockMessageRepo.create)
        .mockResolvedValueOnce(userMessage)
        .mockResolvedValueOnce(aiMessage)
      vi.mocked(mockMessageRepo.findByConversationId).mockResolvedValue([])
      vi.mocked(mockPlanningRulesRepo.getRules).mockResolvedValue([])
      vi.mocked(mockPlanSectionRepo.findByConversationId).mockResolvedValue([])
      vi.mocked(mockLLMService.generateResponse).mockResolvedValue('Done')

      await chatService.sendMessage(userId, conversationId, content)

      expect(mockConversationRepo.update).toHaveBeenCalledWith(conversationId, {
        metadata: expect.objectContaining({
          title: 'Migration plan and API scope',
          titleEdited: false,
        }),
      })
    })

    it('does not auto-generate title when user-edited title exists', async () => {
      const userId = 'user-1'
      const conversationId = 'conv-1'
      const content = 'Any user message'

      const conversation = createTestConversation({
        id: conversationId,
        userId,
        metadata: {
          title: 'Custom title',
          titleEdited: true,
        },
      })
      const userMessage = createTestMessage({ id: 'msg-1', type: 'user', content })
      const aiMessage = createTestMessage({ id: 'msg-2', type: 'ai', content: 'Done' })

      vi.mocked(mockConversationRepo.getOrCreate).mockResolvedValue(conversation)
      vi.mocked(mockMessageRepo.create)
        .mockResolvedValueOnce(userMessage)
        .mockResolvedValueOnce(aiMessage)
      vi.mocked(mockMessageRepo.findByConversationId).mockResolvedValue([])
      vi.mocked(mockPlanningRulesRepo.getRules).mockResolvedValue([])
      vi.mocked(mockPlanSectionRepo.findByConversationId).mockResolvedValue([])
      vi.mocked(mockLLMService.generateResponse).mockResolvedValue('Done')

      await chatService.sendMessage(userId, conversationId, content)

      expect(mockConversationRepo.update).not.toHaveBeenCalled()
    })
  })

  describe('updateConversationTitle', () => {
    it('updates title and marks it as user edited', async () => {
      const userId = 'user-1'
      const conversationId = 'conv-1'

      const existingConversation = createTestConversation({
        id: conversationId,
        userId,
        metadata: {
          title: 'Old title',
          titleEdited: false,
        },
      })
      const updatedConversation = createTestConversation({
        id: conversationId,
        userId,
        metadata: {
          title: 'New title',
          titleEdited: true,
        },
      })

      vi.mocked(mockConversationRepo.findById).mockResolvedValue(existingConversation)
      vi.mocked(mockConversationRepo.update).mockResolvedValue(updatedConversation)

      const result = await chatService.updateConversationTitle(userId, conversationId, '  New    title ')

      expect(mockConversationRepo.update).toHaveBeenCalledWith(conversationId, {
        metadata: {
          title: 'New title',
          titleEdited: true,
        },
      })
      expect(result).toEqual(updatedConversation)
    })

    it('rejects empty titles', async () => {
      await expect(
        chatService.updateConversationTitle('user-1', 'conv-1', '   ')
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('regenerateMessage', () => {
    it('should regenerate an AI message', async () => {
      const userId = 'user-1'
      const conversationId = 'conv-1'
      const messageId = 'msg-2'

      const userMessage = createTestMessage({ id: 'msg-1', type: 'user', content: 'Hello' })
      const aiMessage = createTestMessage({ id: messageId, type: 'ai', content: 'Old response' })
      const updatedMessage = createTestMessage({ id: messageId, type: 'ai', content: 'New response' })

      vi.mocked(mockConversationRepo.getOrCreate).mockResolvedValue(
        createTestConversation({ id: conversationId, userId })
      )
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(aiMessage)
      vi.mocked(mockMessageRepo.findByConversationId).mockResolvedValue([userMessage, aiMessage])
      vi.mocked(mockPlanningRulesRepo.getRules).mockResolvedValue([])
      vi.mocked(mockPlanSectionRepo.findByConversationId).mockResolvedValue([])
      vi.mocked(mockLLMService.generateResponse).mockResolvedValue('New response')
      vi.mocked(mockMessageRepo.update).mockResolvedValue(updatedMessage)

      const result = await chatService.regenerateMessage(userId, conversationId, messageId)

      expect(result.content).toBe('New response')
      expect(mockLLMService.generateResponse).toHaveBeenCalled()
    })

    it('should throw NotFoundError for non-existent message', async () => {
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(null)

      await expect(
        chatService.regenerateMessage('user-1', 'conv-1', 'msg-999')
      ).rejects.toThrow(NotFoundError)
    })

    it('should throw ValidationError for non-AI message', async () => {
      const userMessage = createTestMessage({ id: 'msg-1', type: 'user' })
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(userMessage)

      await expect(
        chatService.regenerateMessage('user-1', 'conv-1', 'msg-1')
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('getConversationHistory', () => {
    it('should return conversation history', async () => {
      const userId = 'user-1'
      const conversationId = 'conv-1'
      const messages = [
        createTestMessage({ id: 'msg-1', type: 'user', conversationId }),
        createTestMessage({ id: 'msg-2', type: 'ai', conversationId }),
      ]

      const conversation = createTestConversation({ id: conversationId, userId })
      vi.mocked(mockConversationRepo.getOrCreate).mockResolvedValue(conversation)
      vi.mocked(mockMessageRepo.findByConversationId).mockResolvedValue(messages)

      const result = await chatService.getConversationHistory(userId, conversationId)

      expect(result).toEqual(messages)
    })
  })
})
