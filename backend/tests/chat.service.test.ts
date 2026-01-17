/**
 * Chat Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChatService } from '../src/domain/services/chat.service'
import {
  createMockMessageRepository,
  createMockConversationRepository,
  createMockPlanningRulesRepository,
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
  let mockLLMService: ReturnType<typeof createMockLLMService>

  beforeEach(() => {
    mockMessageRepo = createMockMessageRepository()
    mockConversationRepo = createMockConversationRepository()
    mockPlanningRulesRepo = createMockPlanningRulesRepository()
    mockLLMService = createMockLLMService()

    chatService = new ChatService(
      mockMessageRepo,
      mockConversationRepo,
      mockPlanningRulesRepo,
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
  })

  describe('regenerateMessage', () => {
    it('should regenerate an AI message', async () => {
      const userId = 'user-1'
      const conversationId = 'conv-1'
      const messageId = 'msg-2'

      const userMessage = createTestMessage({ id: 'msg-1', type: 'user', content: 'Hello' })
      const aiMessage = createTestMessage({ id: messageId, type: 'ai', content: 'Old response' })
      const updatedMessage = createTestMessage({ id: messageId, type: 'ai', content: 'New response' })

      vi.mocked(mockMessageRepo.findById).mockResolvedValue(aiMessage)
      vi.mocked(mockMessageRepo.findByConversationId).mockResolvedValue([userMessage, aiMessage])
      vi.mocked(mockPlanningRulesRepo.getRules).mockResolvedValue([])
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
