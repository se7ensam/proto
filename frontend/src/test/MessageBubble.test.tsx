import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MessageBubble from '@/components/MessageBubble'
import { Message } from '@/types'

const createMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'test-id',
  type: 'user',
  content: 'Test message',
  timestamp: new Date('2024-01-01T12:00:00'),
  ...overrides,
})

describe('MessageBubble Component', () => {
  const defaultProps = {
    onApplyToPlan: vi.fn(),
    onRegenerate: vi.fn(),
  }

  it('renders user message correctly', () => {
    render(
      <MessageBubble
        message={createMessage({ type: 'user', content: 'Hello from user' })}
        {...defaultProps}
      />
    )
    
    expect(screen.getByText('Hello from user')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('renders AI message correctly', () => {
    render(
      <MessageBubble
        message={createMessage({ type: 'ai', content: 'AI response' })}
        {...defaultProps}
      />
    )
    
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('renders system message correctly', () => {
    render(
      <MessageBubble
        message={createMessage({ type: 'system', content: 'System notification' })}
        {...defaultProps}
      />
    )
    
    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('System notification')).toBeInTheDocument()
  })

  it('renders plan update message correctly', () => {
    render(
      <MessageBubble
        message={createMessage({ type: 'plan_update', content: 'Plan updated' })}
        {...defaultProps}
      />
    )
    
    expect(screen.getByText('Plan Update')).toBeInTheDocument()
  })

  it('shows action buttons for AI messages', () => {
    render(
      <MessageBubble
        message={createMessage({ type: 'ai', content: 'AI response' })}
        {...defaultProps}
      />
    )
    
    expect(screen.getByRole('button', { name: /apply to plan/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument()
  })

  it('does not show action buttons for user messages', () => {
    render(
      <MessageBubble
        message={createMessage({ type: 'user', content: 'User message' })}
        {...defaultProps}
      />
    )
    
    expect(screen.queryByRole('button', { name: /apply to plan/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /regenerate/i })).not.toBeInTheDocument()
  })

  it('hides action buttons when streaming', () => {
    render(
      <MessageBubble
        message={createMessage({ type: 'ai', content: 'Streaming...', isStreaming: true })}
        {...defaultProps}
      />
    )
    
    expect(screen.queryByRole('button', { name: /apply to plan/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /regenerate/i })).not.toBeInTheDocument()
  })

  it('calls onApplyToPlan when Apply to Plan button is clicked', () => {
    const onApplyToPlan = vi.fn()
    render(
      <MessageBubble
        message={createMessage({ id: 'msg-123', type: 'ai', content: 'AI response' })}
        onApplyToPlan={onApplyToPlan}
        onRegenerate={vi.fn()}
      />
    )
    
    fireEvent.click(screen.getByRole('button', { name: /apply to plan/i }))
    expect(onApplyToPlan).toHaveBeenCalledWith('msg-123')
  })

  it('calls onRegenerate when Regenerate button is clicked', () => {
    const onRegenerate = vi.fn()
    render(
      <MessageBubble
        message={createMessage({ id: 'msg-456', type: 'ai', content: 'AI response' })}
        onApplyToPlan={vi.fn()}
        onRegenerate={onRegenerate}
      />
    )
    
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }))
    expect(onRegenerate).toHaveBeenCalledWith('msg-456')
  })

  it('displays timestamp', () => {
    render(
      <MessageBubble
        message={createMessage({ timestamp: new Date('2024-01-01T12:00:00') })}
        {...defaultProps}
      />
    )
    
    // The timestamp format depends on locale, just check it's present
    expect(screen.getByText(/12:00/)).toBeInTheDocument()
  })
})
