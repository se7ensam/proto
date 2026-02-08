/**
 * Domain types - Framework-agnostic business entities
 */

export type MessageType = 'user' | 'ai' | 'system' | 'plan_update'

export interface Message {
  id: string
  conversationId: string
  userId: string
  type: MessageType
  content: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface PlanSection {
  id: string
  conversationId: string
  userId: string
  content: string
  locked: boolean
  timestamp: Date
  sourceMessageId?: string
}

export interface Conversation {
  id: string
  userId: string
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, unknown>
}

export interface User {
  id: string
  email: string
  passwordHash?: string
  googleId?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Value Objects
 */

export interface ConversationContext {
  messages: Message[]
  planSections: PlanSection[]
  planningRules: string[]
}

export interface AuthTokenPayload {
  userId: string
  email: string
}

export interface LLMRequest {
  userMessage: string
  context: ConversationContext
}

export interface LLMResponse {
  content: string
  metadata?: {
    model: string
    tokensUsed?: number
    latencyMs: number
  }
}
