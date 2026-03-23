import { ConversationSummary, Message, PlanSection } from '../types'

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
  planSections?: PlanSection[]
  planUpdateMessage: Message
  appliedMode?: 'text' | 'plan_doc' | 'phase_replace'
  planRevision?: number
  conversationId: string
}

export interface GetConversationsResponse {
  conversations: ConversationSummary[]
}

export interface CreateConversationResponse {
  conversation: ConversationSummary
}

export interface DeleteConversationResponse {
  conversation: ConversationSummary
}

export interface RestoreConversationResponse {
  conversation: ConversationSummary
}

export interface UpdateConversationTitleResponse {
  conversation: ConversationSummary
}

class ApiService {
  private conversationId: string = 'default'
  private token: string | null = localStorage.getItem('auth_token')

  constructor() {
    // No-op
  }

  setConversationId(id: string) {
    this.conversationId = id
  }

  setToken(token: string) {
    this.token = token
    localStorage.setItem('auth_token', token)
  }

  logout() {
    this.token = null
    localStorage.removeItem('auth_token')
  }

  get userId(): string | null {
    if (!this.token) return null
    try {
      const payload = JSON.parse(atob(this.token.split('.')[1]))
      return payload.userId || payload.sub || payload.id || null
    } catch {
      return null
    }
  }

  private getHeaders(): any {
    const headers: any = {
      'Content-Type': 'application/json',
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }

  private normalizePlanSection(section: any): PlanSection {
    return {
      ...section,
      timestamp: new Date(section.timestamp),
    }
  }

  private normalizeConversation(conversation: any): ConversationSummary {
    const metadata =
      conversation && typeof conversation.metadata === 'object' && !Array.isArray(conversation.metadata)
        ? conversation.metadata
        : undefined
    const rawTitle =
      typeof conversation.title === 'string'
        ? conversation.title
        : typeof metadata?.title === 'string'
          ? metadata.title
          : undefined
    const title = rawTitle?.trim() || 'New chat'
    const deletedAt =
      typeof conversation.deletedAt === 'string'
        ? conversation.deletedAt
        : typeof metadata?.deletedAt === 'string'
          ? metadata.deletedAt
          : undefined

    return {
      ...conversation,
      createdAt: new Date(conversation.createdAt),
      updatedAt: new Date(conversation.updatedAt),
      title,
      deletedAt: deletedAt ? new Date(deletedAt) : undefined,
      isEmpty: Boolean(conversation.isEmpty),
    }
  }

  async login(email: string, password: string): Promise<{ user: any; token: string }> {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Login failed')
    }
    return response.json()
  }

