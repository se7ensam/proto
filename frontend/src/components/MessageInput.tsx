import { useState, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send } from 'lucide-react'

interface MessageInputProps {
  onSendMessage: (content: string) => void
}

export default function MessageInput({ onSendMessage }: MessageInputProps) {
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
    <div className="p-4 border-t bg-card">
      <div className="flex gap-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
          className="flex-1 min-h-[80px] resize-none"
          rows={3}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim()}
          size="lg"
          className="px-6 h-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
