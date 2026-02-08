/**
 * Background job to sync Redis messages to PostgreSQL
 * Runs every 5 minutes and syncs messages that are about to expire (< 5 min TTL)
 */

import { CachedMessageRepository } from '../repositories/cached-message.repository'
import { RedisClient } from '../redis'

export class MessageSyncJob {
  private intervalId: NodeJS.Timeout | null = null
  private readonly SYNC_INTERVAL = 5 * 60 * 1000 // 5 minutes
  private readonly TTL_THRESHOLD = 5 * 60 // Sync when < 5 minutes remaining

  constructor(
    private messageRepo: CachedMessageRepository,
    private redis: RedisClient
  ) {}

  /**
   * Start the background sync job
   */
  start(): void {
    if (this.intervalId) {
      console.warn('Message sync job already running')
      return
    }

    console.log('Starting message sync job (runs every 5 minutes)')
    
    // Run immediately on start
    this.syncMessages()

    // Then run every 5 minutes
    this.intervalId = setInterval(() => {
      this.syncMessages()
    }, this.SYNC_INTERVAL)
  }

  /**
   * Stop the background sync job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('Message sync job stopped')
    }
  }

  /**
   * Perform the sync operation
   */
  private async syncMessages(): Promise<void> {
    try {
      console.log('[MessageSync] Starting sync cycle...')
      
      // Get users whose messages are expiring soon (< 5 min TTL)
      const expiringUsers = await this.redis.getUsersWithExpiringMessages(this.TTL_THRESHOLD)
      
      if (expiringUsers.length === 0) {
        console.log('[MessageSync] No users with expiring messages')
        return
      }

      console.log(`[MessageSync] Found ${expiringUsers.length} users with expiring messages`)

      // Sync each user's messages to PostgreSQL
      for (const userId of expiringUsers) {
        try {
          await this.messageRepo.syncToPostgres(userId)
          console.log(`[MessageSync] ✓ Synced user ${userId}`)
        } catch (error) {
          console.error(`[MessageSync] ✗ Failed to sync user ${userId}:`, error)
        }
      }

      console.log('[MessageSync] Sync cycle complete')
    } catch (error) {
      console.error('[MessageSync] Sync cycle error:', error)
    }
  }

  /**
   * Manually trigger a sync (useful for testing)
   */
  async triggerSync(): Promise<void> {
    await this.syncMessages()
  }
}

// Singleton instance
let syncJob: MessageSyncJob | null = null

export function getMessageSyncJob(): MessageSyncJob | null {
  return syncJob
}

export function setMessageSyncJob(job: MessageSyncJob): void {
  syncJob = job
}
