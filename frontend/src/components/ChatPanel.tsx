import MessageList from './MessageList'
import MessageInput from './MessageInput'
import { Message } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare } from 'lucide-react'

interface ChatPanelProps {
  messages: Message[]
  onSendMessage: (content: string) => void
  onApplyToPlan: (messageId: string) => void
  onRegenerate: (messageId: string) => void
}

export default function ChatPanel({
  messages,
  onSendMessage,
  onApplyToPlan,
  onRegenerate,
}: ChatPanelProps) {
  return (
    <Card className="flex flex-col h-full rounded-none border-0 border-r">
      <CardHeader className="border-b bg-muted/50 py-4">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <MessageSquare className="h-5 w-5 text-primary" />
          AI Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <MessageList
            messages={messages}
            onApplyToPlan={onApplyToPlan}
            onRegenerate={onRegenerate}
          />
        </div>
        <MessageInput onSendMessage={onSendMessage} />
      </CardContent>
    </Card>
  )
}
