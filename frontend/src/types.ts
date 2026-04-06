export type MessageType = 'user' | 'ai' | 'assistant' | 'system' | 'plan_update'
export type PlanStatus = 'td' | 'ip' | 'dn' | 'bl'
export type PlanCalendarEventStatus = 'created' | 'failed'

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
  /** True once plan has been exported to calendar (Google/ICS) for this chat */
  calendarEventsCreated?: boolean
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
  /** Set after a calendar event is created for this section (server-persisted). */
  calendarEventStatus?: PlanCalendarEventStatus
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
