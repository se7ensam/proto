import { useEffect, useRef, useState } from 'react'
import { Message } from '../types'
import MessageBubble from './MessageBubble'
import { MessageSquareDashed, ArrowDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'

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
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const isProgrammaticScroll = useRef(false)

  // Check if user is at bottom on scroll
  const handleScroll = () => {
    if (!scrollRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    
    // Consider "at bottom" if within 100px
    const atBottom = distanceFromBottom < 100
    
    // If we are programmatically scrolling, we assume we want to be at bottom
    // so we don't let temporary scroll positions during animation set it to false.
    // However, if we actually *reach* the bottom, we ensure it's recorded.
    if (isProgrammaticScroll.current) {
        if (atBottom) {
             setIsAtBottom(true)
             setShowScrollButton(false)
        }
        return
    }

    setIsAtBottom(atBottom)
    setShowScrollButton(!atBottom)
  }

  // Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  // Handle explicit user scroll request
  const handleScrollToBottom = () => {
    setIsAtBottom(true)
    setShowScrollButton(false) // Optimistically hide
    isProgrammaticScroll.current = true
    scrollToBottom('smooth')
    
    // Reset programmatic flag after acceptable animation duration
    // Browser smooth scroll duration is variable but usually < 1000ms
    setTimeout(() => {
        isProgrammaticScroll.current = false
        // Re-check just in case
        handleScroll()
    }, 1000)
  }

  // Auto-scroll logic
  useEffect(() => {
    if (messages.length === 0) return

    // If we are already at the bottom (or very close), auto-scroll to the new message
    if (isAtBottom) {
       // Use "auto" (instant) scrolling for updates to ensure we stay stuck to the bottom
       // without fighting pending smooth scroll animations.
       scrollToBottom('auto')
    }
  }, [messages, isAtBottom])

  // Initial scroll
  useEffect(() => {
    scrollToBottom('auto')
  }, [])

  return (
    <div className="relative h-full w-full">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-auto px-4"
      >
        <div className="space-y-4 pb-20 pt-4">
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
              {/* Anchor for scrolling */}
              <div ref={messagesEndRef} className="h-px w-full" />
            </>
          )}
        </div>
      </div>

      {/* Floating Scroll to Bottom Button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 right-4 z-10"
          >
            <Button
              size="icon"
              variant="secondary"
              className="h-10 w-10 rounded-full shadow-md hover:shadow-lg border bg-background/80 backdrop-blur-sm"
              onClick={handleScrollToBottom}
            >
              <ArrowDown className="h-5 w-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
