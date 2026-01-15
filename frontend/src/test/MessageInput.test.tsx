import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MessageInput from '@/components/MessageInput'

describe('MessageInput Component', () => {
  it('renders textarea and send button', () => {
    render(<MessageInput onSendMessage={vi.fn()} />)
    
    expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    render(<MessageInput onSendMessage={vi.fn()} />)
    
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('send button is enabled when input has text', () => {
    render(<MessageInput onSendMessage={vi.fn()} />)
    
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } })
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('calls onSendMessage when button is clicked', () => {
    const handleSend = vi.fn()
    render(<MessageInput onSendMessage={handleSend} />)
    
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button'))
    
    expect(handleSend).toHaveBeenCalledWith('Hello')
  })

  it('clears input after sending message', () => {
    render(<MessageInput onSendMessage={vi.fn()} />)
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button'))
    
    expect(textarea.value).toBe('')
  })

  it('sends message on Enter key press', () => {
    const handleSend = vi.fn()
    render(<MessageInput onSendMessage={handleSend} />)
    
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
    
    expect(handleSend).toHaveBeenCalledWith('Hello')
  })

  it('does not send on Shift+Enter (allows new line)', () => {
    const handleSend = vi.fn()
    render(<MessageInput onSendMessage={handleSend} />)
    
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: true })
    
    expect(handleSend).not.toHaveBeenCalled()
  })

  it('trims whitespace from message', () => {
    const handleSend = vi.fn()
    render(<MessageInput onSendMessage={handleSend} />)
    
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Hello World  ' } })
    fireEvent.click(screen.getByRole('button'))
    
    expect(handleSend).toHaveBeenCalledWith('Hello World')
  })
})
