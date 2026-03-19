import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import ChatPanel from './components/ChatPanel'
import PlanDraftPanel from './components/PlanDraftPanel'
import { ConversationSummary, Message, PlanSection } from './types'
import { apiService } from './services/api'
import { AppMenubar } from './components/AppMenubar'
import ConversationSidebar from './components/ConversationSidebar'

import LoginPage from './components/LoginPage'

const PANEL_WIDTH_STORAGE_KEY = 'chat_panel_width_percent'
const ACTIVE_CONVERSATION_STORAGE_KEY = 'active_conversation_id'
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'conversations_sidebar_collapsed'
const PLAN_PANEL_COLLAPSED_STORAGE_KEY = 'plan_panel_collapsed'
const MIN_CHAT_PANEL_WIDTH = 25
const MAX_CHAT_PANEL_WIDTH = 75

const clampChatPanelWidth = (value: number) =>
  Math.min(MAX_CHAT_PANEL_WIDTH, Math.max(MIN_CHAT_PANEL_WIDTH, value))

const generateConversationTitleFromContent = (content: string): string => {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return 'New chat'
  }

  const words = normalized.split(' ')
  const clipped = words.slice(0, 7).join(' ')
  return clipped.length > 60 ? `${clipped.slice(0, 57)}...` : clipped
}

