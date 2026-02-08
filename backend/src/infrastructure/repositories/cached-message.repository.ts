/**
 * Cached Message Repository with Redis-first, PostgreSQL-fallback strategy
 * 
 * Strategy:
 * 1. Writes go to both Redis (with TTL) and PostgreSQL (eventually)
 * 2. Reads come from Redis if available, otherwise PostgreSQL
 * 3. Background job syncs Redis → PostgreSQL after 15-20 mins
 * 4. On login, load from PostgreSQL → populate Redis
 */

import { IMessageRepository } from '../../domain/repositories'
import { Message } from '../../domain/types'
import { MessageRepository } from './message.repository'
import { RedisClient } from '../redis'
import { DatabaseError } from '../../domain/errors'

export class CachedMessageRepository implements IMessageRepository {
  constructor(
    private pgRepo: MessageRepository,
    private redis: RedisClient
  ) {}

  /**
   * Create message - write to Redis immediately, PostgreSQL in background
   */
  async create(message: Omit<Message, 'id' | 'timestamp'> & { id?: string }): Promise<Message> {
    // Create in PostgreSQL first to get ID and timestamp
    const created = await this.pgRepo.create(message)
    
    // Add to user's Redis cache asynchronously (don't block)
    this.redis.addUserMessage(created.userId, created).catch((err) => {
      console.error('Failed to cache message in Redis:', err)
      // Don't throw - Redis is cache, PostgreSQL is source of truth
    })
    
    return created
  }

  /**
   * Find by ID - check Redis first, then PostgreSQL
   */
  async findById(id: string): Promise<Message | null> {
    // For individual lookups, go directly to PostgreSQL
    // Redis caches are organized by userId, not messageId
    return this.pgRepo.findById(id)
  }

  /**
   * Find by conversation - This is where caching matters most!
   * Used for building LLM context
   */
  async findByConversationId(conversationId: string, limit: number = 100): Promise<Message[]> {
    // We need userId to check Redis, but we don't have it here
    // This method should be replaced by findByUserId
    return this.pgRepo.findByConversationId(conversationId, limit)
  }

  /**
   * Find messages by userId - USE THIS for LLM context!
   * This is the key method that uses Redis caching
   */
  async findByUserId(userId: string, limit: number = 100): Promise<Message[]> {
    try {
      // 1. Try Redis first (fast!)
      const cached = await this.redis.getUserMessages(userId)
      
      if (cached && cached.length > 0) {
        console.log(`Cache HIT for user ${userId} (${cached.length} messages)`)
        // Refresh TTL since user is active
        await this.redis.refreshMessagesTTL(userId)
        return cached.slice(-limit) // Return last N messages
      }

      // 2. Cache miss - load from PostgreSQL
      console.log(`Cache MISS for user ${userId}, loading from PostgreSQL`)
      const messages = await this.pgRepo.findByUserId(userId, limit)
      
      // 3. Populate Redis cache for next time
      if (messages.length > 0) {
        await this.redis.setUserMessages(userId, messages)
      }
      
      return messages
    } catch (error) {
      console.error('Error in findByUserId:', error)
      // Fallback to PostgreSQL on Redis error
      return this.pgRepo.findByUserId(userId, limit)
    }
  }

  /**
   * Update message - update both Redis and PostgreSQL
   */
  async update(id: string, updates: Partial<Message>): Promise<Message | null> {
    const updated = await this.pgRepo.update(id, updates)
    
    if (updated) {
      // Update in Redis cache too
      const cached = await this.redis.getUserMessages(updated.userId)
      if (cached) {
        const updatedCache = cached.map((msg) => 
          msg.id === id ? { ...msg, ...updates } : msg
        )
        await this.redis.setUserMessages(updated.userId, updatedCache)
      }
    }
    
    return updated
  }

  /**
   * Delete message - remove from both Redis and PostgreSQL
   */
  async delete(id: string): Promise<boolean> {
    // First find the message to get userId
    const message = await this.pgRepo.findById(id)
    
    if (message) {
      // Remove from Redis cache
      const cached = await this.redis.getUserMessages(message.userId)
      if (cached) {
        const filteredCache = cached.filter((msg) => msg.id !== id)
        await this.redis.setUserMessages(message.userId, filteredCache)
      }
    }
    
    // Delete from PostgreSQL
    return this.pgRepo.delete(id)
  }

  /**
   * Load user's messages from PostgreSQL into Redis
   * Called on login to warm up the cache
   */
  async warmCache(userId: string): Promise<void> {
    console.log(`Warming cache for user ${userId}`)
    
    // Load recent messages from PostgreSQL
    const messages = await this.pgRepo.findByUserId(userId, 100)
    
    if (messages.length > 0) {
      // Store in Redis with TTL
      await this.redis.setUserMessages(userId, messages)
      console.log(`Cache warmed: ${messages.length} messages for user ${userId}`)
    }
  }

  /**
   * Sync user's Redis messages to PostgreSQL
   * Called by background job when messages are about to expire
   */
  async syncToPostgres(userId: string): Promise<void> {
    console.log(`Syncing Redis → PostgreSQL for user ${userId}`)
    
    const cached = await this.redis.getUserMessages(userId)
    
    if (!cached || cached.length === 0) {
      return
    }

    // Get existing messages from PostgreSQL
    const existing = await this.pgRepo.findByUserId(userId, 1000)
    const existingIds = new Set(existing.map((m) => m.id))
    
    // Find messages that exist in Redis but not in PostgreSQL
    const newMessages = cached.filter((msg) => !existingIds.has(msg.id))
    
    if (newMessages.length > 0) {
      console.log(`Syncing ${newMessages.length} new messages to PostgreSQL`)
      
      // Create missing messages in PostgreSQL
      for (const msg of newMessages) {
        try {
          await this.pgRepo.create({
            id: msg.id,
            conversationId: msg.conversationId,
            userId: msg.userId,
            type: msg.type,
            content: msg.content,
            metadata: msg.metadata,
          })
        } catch (error) {
          console.error(`Failed to sync message ${msg.id}:`, error)
        }
      }
    }
    
    console.log(`Sync complete for user ${userId}`)
  }
}
