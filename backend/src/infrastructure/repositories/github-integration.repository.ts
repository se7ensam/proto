/**
 * GitHub Integration Repository
 * Manages GitHub integration data persistence
 */

import { eq, and, desc } from 'drizzle-orm'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { githubIntegrations, githubSyncHistory, GitHubIntegration, NewGitHubIntegration, GitHubSyncHistory, NewGitHubSyncHistory } from '../../db/schema'
import { DatabaseError } from '../../domain/errors'
import * as schema from '../../db/schema'

export class GitHubIntegrationRepository {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  /**
   * Create a new GitHub integration
   */
  async create(integration: Omit<NewGitHubIntegration, 'id' | 'createdAt' | 'updatedAt'>): Promise<GitHubIntegration> {
    try {
      const [created] = await this.db
        .insert(githubIntegrations)
        .values({
          ...integration,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()

      return created
    } catch (error) {
      throw new DatabaseError('Failed to create GitHub integration', error as Error)
    }
  }

  /**
   * Find integration by conversation ID
   */
  async findByConversationId(conversationId: string): Promise<GitHubIntegration | null> {
    try {
      const [integration] = await this.db
        .select()
        .from(githubIntegrations)
        .where(eq(githubIntegrations.conversationId, conversationId))
        .limit(1)

      return integration || null
    } catch (error) {
      throw new DatabaseError('Failed to find GitHub integration', error as Error)
    }
  }

  /**
   * Find integration by user ID
   */
  async findByUserId(userId: string): Promise<GitHubIntegration[]> {
    try {
      const results = await this.db
        .select()
        .from(githubIntegrations)
        .where(eq(githubIntegrations.userId, userId))
        .orderBy(desc(githubIntegrations.createdAt))

      return results
    } catch (error) {
      throw new DatabaseError('Failed to find user GitHub integrations', error as Error)
    }
  }

  /**
   * Find integration by GitHub user ID
   */
  async findByGitHubUserId(githubUserId: string): Promise<GitHubIntegration[]> {
    try {
      const results = await this.db
        .select()
        .from(githubIntegrations)
        .where(eq(githubIntegrations.githubUserId, githubUserId))
        .orderBy(desc(githubIntegrations.createdAt))

      return results
    } catch (error) {
      throw new DatabaseError('Failed to find GitHub integrations by GitHub user', error as Error)
    }
  }

  /**
   * Find integration by ID
   */
  async findById(id: string): Promise<GitHubIntegration | null> {
    try {
      const [integration] = await this.db
        .select()
        .from(githubIntegrations)
        .where(eq(githubIntegrations.id, id))
        .limit(1)

      return integration || null
    } catch (error) {
      throw new DatabaseError('Failed to find GitHub integration by ID', error as Error)
    }
  }

  /**
   * Update integration
   */
  async update(
    id: string,
    updates: Partial<Omit<GitHubIntegration, 'id' | 'createdAt'>>
  ): Promise<GitHubIntegration | null> {
    try {
      const [updated] = await this.db
        .update(githubIntegrations)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(githubIntegrations.id, id))
        .returning()

      return updated || null
    } catch (error) {
      throw new DatabaseError('Failed to update GitHub integration', error as Error)
    }
  }

  /**
   * Delete integration
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(githubIntegrations)
        .where(eq(githubIntegrations.id, id))

      return (result.rowCount || 0) > 0
    } catch (error) {
      throw new DatabaseError('Failed to delete GitHub integration', error as Error)
    }
  }

  /**
   * Check if conversation has active integration
   */
  async hasActiveIntegration(conversationId: string): Promise<boolean> {
    try {
      const [integration] = await this.db
        .select()
        .from(githubIntegrations)
        .where(
          and(
            eq(githubIntegrations.conversationId, conversationId),
            eq(githubIntegrations.integrationStatus, 'active')
          )
        )
        .limit(1)

      return !!integration
    } catch (error) {
      throw new DatabaseError('Failed to check active integration', error as Error)
    }
  }

  // ==================== Sync History Methods ====================

  /**
   * Create sync history entry
   */
  async createSyncHistory(
    history: Omit<NewGitHubSyncHistory, 'id' | 'createdAt'>
  ): Promise<GitHubSyncHistory> {
    try {
      const [created] = await this.db
        .insert(githubSyncHistory)
        .values({
          ...history,
          createdAt: new Date(),
        })
        .returning()

      return created
    } catch (error) {
      throw new DatabaseError('Failed to create sync history', error as Error)
    }
  }

  /**
   * Get sync history for integration
   */
  async getSyncHistory(
    integrationId: string,
    limit: number = 50
  ): Promise<GitHubSyncHistory[]> {
    try {
      const results = await this.db
        .select()
        .from(githubSyncHistory)
        .where(eq(githubSyncHistory.integrationId, integrationId))
        .orderBy(desc(githubSyncHistory.createdAt))
        .limit(limit)

      return results
    } catch (error) {
      throw new DatabaseError('Failed to get sync history', error as Error)
    }
  }

  /**
   * Get failed syncs for retry
   */
  async getFailedSyncs(integrationId: string): Promise<GitHubSyncHistory[]> {
    try {
      const results = await this.db
        .select()
        .from(githubSyncHistory)
        .where(
          and(
            eq(githubSyncHistory.integrationId, integrationId),
            eq(githubSyncHistory.status, 'failed')
          )
        )
        .orderBy(desc(githubSyncHistory.createdAt))
        .limit(10)

      return results
    } catch (error) {
      throw new DatabaseError('Failed to get failed syncs', error as Error)
    }
  }

  /**
   * Update sync history status
   */
  async updateSyncStatus(
    historyId: string,
    status: string,
    errorMessage?: string
  ): Promise<GitHubSyncHistory | null> {
    try {
      const [updated] = await this.db
        .update(githubSyncHistory)
        .set({
          status,
          errorMessage,
        })
        .where(eq(githubSyncHistory.id, historyId))
        .returning()

      return updated || null
    } catch (error) {
      throw new DatabaseError('Failed to update sync history status', error as Error)
    }
  }
}