  async signup(email: string, password: string): Promise<{ user: any; token: string }> {
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Signup failed')
    }
    return response.json()
  }

  async loginWithGoogle(token: string): Promise<{ user: any; token: string }> {
    const response = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Google login failed')
    }
    return response.json()
  }

  async sendMessage(content: string): Promise<SendMessageResponse> {
    const response = await fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        content,
        conversationId: this.conversationId,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to send message')
    }

    return response.json()
  }

  async sendMessageStream(
    content: string,
    onChunk: (chunk: string) => void,
    onUserMessage: (message: Message) => void,
    onAiStart: (messageId: string) => void,
    onComplete: (message: Message) => void,
    onError: (error: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/chat/message/stream`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        content,
        conversationId: this.conversationId,
      }),
      signal,
    })

    if (!response.ok) {
      if (response.status === 401) {
        onError('Unauthorized: Please login again')
        return
      }
      const errorData = await response.json()
      onError(errorData.error?.message || 'Failed to send message')
      return
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      onError('Failed to get response stream')
      return
    }

    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'user') {
                onUserMessage({
                  ...data.message,
                  timestamp: new Date(data.message.timestamp),
                })
              } else if (data.type === 'ai_start') {
                onAiStart(data.messageId)
              } else if (data.type === 'chunk') {
                // Process chunk immediately for faster UI update
                onChunk(data.content)
              } else if (data.type === 'done') {
                onComplete({
                  ...data.message,
                  timestamp: new Date(data.message.timestamp),
                })
              } else if (data.type === 'error') {
                onError(data.error)
              }
            } catch (e) {
              console.error('[API Service] Failed to parse SSE data:', e)
            }
          }
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Streaming error')
    }
  }

  async regenerateMessage(messageId: string): Promise<RegenerateResponse> {
    const response = await fetch(`${API_BASE}/chat/regenerate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        messageId,
        conversationId: this.conversationId,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to regenerate message')
    }

    return response.json()
  }

  async getConversationHistory(): Promise<{ messages: Message[] }> {
    const response = await fetch(
      `${API_BASE}/chat/history/${this.conversationId}`,
      {
        headers: this.getHeaders(),
      }
    )

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized: Please login again')
      }
      throw new Error('Failed to fetch conversation history')
    }

    const data = await response.json()
    return {
      messages: data.messages.map((msg: any) => {
        // Normalize type/role
        let type = msg.type || msg.role
        if (type === 'assistant') type = 'ai'
        
        return {
          ...msg,
          type,
          timestamp: new Date(msg.timestamp),
        }
      }),
    }
  }

  async getConversations(): Promise<GetConversationsResponse> {
    const response = await fetch(`${API_BASE}/chat/conversations`, {
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized: Please login again')
      }
      throw new Error('Failed to fetch conversations')
    }

    const data = await response.json()
    return {
      conversations: (data.conversations || []).map((conversation: any) => this.normalizeConversation(conversation)),
    }
  }

  async getDeletedConversations(): Promise<GetConversationsResponse> {
    const response = await fetch(`${API_BASE}/chat/conversations/deleted`, {
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized: Please login again')
      }
      throw new Error('Failed to fetch deleted conversations')
    }

    const data = await response.json()
    return {
      conversations: (data.conversations || []).map((conversation: any) => this.normalizeConversation(conversation)),
    }
  }

  async createConversation(): Promise<CreateConversationResponse> {
    const response = await fetch(`${API_BASE}/chat/conversations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to create conversation')
    }

    const data = await response.json()
    return {
      conversation: this.normalizeConversation({ ...data.conversation, isEmpty: true }),
    }
  }

  async deleteConversation(conversationId: string): Promise<DeleteConversationResponse> {
    const response = await fetch(`${API_BASE}/chat/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to delete conversation')
    }

    const data = await response.json()
    return {
      conversation: this.normalizeConversation(data.conversation),
    }
  }

  async restoreConversation(conversationId: string): Promise<RestoreConversationResponse> {
    const response = await fetch(`${API_BASE}/chat/conversations/${conversationId}/restore`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to restore conversation')
    }

    const data = await response.json()
    return {
      conversation: this.normalizeConversation(data.conversation),
    }
  }

  async updateConversationTitle(
    conversationId: string,
    title: string
  ): Promise<UpdateConversationTitleResponse> {
    const response = await fetch(`${API_BASE}/chat/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ title }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to update conversation title')
    }

    const data = await response.json()
    return {
      conversation: this.normalizeConversation(data.conversation),
    }
  }

  async applyToPlan(messageId: string): Promise<ApplyToPlanResponse> {
    const response = await fetch(`${API_BASE}/plan/apply`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        messageId,
        conversationId: this.conversationId,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to apply to plan')
    }

    const data = await response.json()
    return {
      ...data,
      planSection: this.normalizePlanSection(data.planSection),
      planSections: Array.isArray(data.planSections)
        ? data.planSections.map((section: any) => this.normalizePlanSection(section))
        : undefined,
      planUpdateMessage: {
        ...data.planUpdateMessage,
        timestamp: new Date(data.planUpdateMessage.timestamp),
      },
    }
  }

  async getPlanSections(): Promise<{ sections: PlanSection[] }> {
    const response = await fetch(
      `${API_BASE}/plan/sections/${this.conversationId}`,
      {
        headers: this.getHeaders(),
      }
    )

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized: Please login again')
      }
      throw new Error('Failed to fetch plan sections')
    }

    const data = await response.json()
    return {
      sections: data.sections.map((section: any) => this.normalizePlanSection(section)),
    }
  }

  // ==================== Members Integration ====================

  async searchUsers(query: string): Promise<{ users: {id: string, email: string}[] }> {
    const response = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error('Failed to search users')
    }

    return response.json()
  }

  async addMember(userId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/chat/${this.conversationId}/members`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId }),
    })

    if (!response.ok) {
      throw new Error('Failed to add member')
    }

    return response.json()
  }

  async removeMember(userId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/chat/${this.conversationId}/members/${userId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error('Failed to remove member')
    }

    return response.json()
  }

  async lockSection(sectionId: string, locked: boolean): Promise<{
    section: PlanSection
  }> {
    const response = await fetch(`${API_BASE}/plan/lock?conversationId=${this.conversationId}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        sectionId,
        locked,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to lock section')
    }

    return response.json()
  }

  // ==================== GitHub Integration ====================

  async initiateGitHubAuth(conversationId: string, collaboratorEmail?: string): Promise<{ authUrl: string; state: string }> {
    const response = await fetch(`${API_BASE}/github/auth/initiate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        conversationId,
        collaboratorEmail,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to initiate GitHub auth')
    }

    return response.json()
  }

  async getGitHubIntegration(conversationId: string): Promise<{
    integrated: boolean
    id?: string
    githubUsername?: string
    githubAvatarUrl?: string
    repoName?: string
    repoFullName?: string
    repoUrl?: string
    repoOwner?: string
    collaboratorUsername?: string
    collaborationStatus?: string
    integrationStatus?: string
    lastSyncAt?: string
    createdAt?: string
  }> {
    const response = await fetch(
      `${API_BASE}/github/integration/${conversationId}`,
      {
        headers: this.getHeaders(),
      }
    )

    if (!response.ok) {
      return { integrated: false }
    }

    return response.json()
  }

  async getGitHubSyncHistory(conversationId: string): Promise<{ history: any[] }> {
    const response = await fetch(
      `${API_BASE}/github/integration/${conversationId}/history`,
      {
        headers: this.getHeaders(),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to fetch sync history')
    }

    return response.json()
  }

  async disconnectGitHub(conversationId: string): Promise<{ success: boolean }> {
    const response = await fetch(
      `${API_BASE}/github/integration/${conversationId}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to disconnect GitHub')
    }

    return response.json()
  }
}

export const apiService = new ApiService()
