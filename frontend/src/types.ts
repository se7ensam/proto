export type MessageType = 'user' | 'ai' | 'assistant' | 'system' | 'plan_update'
export type PlanStatus = 'td' | 'ip' | 'dn' | 'bl'

export interface Message {
  id: string
  type: MessageType
  content: string
  timestamp: Date
  isStreaming?: boolean
  conversationId?: string
  userId?: string
  userEmail?: string
}

export interface ConversationSummary {
  id: string
  createdAt: Date
  updatedAt: Date
  title?: string
  isEmpty?: boolean
  deletedAt?: Date
  metadata?: Record<string, unknown>
}

export interface PlanSection {
  id: string
  content: string
  locked: boolean
  timestamp: Date
  sourceMessageId?: string
  phaseId?: string
  phaseOrder?: number
  structuredData?: PlanPhase
  sourceMessage?: {
    id: string
    content: string
    timestamp: Date
  }
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
