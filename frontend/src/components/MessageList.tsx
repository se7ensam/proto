import { useEffect, useRef } from 'react'
import { Message } from '../types'
import MessageBubble from './MessageBubble'
import { MessageSquareDashed } from 'lucide-react'
import { motion } from 'framer-motion'

interface MessageListProps {
  messages: Message[]
  onApplyToPlan: (messageId: string) => void
  onRegenerate: (messageId: string) => void
}

export default function MessageList({
  messages,
  onApplyToPlan,
  onRegenerate,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="h-full">
      <div className="p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground mt-16">
            <MessageSquareDashed className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm">Start a conversation to begin...</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ 
                  opacity: 0, 
                  y: 10, 
                  scale: 0.95,
                }}
                animate={{ 
                  opacity: 1, 
                  y: 0, 
                  scale: 1,
                }}
                transition={{ 
                  duration: 0.2, 
                  ease: "easeOut" 
                }}
                className="w-full"
              >
                <MessageBubble
                  message={message}
                  onApplyToPlan={onApplyToPlan}
                  onRegenerate={onRegenerate}
                />
              </motion.div>
            ))}
            {/* Create a separate div for scrolling anchor so it doesn't interfere with flex/grid layouts if changed later */}
            <div ref={messagesEndRef} className="h-px w-full" />
          </>
        )}

      </div>
    </div>
  )
}
