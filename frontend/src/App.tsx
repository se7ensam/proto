import { useState, useEffect } from 'react'
import ChatPanel from './components/ChatPanel'
import PlanDraftPanel from './components/PlanDraftPanel'
import { Message, PlanSection } from './types'
import { apiService } from './services/api'

import LoginPage from './components/LoginPage'

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [planSections, setPlanSections] = useState<PlanSection[]>([])
  const [loading, setLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('auth_token'))

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
    setLoading(true)

    let streamingMessageId: string | null = null

    try {
      await apiService.sendMessageStream(
        content,
        // onChunk - update streaming message immediately
        (chunk: string) => {
          if (streamingMessageId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingMessageId
                  ? { ...msg, content: msg.content + chunk, isStreaming: true }
                  : msg
              )
            )
          }
        },
        // onUserMessage - add user message
        (message: Message) => {
          setMessages((prev) => [...prev, message])
        },
        // onAiStart - create placeholder for AI message with streaming flag
        (messageId: string) => {
          streamingMessageId = messageId
          const placeholderMessage: Message = {
            id: messageId,
            type: 'ai',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
          }
          setMessages((prev) => [...prev, placeholderMessage])
        },
        // onComplete - finalize AI message, remove streaming flag
        (aiMessage: Message) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === streamingMessageId
                ? { ...aiMessage, isStreaming: false }
                : msg
            )
          )
          streamingMessageId = null
          setLoading(false)
        },
        // onError
        (error: string) => {
          console.error('Failed to send message:', error)
          alert(error)
          setLoading(false)
          // Remove incomplete streaming message if it exists
          if (streamingMessageId) {
            setMessages((prev) => prev.filter((msg) => msg.id !== streamingMessageId))
          }
        }
      )
    } catch (error) {
      console.error('Failed to send message:', error)
      alert(error instanceof Error ? error.message : 'Failed to send message')
      setLoading(false)
      if (streamingMessageId) {
        setMessages((prev) => prev.filter((msg) => msg.id !== streamingMessageId))
      }
    }
  }

  const handleApplyToPlan = async (messageId: string) => {
    try {
      const response = await apiService.applyToPlan(messageId)
      const planSection = {
        ...response.planSection,
        timestamp: new Date(response.planSection.timestamp),
      }
      const planUpdateMessage = {
        ...response.planUpdateMessage,
        timestamp: new Date(response.planUpdateMessage.timestamp),
      }
      setPlanSections((prev) => [...prev, planSection])
      setMessages((prev) => [...prev, planUpdateMessage])
    } catch (error) {
      console.error('Failed to apply to plan:', error)
      alert(error instanceof Error ? error.message : 'Failed to apply to plan')
    }
  }

  const handleRegenerate = async (messageId: string) => {
    setLoading(true)
    try {
      const response = await apiService.regenerateMessage(messageId)
      const updatedMessage = {
        ...response.message,
        timestamp: new Date(response.message.timestamp),
      }
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? updatedMessage : msg))
      )
    } catch (error) {
      console.error('Failed to regenerate message:', error)
      alert(error instanceof Error ? error.message : 'Failed to regenerate message')
    } finally {
      setLoading(false)
    }
  }

  const handleLockSection = async (sectionId: string) => {
    const section = planSections.find((s) => s.id === sectionId)
    if (!section) return

    try {
      const response = await apiService.lockSection(sectionId, !section.locked)
      const updatedSection = {
        ...response.section,
        timestamp: new Date(response.section.timestamp),
      }
      setPlanSections((prev) =>
        prev.map((s) => (s.id === sectionId ? updatedSection : s))
      )
    } catch (error) {
      console.error('Failed to lock section:', error)
      alert(error instanceof Error ? error.message : 'Failed to lock section')
    }
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />
  }

  return (
    <div className="flex h-screen bg-gray-50 relative">
      {loading && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-lg z-50">
          Loading...
        </div>
      )}
      <div className="w-1/2 border-r border-gray-200">
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          onApplyToPlan={handleApplyToPlan}
          onRegenerate={handleRegenerate}
        />
      </div>
      <div className="w-1/2">
        <PlanDraftPanel
          sections={planSections}
          onLockSection={handleLockSection}
        />
      </div>
      <div className="absolute top-4 right-4 z-10">
        <button onClick={() => {
          apiService.logout();
          setIsAuthenticated(false);
        }} className="text-xs text-gray-500 hover:text-gray-700">Logout</button>
      </div>
    </div>
  )
}

export default App
