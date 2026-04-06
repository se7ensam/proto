/**
 * Domain types - Framework-agnostic business entities
 */

export type MessageType = 'user' | 'ai' | 'system' | 'plan_update'
export type PlanStatus = 'td' | 'ip' | 'dn' | 'bl'

/** Per–plan-section calendar sync outcome (distinct from phase task PlanStatus). */
export type PlanCalendarEventStatus = 'created' | 'failed'

export interface Message {
  id: string
  conversationId: string
  userId: string
  type: MessageType
  content: string
  timestamp: Date
  metadata?: Record<string, unknown>
  userEmail?: string
}

export interface PlanSection {
  id: string
  conversationId: string
  userId: string
  content: string
  locked: boolean
  timestamp: Date
  sourceMessageId?: string
  phaseId?: string
  phaseOrder?: number
  structuredData?: PlanPhase
  calendarEventStatus?: PlanCalendarEventStatus
}

export interface PlanTask {
  id: string
  c: string
  st: PlanStatus
}

export interface PlanPhase {
  id: string
  n: string
  o: number
  st: PlanStatus
  sum: string
  it: PlanTask[]
}

export interface PlanDoc {
  v: 1
  rev: number
  ph: PlanPhase[]
}

export interface PlanDeltaPhaseReplace {
  v: 1
  rev: number
  op: 'phase_replace'
  pid: string
  ph: PlanPhase
}

export type PlanPayload = PlanDoc | PlanDeltaPhaseReplace

export interface Conversation {
  id: string
  userId: string
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, unknown>
}

export type ConversationRole = 'host' | 'member'

export interface ConversationMember {
  id: string
  conversationId: string
  userId: string
  role: ConversationRole
  joinedAt: Date
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
  planRevision?: number
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
