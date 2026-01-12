import { Message, PlanSection } from '../types'

const API_BASE = '/api'

export interface SendMessageResponse {
  userMessage: Message
  aiMessage: Message
  conversationId: string
}

export interface RegenerateResponse {
  message: Message
  conversationId: string
}

export interface ApplyToPlanResponse {
  planSection: PlanSection
  planUpdateMessage: Message
  conversationId: string
}

class ApiService {
  private conversationId: string = 'default'

  setConversationId(id: string) {
    this.conversationId = id
  }

  async sendMessage(content: string): Promise<SendMessageResponse> {
    const response = await fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        conversationId: this.conversationId,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send message')
    }

    return response.json()
  }

  async regenerateMessage(messageId: string): Promise<RegenerateResponse> {
    const response = await fetch(`${API_BASE}/chat/regenerate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messageId,
        conversationId: this.conversationId,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to regenerate message')
    }

    return response.json()
  }

  async getConversationHistory(): Promise<{ messages: Message[] }> {
    const response = await fetch(
      `${API_BASE}/chat/history/${this.conversationId}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch conversation history')
    }

    return response.json()
  }

  async applyToPlan(messageId: string): Promise<ApplyToPlanResponse> {
    const response = await fetch(`${API_BASE}/plan/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messageId,
        conversationId: this.conversationId,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to apply to plan')
    }

    return response.json()
  }

  async getPlanSections(): Promise<{ sections: PlanSection[] }> {
    const response = await fetch(
      `${API_BASE}/plan/sections/${this.conversationId}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch plan sections')
    }

    return response.json()
  }

  async lockSection(sectionId: string, locked: boolean): Promise<{
    section: PlanSection
  }> {
    const response = await fetch(`${API_BASE}/plan/lock?conversationId=${this.conversationId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sectionId,
        locked,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to lock section')
    }

    return response.json()
  }
}

export const apiService = new ApiService()
