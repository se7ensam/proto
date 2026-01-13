import { Message } from '../types'
import TypingIndicator from './TypingIndicator'
import TypewriterText from './TypewriterText'

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
  const isAI = message.type === 'ai'
  const isSystem = message.type === 'system'
  const isPlanUpdate = message.type === 'plan_update'
  const isStreaming = message.isStreaming || false

  const getBubbleStyles = () => {
    if (isUser) {
      return 'bg-blue-500 text-white ml-auto'
    }
    if (isAI) {
      return 'bg-gray-100 text-gray-800 mr-auto'
    }
    if (isSystem) {
      return 'bg-yellow-50 text-yellow-800 mx-auto border border-yellow-200'
    }
    if (isPlanUpdate) {
      return 'bg-green-50 text-green-800 mx-auto border border-green-200'
    }
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-lg p-3 ${getBubbleStyles()}`}>
        <div className="text-sm font-medium mb-1">
          {isUser && 'You'}
          {isAI && 'AI'}
          {isSystem && 'System'}
          {isPlanUpdate && 'Plan Update'}
        </div>
        <div className="whitespace-pre-wrap">
          {isAI ? (
            <TypewriterText content={message.content} isStreaming={isStreaming} />
          ) : (
            message.content
          )}
          {isStreaming && <TypingIndicator />}
        </div>
        {!isStreaming && (
          <div className="text-xs opacity-70 mt-2">
            {message.timestamp.toLocaleTimeString()}
          </div>
        )}
        {isAI && !isStreaming && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onApplyToPlan(message.id)}
              className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
            >
              Apply to Plan
            </button>
            <button
              onClick={() => onRegenerate(message.id)}
              className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
            >
              Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
