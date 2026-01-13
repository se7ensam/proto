import MessageList from './MessageList'
import MessageInput from './MessageInput'
import { Message } from '../types'

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
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-semibold text-gray-800">AI Chat</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <MessageList
          messages={messages}
          onApplyToPlan={onApplyToPlan}
          onRegenerate={onRegenerate}
        />
      </div>
      <MessageInput onSendMessage={onSendMessage} />
    </div>
  )
}
