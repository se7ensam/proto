import { useState, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ArrowUp, Square } from 'lucide-react'

interface MessageInputProps {
  onSendMessage: (content: string) => void
  isGenerating?: boolean
  onStop?: () => void
}

export default function MessageInput({ onSendMessage, isGenerating, onStop }: MessageInputProps) {
  const [input, setInput] = useState('')

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim())
      setInput('')
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t bg-background px-4 py-3">
      <div className="rounded-2xl border border-border bg-background px-3 py-2">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message..."
            className="min-h-[56px] flex-1 resize-none border-0 bg-transparent px-1 py-1 text-sm shadow-none focus-visible:ring-0"
            rows={2}
            disabled={isGenerating}
          />
          {isGenerating ? (
            <Button
              onClick={onStop}
              size="icon"
              variant="destructive"
              className="h-9 w-9 rounded-xl"
              aria-label="Stop generation"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!input.trim()}
              size="icon"
              className="h-9 w-9 rounded-xl"
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="mt-1 px-1 text-[11px] text-muted-foreground">
          Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  )
}
