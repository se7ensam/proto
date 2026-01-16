import { describe, it, expect, beforeEach } from 'vitest'
import type { Redis } from 'ioredis'
import RedisMock from 'ioredis-mock'
import { ContextService } from './context.service'
import { Message, PlanSection } from '../types'

describe('ContextService', () => {
  let service: ContextService
  let redis: Redis

  beforeEach(async () => {
    redis = new (RedisMock as unknown as { new (): Redis })()
    service = new ContextService(redis)
    await redis.flushall()
  })

  it('adds a message and returns updated context', async () => {
    const message: Message = {
      id: '1',
      type: 'user',
      content: 'Hello',
      timestamp: new Date(),
    }

    const context = await service.addMessageAndGetContext('conv-1', message)

    expect(context.messages).toHaveLength(1)
    expect(context.messages[0].content).toBe('Hello')
  })

  it('updates a message and returns it', async () => {
    const message: Message = {
      id: '1',
      type: 'ai',
      content: 'Old',
      timestamp: new Date(),
    }

    await service.addMessage('conv-1', message)
    const updated = await service.updateMessage('conv-1', '1', { content: 'New' })

    expect(updated).not.toBeNull()
    expect(updated?.content).toBe('New')
  })

  it('returns null when updating a missing message', async () => {
    const updated = await service.updateMessage('conv-1', 'missing', { content: 'New' })
    expect(updated).toBeNull()
  })

  it('updates plan section fields when present', async () => {
    const section: PlanSection = {
      id: 's1',
      content: 'Plan',
      locked: false,
      timestamp: new Date(),
    }

    await service.addPlanSection('conv-1', section)
    const updated = await service.updatePlanSection('conv-1', 's1', { locked: true })

    expect(updated).toBe(true)
    const sections = await service.getPlanSections('conv-1')
    expect(sections[0].locked).toBe(true)
  })
})
