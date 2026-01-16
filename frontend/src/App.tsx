import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import ChatPanel from './components/ChatPanel'
import PlanDraftPanel from './components/PlanDraftPanel'
import { Message, PlanSection } from './types'
import { apiService } from './services/api'
import { AppMenubar } from './components/AppMenubar'

import LoginPage from './components/LoginPage'

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [planSections, setPlanSections] = useState<PlanSection[]>([])
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('auth_token'))
  const [isGenerating, setIsGenerating] = useState(false)
  const abortControllerRef = (useRef<AbortController | null>(null)) as React.MutableRefObject<AbortController | null>

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [historyRes, planRes] = await Promise.all([
          apiService.getConversationHistory(),
          apiService.getPlanSections(),
        ])
        setMessages(historyRes.messages)
        setPlanSections(planRes.sections)
      } catch (error) {
        console.error('Failed to load initial data:', error)
      }
    }
    loadData()
  }, [])

  const handleSendMessage = async (content: string) => {
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
        },
        // onError
        (error: string) => {
          setIsGenerating(false)
          if (error === 'AbortError' || error.includes('aborted')) {
             toast.info('Generation stopped', { id: toastId })
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
      const planSection = {
        ...response.planSection,
        timestamp: new Date(response.planSection.timestamp),
        // Add source message reference for WhatsApp-style quoting
        sourceMessage: sourceMessage ? {
          id: sourceMessage.id,
          content: sourceMessage.content,
          timestamp: sourceMessage.timestamp,
        } : undefined,
      }
      const planUpdateMessage = {
        ...response.planUpdateMessage,
        timestamp: new Date(response.planUpdateMessage.timestamp),
      }
      setPlanSections((prev) => [...prev, planSection])
      setMessages((prev) => [...prev, planUpdateMessage])
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
    toast.success('Logged out successfully')
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Sonner Toaster */}
      <Toaster richColors position="top-right" />
      
      {/* App Menubar */}
      <AppMenubar onLogout={handleLogout} />
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Panel */}
        <div className="w-1/2 border-r border-border">
          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            onApplyToPlan={handleApplyToPlan}
            onRegenerate={handleRegenerate}
            isGenerating={isGenerating}
            onStop={handleStopGeneration}
          />
        </div>
        
        {/* Plan Panel */}
        <div className="w-1/2">
          <PlanDraftPanel
            sections={planSections}
            onLockSection={handleLockSection}
          />
        </div>
      </div>
    </div>
  )
}

export default App
