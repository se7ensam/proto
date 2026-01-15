import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PlanSectionItem from '@/components/PlanSectionItem'
import { PlanSection } from '@/types'

const createSection = (overrides: Partial<PlanSection> = {}): PlanSection => ({
  id: 'section-1',
  content: 'Test section content',
  locked: false,
  timestamp: new Date('2024-01-01T12:00:00'),
  ...overrides,
})

describe('PlanSectionItem Component', () => {
  it('renders section content', () => {
    render(
      <PlanSectionItem
        section={createSection({ content: 'My plan section' })}
        onLockSection={vi.fn()}
      />
    )
    
    expect(screen.getByText('My plan section')).toBeInTheDocument()
  })

  it('shows lock button when section is unlocked', () => {
    render(
      <PlanSectionItem
        section={createSection({ locked: false })}
        onLockSection={vi.fn()}
      />
    )
    
    expect(screen.getByRole('button', { name: /lock section/i })).toBeInTheDocument()
  })

  it('shows unlock button when section is locked', () => {
    render(
      <PlanSectionItem
        section={createSection({ locked: true })}
        onLockSection={vi.fn()}
      />
    )
    
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument()
  })

  it('shows locked badge when section is locked', () => {
    render(
      <PlanSectionItem
        section={createSection({ locked: true })}
        onLockSection={vi.fn()}
      />
    )
    
    expect(screen.getByText('Locked')).toBeInTheDocument()
  })

  it('does not show locked badge when section is unlocked', () => {
    render(
      <PlanSectionItem
        section={createSection({ locked: false })}
        onLockSection={vi.fn()}
      />
    )
    
    expect(screen.queryByText('Locked')).not.toBeInTheDocument()
  })

  it('calls onLockSection when lock button is clicked', () => {
    const onLockSection = vi.fn()
    render(
      <PlanSectionItem
        section={createSection({ id: 'section-abc', locked: false })}
        onLockSection={onLockSection}
      />
    )
    
    fireEvent.click(screen.getByRole('button', { name: /lock section/i }))
    expect(onLockSection).toHaveBeenCalledWith('section-abc')
  })

  it('calls onLockSection when unlock button is clicked', () => {
    const onLockSection = vi.fn()
    render(
      <PlanSectionItem
        section={createSection({ id: 'section-xyz', locked: true })}
        onLockSection={onLockSection}
      />
    )
    
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
    expect(onLockSection).toHaveBeenCalledWith('section-xyz')
  })

  it('displays timestamp', () => {
    render(
      <PlanSectionItem
        section={createSection({ timestamp: new Date('2024-01-01T12:00:00') })}
        onLockSection={vi.fn()}
      />
    )
    
    // Check timestamp is displayed (format depends on locale)
    expect(screen.getByText(/1\/1\/2024/)).toBeInTheDocument()
  })
})