const hasCustomConversationTitle = (conversation: ConversationSummary): boolean => {
  const title = conversation.title?.trim() ?? ''
  const metadata =
    conversation.metadata && typeof conversation.metadata === 'object' && !Array.isArray(conversation.metadata)
      ? (conversation.metadata as Record<string, unknown>)
      : undefined
  const titleEdited = metadata?.titleEdited === true
  return titleEdited || (title.length > 0 && title.toLowerCase() !== 'new chat')
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [planSections, setPlanSections] = useState<PlanSection[]>([])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [deletedConversations, setDeletedConversations] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY)
  })
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('auth_token'))
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRestoringDeletedConversations, setIsRestoringDeletedConversations] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1'
  })
  const [isPlanPanelCollapsed, setIsPlanPanelCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(PLAN_PANEL_COLLAPSED_STORAGE_KEY) === '1'
  })
  const [isResizing, setIsResizing] = useState(false)
  const [chatPanelWidth, setChatPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return 50
    const savedWidth = Number(window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY))
    if (Number.isNaN(savedWidth)) return 50
    return clampChatPanelWidth(savedWidth)
  })
  const [dividerTooltip, setDividerTooltip] = useState<{
    visible: boolean
    x: number
    y: number
  }>({
    visible: false,
    x: 0,
    y: 0,
  })
  const abortControllerRef = (useRef<AbortController | null>(null)) as React.MutableRefObject<AbortController | null>
  const mainContentRef = useRef<HTMLDivElement | null>(null)
  const isResizingRef = useRef(false)
  const resizeAnimationFrameRef = useRef<number | null>(null)
  const pendingResizeWidthRef = useRef<number | null>(null)

  const upsertConversation = (conversation: ConversationSummary) => {
    setConversations((prev) => {
      const withoutCurrent = prev.filter((item) => item.id !== conversation.id)
      const updated = [{ ...conversation }, ...withoutCurrent]
      return updated.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    })
  }

  const bumpConversationActivity = (conversationId: string) => {
    setConversations((prev) => {
      const target = prev.find((conversation) => conversation.id === conversationId)
      if (!target) return prev

      const bumped = { ...target, updatedAt: new Date(), isEmpty: false }
      const withoutCurrent = prev.filter((conversation) => conversation.id !== conversationId)
      return [bumped, ...withoutCurrent].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    })
  }

  const syncConversationSummaryFromServer = async (conversationId: string) => {
    try {
      const response = await apiService.getConversations()
      const updated = response.conversations.find((conversation) => conversation.id === conversationId)
      if (updated) {
        upsertConversation(updated)
      }
    } catch (error) {
      console.warn('Failed to refresh conversation title from server:', error)
    }
  }

  // Load conversation list
  useEffect(() => {
    if (!isAuthenticated) return // Don't load data if not authenticated
    
    const loadConversations = async () => {
      try {
        const listRes = await apiService.getConversations()

        let deletedRes: { conversations: ConversationSummary[] } = { conversations: [] }
        try {
          deletedRes = await apiService.getDeletedConversations()
        } catch (error) {
          console.warn('Failed to load deleted conversations, continuing without recycle bin data:', error)
        }

        const sorted = [...listRes.conversations].sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
        )
        const deletedSorted = [...deletedRes.conversations].sort((a, b) => {
          const aTime = a.deletedAt?.getTime() ?? a.updatedAt.getTime()
          const bTime = b.deletedAt?.getTime() ?? b.updatedAt.getTime()
          return bTime - aTime
        })

        const persistedConversationId =
          typeof window === 'undefined'
            ? null
            : window.localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY)

        let nextActiveConversationId =
          persistedConversationId && sorted.some((conversation) => conversation.id === persistedConversationId)
            ? persistedConversationId
            : sorted[0]?.id ?? null

        let nextConversations = sorted

        if (!nextActiveConversationId) {
          const created = await apiService.createConversation()
          nextConversations = [created.conversation]
          nextActiveConversationId = created.conversation.id
        }

        setConversations(nextConversations)
        setDeletedConversations(deletedSorted)
        setActiveConversationId(nextActiveConversationId)
      } catch (error) {
        console.error('Failed to load conversations:', error)
        // If we get 401, user token is invalid
        if (error instanceof Error && error.message.includes('401')) {
          apiService.logout()
          setIsAuthenticated(false)
          toast.error('Session expired. Please login again.')
        }
      }
    }

    loadConversations()
  }, [isAuthenticated]) // Re-run when authentication status changes

  // Load active conversation data
  useEffect(() => {
    if (!isAuthenticated) return
    if (!activeConversationId) return

    const loadData = async () => {
      try {
        apiService.setConversationId(activeConversationId)
        const [historyRes, planRes] = await Promise.all([
          apiService.getConversationHistory(),
          apiService.getPlanSections(),
        ])
        setMessages(historyRes.messages)
        setPlanSections(planRes.sections)
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === activeConversationId
              ? {
                  ...conversation,
                  isEmpty: historyRes.messages.length === 0 && planRes.sections.length === 0,
                }
              : conversation
          )
        )
      } catch (error) {
        console.error('Failed to load conversation data:', error)
        if (error instanceof Error && error.message.includes('401')) {
          apiService.logout()
          setIsAuthenticated(false)
          toast.error('Session expired. Please login again.')
        } else {
          toast.error('Failed to load selected chat')
        }
      }
    }

    loadData()
  }, [isAuthenticated, activeConversationId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, chatPanelWidth.toString())
  }, [chatPanelWidth])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, isSidebarCollapsed ? '1' : '0')
  }, [isSidebarCollapsed])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(PLAN_PANEL_COLLAPSED_STORAGE_KEY, isPlanPanelCollapsed ? '1' : '0')
  }, [isPlanPanelCollapsed])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!activeConversationId) {
      window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(ACTIVE_CONVERSATION_STORAGE_KEY, activeConversationId)
  }, [activeConversationId])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingRef.current || !mainContentRef.current) return
      const rect = mainContentRef.current.getBoundingClientRect()
      if (rect.width === 0) return
      const nextWidth = clampChatPanelWidth(((event.clientX - rect.left) / rect.width) * 100)
      pendingResizeWidthRef.current = nextWidth

      if (resizeAnimationFrameRef.current !== null) {
        return
      }

      resizeAnimationFrameRef.current = window.requestAnimationFrame(() => {
        resizeAnimationFrameRef.current = null
        if (pendingResizeWidthRef.current !== null) {
          setChatPanelWidth(pendingResizeWidthRef.current)
        }
      })
    }

    const handleMouseUp = () => {
      if (!isResizingRef.current) return
      isResizingRef.current = false
      setIsResizing(false)

      if (resizeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeAnimationFrameRef.current)
        resizeAnimationFrameRef.current = null
      }
      if (pendingResizeWidthRef.current !== null) {
        setChatPanelWidth(pendingResizeWidthRef.current)
        pendingResizeWidthRef.current = null
      }

      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (resizeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeAnimationFrameRef.current)
        resizeAnimationFrameRef.current = null
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  const handleSendMessage = async (content: string) => {
    if (!activeConversationId) {
      toast.error('Create a new conversation first.')
      return
    }

    let shouldSyncTitleFromServer = false
    setConversations((prev) =>
      prev.map((conversation) => {
        if (conversation.id !== activeConversationId) {
          return conversation
        }

        if (hasCustomConversationTitle(conversation)) {
          return conversation
        }

        const autoTitle = generateConversationTitleFromContent(content)
        shouldSyncTitleFromServer = true
        return {
          ...conversation,
          title: autoTitle,
          metadata: {
            ...(conversation.metadata || {}),
            title: autoTitle,
            titleEdited: false,
          },
        }
      })
    )

    let streamingMessageId: string | null = null
    let aiBuffer = ''
    let aiMessageVisible = false
    const toastId = toast.loading('Sending message...')

    // Optimistic UI: Add user message immediately
    const tempId = `temp-${Date.now()}`
    const tempUserMessage: Message = {
      id: tempId,
      type: 'user',
      content,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, tempUserMessage])

    setIsGenerating(true)
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      await apiService.sendMessageStream(
        content,
        // onChunk - update streaming message immediately
        (chunk: string) => {
          aiBuffer += chunk
          if (aiMessageVisible && streamingMessageId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingMessageId
                  ? { ...msg, content: msg.content + chunk, isStreaming: true }
                  : msg
              )
            )
          }
        },
        // onUserMessage - replace optimistic message with real confirmed message
        (message: Message) => {
          setMessages((prev) => 
            prev.map((msg) => 
              msg.id === tempId ? message : msg
            )
          )
        },
        // onAiStart - create placeholder for AI message with delay
        (messageId: string) => {
          streamingMessageId = messageId
          
          // Delay showing AI message for 600ms to simulate thinking/animation delay
          setTimeout(() => {
            if (!aiMessageVisible) { // Check if not already shown (e.g. by onComplete)
              aiMessageVisible = true
              const placeholderMessage: Message = {
                id: messageId,
                type: 'ai',
                content: aiBuffer, // Use buffered content
                timestamp: new Date(),
                isStreaming: true,
              }
              setMessages((prev) => [...prev, placeholderMessage])
            }
          }, 600)
        },
        // onComplete - finalize AI message, remove streaming flag
        (aiMessage: Message) => {
          setIsGenerating(false)
          const completedMessage = { ...aiMessage, isStreaming: false }
          bumpConversationActivity(activeConversationId)
          
          setMessages((prev) => {
            // Check if we have the placeholder or streaming message
            const exists = prev.some(msg => msg.id === aiMessage.id || msg.id === streamingMessageId)
            
            if (exists) {
              return prev.map((msg) =>
                (msg.id === streamingMessageId || msg.id === aiMessage.id)
                  ? completedMessage
                  : msg
              )
            } else {
              // If it doesn't exist (e.g. completed very fast before placeholder), add it
              return [...prev, completedMessage]
            }
          })
          
          aiMessageVisible = true
          streamingMessageId = null
          toast.success('Message received', { id: toastId })
          if (shouldSyncTitleFromServer) {
            void syncConversationSummaryFromServer(activeConversationId)
          }
        },
        // onError
        (error: string) => {
          setIsGenerating(false)
          if (error === 'AbortError' || error.includes('aborted')) {
             toast.info('Generation stopped', { id: toastId })
             return
          }
          
          // Handle authentication errors
          if (error.includes('Unauthorized') || error.includes('401')) {
            apiService.logout()
            setIsAuthenticated(false)
            toast.error('Session expired. Please login again.', { id: toastId })
            return
          }
          
          console.error('Failed to send message:', error)
          toast.error(error, { id: toastId })
          aiMessageVisible = true // Prevent delayed show from firing
          
          // Remove incomplete streaming message if it exists
          if (streamingMessageId) {
            setMessages((prev) => prev.filter((msg) => msg.id !== streamingMessageId))
          }
          // Also remove optimistic message or mark as error (removing for now)
          setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
        },
        abortController.signal
      )
    } catch (error: any) {
      if (error.name === 'AbortError') {
         setIsGenerating(false)
         toast.info('Generation stopped', { id: toastId })
         // Leave whatever partial message exists? Or remove it?
         // Usually better to leave partial message but mark not streaming
         if (streamingMessageId) {
            setMessages(prev => prev.map(msg => 
                msg.id === streamingMessageId ? { ...msg, isStreaming: false } : msg
            ))
         }
         return
      }
      setIsGenerating(false)
      console.error('Failed to send message:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send message', { id: toastId })
      if (streamingMessageId) {
        setMessages((prev) => prev.filter((msg) => msg.id !== streamingMessageId))
      }
    }
  }

  const handleApplyToPlan = async (messageId: string) => {
    const toastId = toast.loading('Applying to plan...')

    // Find the source message for the quoted reference
    const sourceMessage = messages.find(m => m.id === messageId)

    try {
      const response = await apiService.applyToPlan(messageId)
      const incomingSections =
        response.planSections && response.planSections.length > 0
          ? response.planSections
          : [response.planSection]

      const sectionsWithSource = incomingSections.map((section) => ({
        ...section,
        sourceMessage:
          sourceMessage && section.sourceMessageId === sourceMessage.id
            ? {
                id: sourceMessage.id,
                content: sourceMessage.content,
                timestamp: sourceMessage.timestamp,
              }
            : undefined,
      }))

      setPlanSections((prev) => {
        const byId = new Map(prev.map((section) => [section.id, section]))

        sectionsWithSource.forEach((incoming) => {
          const existing = byId.get(incoming.id)
          byId.set(incoming.id, {
            ...existing,
            ...incoming,
            sourceMessage: incoming.sourceMessage ?? existing?.sourceMessage,
          })
        })

        return Array.from(byId.values()).sort((a, b) => {
          if (typeof a.phaseOrder === 'number' && typeof b.phaseOrder === 'number') {
            return a.phaseOrder - b.phaseOrder
          }
          return a.timestamp.getTime() - b.timestamp.getTime()
        })
      })

      setMessages((prev) => [...prev, response.planUpdateMessage])
      if (activeConversationId) {
        bumpConversationActivity(activeConversationId)
      }
      toast.success('Added to plan', { id: toastId })
    } catch (error) {
      console.error('Failed to apply to plan:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to apply to plan', { id: toastId })
    }
  }

  const handleRegenerate = async (messageId: string) => {
    const toastId = toast.loading('Regenerating response...')

    try {
      const response = await apiService.regenerateMessage(messageId)
      const updatedMessage = {
        ...response.message,
        timestamp: new Date(response.message.timestamp),
      }
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? updatedMessage : msg))
      )
      toast.success('Response regenerated', { id: toastId })
    } catch (error) {
      console.error('Failed to regenerate message:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to regenerate', { id: toastId })
    }
  }

  const handleLockSection = async (sectionId: string) => {
    const section = planSections.find((s) => s.id === sectionId)
    if (!section) return

    const toastId = toast.loading(section.locked ? 'Unlocking section...' : 'Locking section...')

    try {
      const response = await apiService.lockSection(sectionId, !section.locked)
      const updatedSection = {
        ...response.section,
        timestamp: new Date(response.section.timestamp),
      }
      setPlanSections((prev) =>
        prev.map((s) => (s.id === sectionId ? updatedSection : s))
      )
      toast.success(updatedSection.locked ? 'Section locked' : 'Section unlocked', { id: toastId })
    } catch (error) {
      console.error('Failed to lock section:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update section', { id: toastId })
    }
  }

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
        setIsGenerating(false)
    }
  }

  const handleLogout = () => {
    apiService.logout()
    setIsAuthenticated(false)
    setConversations([])
    setDeletedConversations([])
    setActiveConversationId(null)
    setMessages([])
    setPlanSections([])
    toast.success('Logged out successfully')
  }

  const handleSelectConversation = (conversationId: string) => {
    if (conversationId === activeConversationId) return
    if (isGenerating) {
      handleStopGeneration()
    }
    apiService.setConversationId(conversationId)
    setActiveConversationId(conversationId)
  }

  const handleNewConversation = async () => {
    if (isGenerating) {
      handleStopGeneration()
    }

    const currentConversationIsEmpty = messages.length === 0 && planSections.length === 0
    if (currentConversationIsEmpty) {
      toast.info('Current conversation is empty. Use this chat instead of creating a new one.')
      return
    }

    const existingEmptyConversation = conversations.find(
      (conversation) => conversation.id !== activeConversationId && conversation.isEmpty
    )
    if (existingEmptyConversation) {
      apiService.setConversationId(existingEmptyConversation.id)
      setActiveConversationId(existingEmptyConversation.id)
      toast.info('Switched to your existing empty conversation.')
      return
    }

    try {
      const response = await apiService.createConversation()
      upsertConversation(response.conversation)
      apiService.setConversationId(response.conversation.id)
      setActiveConversationId(response.conversation.id)
      setMessages([])
      setPlanSections([])
      toast.success('New conversation created')
    } catch (error) {
      console.error('Failed to create conversation:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create conversation')
    }
  }

  const handleDeleteConversation = async (conversationId: string) => {
    if (isGenerating) {
      handleStopGeneration()
    }

    try {
      const response = await apiService.deleteConversation(conversationId)
      const existingConversation = conversations.find((conversation) => conversation.id === conversationId)
      const deletedConversation = {
        ...response.conversation,
        deletedAt: response.conversation.deletedAt || new Date(),
        isEmpty:
          existingConversation?.isEmpty ??
          (activeConversationId === conversationId && messages.length === 0 && planSections.length === 0),
      }

      const remainingConversations = conversations
        .filter((conversation) => conversation.id !== conversationId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

      setConversations(remainingConversations)
      setDeletedConversations((prev) => [
        deletedConversation,
        ...prev.filter((conversation) => conversation.id !== conversationId),
      ])

      if (activeConversationId === conversationId) {
        if (remainingConversations.length > 0) {
          const next = remainingConversations[0]
          apiService.setConversationId(next.id)
          setActiveConversationId(next.id)
          setMessages([])
          setPlanSections([])
        } else {
          const created = await apiService.createConversation()
          setConversations([created.conversation])
          apiService.setConversationId(created.conversation.id)
          setActiveConversationId(created.conversation.id)
          setMessages([])
          setPlanSections([])
        }
      }

      toast.success('Conversation moved to recycle bin')
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete conversation')
    }
  }

  const handleRenameConversation = async (conversationId: string, title: string) => {
    try {
      const response = await apiService.updateConversationTitle(conversationId, title)
      upsertConversation(response.conversation)
      setDeletedConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId ? response.conversation : conversation
        )
      )
    } catch (error) {
      console.error('Failed to rename conversation:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to rename conversation')
      throw error
    }
  }

  const handleRestoreConversation = async (conversationId: string) => {
    await restoreDeletedConversations([conversationId], 'Conversation restored from recycle bin')
  }

  const restoreDeletedConversations = async (conversationIds: string[], successMessage: string) => {
    if (conversationIds.length === 0) {
      return
    }

    setIsRestoringDeletedConversations(true)
    try {
      const deletedById = new Map(deletedConversations.map((conversation) => [conversation.id, conversation]))
      const restoreResults = await Promise.allSettled(
        conversationIds.map((conversationId) => apiService.restoreConversation(conversationId))
      )

      const restored = restoreResults
        .filter(
          (result): result is PromiseFulfilledResult<{ conversation: ConversationSummary }> =>
            result.status === 'fulfilled'
        )
        .map((result) => result.value.conversation)

      const failedCount = restoreResults.length - restored.length
      const restoredIds = new Set(restored.map((conversation) => conversation.id))

      if (restored.length > 0) {
        setDeletedConversations((prev) =>
          prev.filter((conversation) => !restoredIds.has(conversation.id))
        )
        setConversations((prev) => {
          const merged = [
            ...restored.map((conversation) => ({
              ...conversation,
              deletedAt: undefined,
              isEmpty: deletedById.get(conversation.id)?.isEmpty ?? conversation.isEmpty,
            })),
            ...prev.filter((conversation) => !restoredIds.has(conversation.id)),
          ]
          return merged.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        })
      }

      if (restored.length > 0) {
        toast.success(
          restored.length === 1 ? successMessage : `${restored.length} conversations restored`
        )
      }
      if (failedCount > 0) {
        toast.error(
          failedCount === 1
            ? '1 conversation failed to restore'
            : `${failedCount} conversations failed to restore`
        )
      }
    } catch (error) {
      console.error('Failed to restore conversations:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to restore conversations')
    } finally {
      setIsRestoringDeletedConversations(false)
    }
  }

  const handleRestoreSelectedConversations = async (conversationIds: string[]) => {
    await restoreDeletedConversations(conversationIds, 'Conversation restored from recycle bin')
  }

  const handleRestoreAllConversations = async () => {
    await restoreDeletedConversations(
      deletedConversations.map((conversation) => conversation.id),
      'All conversations restored from recycle bin'
    )
  }

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isPlanPanelCollapsed) {
      return
    }
    event.preventDefault()
    isResizingRef.current = true
    setIsResizing(true)
    setDividerTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev))
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handleDividerMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-divider-collapse-button="true"]')) {
      if (dividerTooltip.visible) {
        setDividerTooltip((prev) => ({ ...prev, visible: false }))
      }
      return
    }

    setDividerTooltip({
      visible: true,
      x: event.clientX,
      y: event.clientY,
    })
  }

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isPlanPanelCollapsed) {
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setChatPanelWidth((prev) => clampChatPanelWidth(prev - 5))
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setChatPanelWidth((prev) => clampChatPanelWidth(prev + 5))
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setChatPanelWidth(MIN_CHAT_PANEL_WIDTH)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setChatPanelWidth(MAX_CHAT_PANEL_WIDTH)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      setChatPanelWidth(50)
    }
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />
  }

  const canCreateConversation =
    !activeConversationId || messages.length > 0 || planSections.length > 0
  const canDeleteConversation = Boolean(activeConversationId)
  const effectiveChatPanelWidth = isPlanPanelCollapsed ? null : chatPanelWidth

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Sonner Toaster */}
      <Toaster richColors position="top-right" />
      
      {/* App Menubar */}
      <AppMenubar
        onLogout={handleLogout}
        onNewConversation={handleNewConversation}
        onDeleteConversation={() => {
          if (activeConversationId) {
            handleDeleteConversation(activeConversationId)
          }
        }}
        onTogglePlanPanel={() => setIsPlanPanelCollapsed((prev) => !prev)}
        onSelectConversation={handleSelectConversation}
        conversations={conversations}
        activeConversationId={activeConversationId}
        canCreateConversation={canCreateConversation}
        canDeleteConversation={canDeleteConversation}
        isPlanPanelCollapsed={isPlanPanelCollapsed}
      />
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <ConversationSidebar
          conversations={conversations}
          deletedConversations={deletedConversations}
          activeConversationId={activeConversationId}
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onRenameConversation={handleRenameConversation}
          onDeleteConversation={handleDeleteConversation}
          onRestoreConversation={handleRestoreConversation}
          onRestoreSelectedConversations={handleRestoreSelectedConversations}
          onRestoreAllConversations={handleRestoreAllConversations}
          canCreateConversation={canCreateConversation}
          isRestoringDeletedConversations={isRestoringDeletedConversations}
        />

        <div ref={mainContentRef} className="relative flex min-w-0 flex-1 overflow-hidden">
          {/* Chat Panel */}
          <div
            className={`h-full min-w-0 ${
              isResizing ? '' : 'transition-[width] duration-150 ease-out'
            } ${isPlanPanelCollapsed ? 'flex-1' : 'border-r border-border'}`}
            style={effectiveChatPanelWidth === null ? undefined : { width: `${effectiveChatPanelWidth}%` }}
          >
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              onApplyToPlan={handleApplyToPlan}
              onRegenerate={handleRegenerate}
              isGenerating={isGenerating}
              onStop={handleStopGeneration}
            />
          </div>

          {!isPlanPanelCollapsed && (
            <>
              <div
                className="group relative z-10 w-2 shrink-0 cursor-col-resize bg-muted/40 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/60"
                role="separator"
                tabIndex={0}
                aria-label="Resize AI chat and plan draft panels"
                aria-orientation="vertical"
                aria-valuemin={MIN_CHAT_PANEL_WIDTH}
                aria-valuemax={MAX_CHAT_PANEL_WIDTH}
                aria-valuenow={Math.round(chatPanelWidth)}
                onMouseDown={handleResizeStart}
                onMouseEnter={handleDividerMouseMove}
                onMouseMove={handleDividerMouseMove}
                onMouseLeave={() =>
                  setDividerTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev))
                }
                onKeyDown={handleResizeKeyDown}
                onDoubleClick={() => setChatPanelWidth(50)}
              >
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-primary/50" />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setIsPlanPanelCollapsed(true)
                  }}
                  onMouseEnter={() =>
                    setDividerTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev))
                  }
                  data-divider-collapse-button="true"
                  className="group/collapse absolute left-1/2 top-1/2 z-20 flex h-10 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-all duration-150 hover:border-primary/40 hover:bg-accent/70 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label="Collapse plan pane"
                  title="Collapse plan pane"
                >
                  <PanelRightClose className="h-4 w-4" />
                  <span className="pointer-events-none absolute -left-2 top-1/2 -translate-x-full -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground opacity-0 shadow-sm transition-opacity duration-150 group-hover/collapse:opacity-100">
                    Collapse Plan
                  </span>
                </button>
              </div>

              {/* Plan Panel */}
              <div className="h-full min-w-0 flex-1">
                <PlanDraftPanel
                  sections={planSections}
                  onLockSection={handleLockSection}
                  conversationId={activeConversationId || 'default'}
                />
              </div>
            </>
          )}

          {isPlanPanelCollapsed && (
            <button
              type="button"
              onClick={() => setIsPlanPanelCollapsed(false)}
              className="group absolute right-2 top-1/2 z-20 flex h-10 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-all duration-150 hover:border-primary/40 hover:bg-accent/70 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Expand plan pane"
              title="Expand plan pane"
            >
              <PanelRightOpen className="h-4 w-4" />
              <span className="pointer-events-none absolute -left-2 top-1/2 -translate-x-full -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
                Expand Plan
              </span>
            </button>
          )}

          {dividerTooltip.visible && (
            <span
              className="pointer-events-none fixed z-40 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground shadow-sm"
              style={{
                left: dividerTooltip.x,
                top: dividerTooltip.y + 14,
                transform: 'translateX(-50%)',
              }}
            >
              Resize panes
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
