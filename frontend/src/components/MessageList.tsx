import { Message } from '../types'
import MessageBubble from './MessageBubble'

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
  return (
    <div className="p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="text-center text-gray-500 mt-8">
          Start a conversation...
        </div>
      ) : (
        messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onApplyToPlan={onApplyToPlan}
            onRegenerate={onRegenerate}
          />
        ))
      )}
    </div>
  )
}
