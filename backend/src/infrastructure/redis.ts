/**
 * Redis client and utilities for caching
 */

import Redis from 'ioredis'
import { Message } from '../domain/types'

export class RedisClient {
  private client: Redis
  private readonly MESSAGE_TTL = 20 * 60 // 20 minutes in seconds
  private readonly MESSAGE_PREFIX = 'messages:user:'

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    })

    this.client.on('error', (err) => {
      console.error('Redis connection error:', err)
    })

    this.client.on('connect', () => {
      console.log('Redis connected successfully')
    })
  }

  /**
   * Get Redis client instance
   */
  getClient(): Redis {
    return this.client
  }

  /**
   * Store messages for a user in Redis with TTL
   * Key format: messages:user:{userId}
   */
  async setUserMessages(userId: string, messages: Message[]): Promise<void> {
    const key = `${this.MESSAGE_PREFIX}${userId}`
    const value = JSON.stringify(messages)
    
    await this.client.setex(key, this.MESSAGE_TTL, value)
  }

  /**
   * Get messages for a user from Redis
   */
  async getUserMessages(userId: string): Promise<Message[] | null> {
    const key = `${this.MESSAGE_PREFIX}${userId}`
    const value = await this.client.get(key)
    
    if (!value) {
      return null
    }

    try {
      const messages = JSON.parse(value)
      // Convert timestamp strings back to Date objects
      return messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }))
    } catch (error) {
      console.error('Failed to parse messages from Redis:', error)
      return null
    }
  }

  /**
   * Add a single message to user's cache
   * This appends to existing messages or creates new cache
   */
  async addUserMessage(userId: string, message: Message): Promise<void> {
    const key = `${this.MESSAGE_PREFIX}${userId}`
    
    // Get existing messages
    let messages = await this.getUserMessages(userId) || []
    
    // Append new message
    messages.push(message)
    
    // Store back with refreshed TTL
    await this.setUserMessages(userId, messages)
  }

  /**
   * Delete user's message cache
   */
  async deleteUserMessages(userId: string): Promise<void> {
    const key = `${this.MESSAGE_PREFIX}${userId}`
    await this.client.del(key)
  }

  /**
   * Get TTL (time to live) for user's messages
   * Returns seconds remaining, or -2 if key doesn't exist
   */
  async getMessagesTTL(userId: string): Promise<number> {
    const key = `${this.MESSAGE_PREFIX}${userId}`
    return await this.client.ttl(key)
  }

  /**
   * Get all user IDs that have messages about to expire
   * Used by background job to sync to PostgreSQL
   */
  async getUsersWithExpiringMessages(thresholdSeconds: number = 300): Promise<string[]> {
    const pattern = `${this.MESSAGE_PREFIX}*`
    const keys = await this.client.keys(pattern)
    
    const expiringUsers: string[] = []
    
    for (const key of keys) {
      const ttl = await this.client.ttl(key)
      
      // TTL between 0 and threshold means it's expiring soon
      if (ttl > 0 && ttl <= thresholdSeconds) {
        // Extract userId from key: messages:user:{userId}
        const userId = key.replace(this.MESSAGE_PREFIX, '')
        expiringUsers.push(userId)
      }
    }
    
    return expiringUsers
  }

  /**
   * Refresh TTL for user's messages (extend expiry)
   */
  async refreshMessagesTTL(userId: string): Promise<boolean> {
    const key = `${this.MESSAGE_PREFIX}${userId}`
    const result = await this.client.expire(key, this.MESSAGE_TTL)
    return result === 1
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.client.quit()
  }

  /**
   * Health check
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping()
      return result === 'PONG'
    } catch (error) {
      return false
    }
  }
}

// Singleton instance
let redisClient: RedisClient | null = null

export function getRedisClient(): RedisClient {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set')
    }
    redisClient = new RedisClient(redisUrl)
  }
  return redisClient
}

export function setRedisClient(client: RedisClient): void {
  redisClient = client
}
