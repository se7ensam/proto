export type MessageType = 'user' | 'ai' | 'system' | 'plan_update'

export interface Message {
  id: string
  type: MessageType
  content: string
  timestamp: Date
  isStreaming?: boolean
}

export interface PlanSection {
  id: string
  content: string
  locked: boolean
  timestamp: Date
}
