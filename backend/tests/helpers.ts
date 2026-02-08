/**
 * Test helpers and utilities
 */

import { vi } from 'vitest'
import { IMessageRepository, IPlanSectionRepository, IConversationRepository, IUserRepository, IPlanningRulesRepository } from '../src/domain/repositories'
import { ILLMService } from '../src/domain/services/chat.service'
import { ITokenService, IGoogleAuthService } from '../src/domain/services/auth.service'
import { Message, PlanSection, Conversation, User, ConversationContext } from '../src/domain/types'

/**
 * Create mock repositories
 */

export function createMockMessageRepository(): IMessageRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByConversationId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

export function createMockPlanSectionRepository(): IPlanSectionRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByConversationId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

export function createMockConversationRepository(): IConversationRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getOrCreate: vi.fn(),
  }
}

export function createMockUserRepository(): IUserRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByGoogleId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

export function createMockPlanningRulesRepository(): IPlanningRulesRepository {
  return {
    setRules: vi.fn(),
    getRules: vi.fn(),
    deleteRules: vi.fn(),
  }
}

/**
 * Create mock services
 */

export function createMockLLMService(): ILLMService {
  return {
    generateResponse: vi.fn(),
    generateResponseStream: vi.fn(),
  }
}

export function createMockTokenService(): ITokenService {
  return {
    sign: vi.fn(),
    verify: vi.fn(),
  }
}

export function createMockGoogleAuthService(): IGoogleAuthService {
  return {
    verifyIdToken: vi.fn(),
  }
}

/**
 * Test data factories
 */

export function createTestUser(overrides?: Partial<User>): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: '$2a$10$hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function createTestConversation(overrides?: Partial<Conversation>): Conversation {
  return {
    id: 'conv-1',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function createTestMessage(overrides?: Partial<Message>): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    userId: 'user-1',
    type: 'user',
    content: 'Test message',
    timestamp: new Date(),
    ...overrides,
  }
}

export function createTestPlanSection(overrides?: Partial<PlanSection>): PlanSection {
  return {
    id: 'section-1',
    conversationId: 'conv-1',
    userId: 'user-1',
    content: 'Test plan section',
    locked: false,
    timestamp: new Date(),
    ...overrides,
  }
}

export function createTestContext(overrides?: Partial<ConversationContext>): ConversationContext {
  return {
    messages: [],
    planSections: [],
    planningRules: [],
    ...overrides,
  }
}
