import { useState, useEffect } from 'react'
import { Message } from '../types'
import TypingIndicator from './TypingIndicator'
import ThinkingDots from './ThinkingDots'
import TypewriterText from './TypewriterText'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, FileText, User, Bot, Info, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  message: Message
  onApplyToPlan: (messageId: string) => void
  onRegenerate: (messageId: string) => void
}

export default function MessageBubble({
  message,
  onApplyToPlan,
  onRegenerate,
}: MessageBubbleProps) {
  const isUser = message.type === 'user'
  const isAI = message.type === 'ai' || message.type === 'assistant'
  const isSystem = message.type === 'system'
  const isPlanUpdate = message.type === 'plan_update'
  const isStreaming = message.isStreaming || false

  // Local state to force "thinking" dots for a minimum time
  // This ensures the user sees the dots even if the AI responds quickly
  const [forcedThinking, setForcedThinking] = useState(false)

  useEffect(() => {
    // Only trigger if this is a fresh streaming message starting empty
    if (isAI && isStreaming && !message.content) {
      setForcedThinking(true)
      const timer = setTimeout(() => {
        setForcedThinking(false)
      }, 1000) // 1s visual thinking time
      return () => clearTimeout(timer)
    }
  }, [])

  const getIcon = () => {
    if (isUser) return <User className="h-4 w-4" />
    if (isAI) return <Bot className="h-4 w-4" />
    if (isSystem) return <Info className="h-4 w-4" />
    if (isPlanUpdate) return <CheckCircle className="h-4 w-4" />
    return null
  }

  const getBadgeVariant = () => {
    if (isUser) return 'default'
    if (isAI) return 'secondary'
    if (isSystem) return 'warning'
    if (isPlanUpdate) return 'success'
    return 'outline'
  }

  const getLabel = () => {
    if (isUser) return 'You'
    if (isAI) return 'AI'
    if (isSystem) return 'System'
    if (isPlanUpdate) return 'Plan Update'
    return ''
  }

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <Card className={cn(
        "max-w-[80%] border shadow-sm transition-all hover:shadow-md",
        isUser && "bg-primary text-primary-foreground border-primary",
        isAI && "bg-card",
        isSystem && "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20",
        isPlanUpdate && "bg-green-50 border-green-200 dark:bg-green-900/20"
      )}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={getBadgeVariant()} className="gap-1">
              {getIcon()}
              {getLabel()}
            </Badge>
          </div>
          <div className={cn(
            "whitespace-pre-wrap text-sm",
            isUser && "text-primary-foreground",
            !isUser && "text-foreground"
          )}>
            {isAI && isStreaming && (forcedThinking || !message.content) ? (
              <ThinkingDots />
            ) : (
              <>
                {isAI ? (
                  <TypewriterText content={message.content} isStreaming={true} speed={5} />
                ) : (
                  <TypewriterText content={message.content} isStreaming={false} />
                )}
                {isStreaming && <TypingIndicator />}
              </>
            )}
          </div>
          {!isStreaming && (
            <div className={cn(
              "text-xs mt-2",
              isUser ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {message.timestamp.toLocaleTimeString()}
            </div>
          )}
          {isAI && !isStreaming && (
            <div className="flex gap-2 mt-3 pt-2 border-t border-border/40">
              <Button
                size="sm"
                variant="default"
                onClick={() => onApplyToPlan(message.id)}
                className="h-8 gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                Apply to Plan
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onRegenerate(message.id)}
                className="h-8 gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
