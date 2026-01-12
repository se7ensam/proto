import { useState, useEffect } from 'react'
import ChatPanel from './components/ChatPanel'
import PlanDraftPanel from './components/PlanDraftPanel'
import { Message, PlanSection } from './types'
import { apiService } from './services/api'

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [planSections, setPlanSections] = useState<PlanSection[]>([])
  const [loading, setLoading] = useState(false)

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
    try {
      const response = await apiService.sendMessage(content)
      // Convert timestamp strings to Date objects
      const userMessage = {
        ...response.userMessage,
        timestamp: new Date(response.userMessage.timestamp),
      }
      const aiMessage = {
        ...response.aiMessage,
        timestamp: new Date(response.aiMessage.timestamp),
      }
      setMessages((prev) => [...prev, userMessage, aiMessage])
    } catch (error) {
      console.error('Failed to send message:', error)
      alert(error instanceof Error ? error.message : 'Failed to send message')
    } finally {
      setLoading(false)
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

  return (
    <div className="flex h-screen bg-gray-50">
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
    </div>
  )
}

export default App
