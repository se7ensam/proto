import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

describe('Button Component', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('renders with different variants', () => {
    const { rerender } = render(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-secondary')
    
    rerender(<Button variant="destructive">Destructive</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-destructive')
    
    rerender(<Button variant="outline">Outline</Button>)
    expect(screen.getByRole('button')).toHaveClass('border')
  })

  it('handles click events', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('can be disabled', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

describe('Input Component', () => {
  it('renders input element', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('handles value changes', () => {
    const handleChange = vi.fn()
    render(<Input onChange={handleChange} />)
    
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    expect(handleChange).toHaveBeenCalled()
  })

  it('supports different types', () => {
    render(<Input type="email" data-testid="email-input" />)
    expect(screen.getByTestId('email-input')).toHaveAttribute('type', 'email')
  })
})

describe('Textarea Component', () => {
  it('renders textarea element', () => {
    render(<Textarea placeholder="Enter message" />)
    expect(screen.getByPlaceholderText('Enter message')).toBeInTheDocument()
  })

  it('handles value changes', () => {
    const handleChange = vi.fn()
    render(<Textarea onChange={handleChange} />)
    
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test message' } })
    expect(handleChange).toHaveBeenCalled()
  })
})

describe('Card Component', () => {
  it('renders card with header and content', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
        </CardHeader>
        <CardContent>Card content</CardContent>
      </Card>
    )
    
    expect(screen.getByText('Test Card')).toBeInTheDocument()
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })
})

describe('Badge Component', () => {
  it('renders with default variant', () => {
    render(<Badge>Default</Badge>)
    expect(screen.getByText('Default')).toBeInTheDocument()
  })

  it('renders with different variants', () => {
    const { rerender } = render(<Badge variant="secondary">Secondary</Badge>)
    expect(screen.getByText('Secondary')).toHaveClass('bg-secondary')
    
    rerender(<Badge variant="destructive">Destructive</Badge>)
    expect(screen.getByText('Destructive')).toHaveClass('bg-destructive')
    
    rerender(<Badge variant="success">Success</Badge>)
    expect(screen.getByText('Success')).toHaveClass('bg-green-100')
  })
})

describe('Alert Component', () => {
  it('renders alert with description', () => {
    render(
      <Alert>
        <AlertDescription>Alert message</AlertDescription>
      </Alert>
    )
    
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Alert message')).toBeInTheDocument()
  })

  it('renders with destructive variant', () => {
    render(
      <Alert variant="destructive">
        <AlertDescription>Error message</AlertDescription>
      </Alert>
    )
    
    expect(screen.getByRole('alert')).toHaveClass('border-destructive/50')
  })
})
