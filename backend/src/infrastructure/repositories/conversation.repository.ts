import { eq, or, and } from 'drizzle-orm'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { IConversationRepository } from '../../domain/repositories'
import { Conversation } from '../../domain/types'
import { conversations, conversationMembers } from '../../db/schema'
import { DatabaseError } from '../../domain/errors'
import * as schema from '../../db/schema'

export class ConversationRepository implements IConversationRepository {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  async create(conversation: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Conversation> {
    try {
      const [created] = await this.db
        .insert(conversations)
        .values({
          userId: conversation.userId,
          metadata: conversation.metadata as any,
        })
        .returning()

      return this.toDomain(created)
    } catch (error) {
      throw new DatabaseError('Failed to create conversation', error as Error)
    }
  }

  async findById(id: string): Promise<Conversation | null> {
    try {
      const [conversation] = await this.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, id))
        .limit(1)

      return conversation ? this.toDomain(conversation) : null
    } catch (error) {
      throw new DatabaseError('Failed to find conversation', error as Error)
    }
  }

  async findByUserId(userId: string): Promise<Conversation[]> {
    const all = await this.findAllByUserId(userId)
    return all.filter((conversation) => !this.isConversationDeleted(conversation.metadata))
  }

  async findDeletedByUserId(userId: string): Promise<Conversation[]> {
    const all = await this.findAllByUserId(userId)
    return all.filter((conversation) => this.isConversationDeleted(conversation.metadata))
  }

  private async findAllByUserId(userId: string): Promise<Conversation[]> {
    try {
      // Find conversations the user owns
      const owned = await this.db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, userId))
        
      // Find conversations the user is a member of
      const memberOf = await this.db
        .select({
          id: conversations.id,
          userId: conversations.userId,
          createdAt: conversations.createdAt,
          updatedAt: conversations.updatedAt,
          metadata: conversations.metadata,
        })
        .from(conversations)
        .innerJoin(conversationMembers, eq(conversations.id, conversationMembers.conversationId))
        .where(eq(conversationMembers.userId, userId))

      // Combine and deduplicate
      const allConversations = [...owned, ...memberOf]
      const uniqueConversations = Array.from(new Map(allConversations.map(c => [c.id, c])).values())

      // Sort by updatedAt descending
      uniqueConversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

      return uniqueConversations.map((c) => this.toDomain(c))
    } catch (error) {
      throw new DatabaseError('Failed to find conversations by user', error as Error)
    }
  }

  async update(id: string, updates: Partial<Conversation>): Promise<Conversation | null> {
    try {
      const [updated] = await this.db
        .update(conversations)
        .set({
          metadata: updates.metadata as any,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, id))
        .returning()

      return updated ? this.toDomain(updated) : null
    } catch (error) {
      throw new DatabaseError('Failed to update conversation', error as Error)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db.delete(conversations).where(eq(conversations.id, id))
      return result.rowCount ? result.rowCount > 0 : false
    } catch (error) {
      throw new DatabaseError('Failed to delete conversation', error as Error)
    }
  }

  async softDelete(id: string): Promise<Conversation | null> {
    try {
      const existing = await this.findById(id)
      if (!existing) {
        return null
      }

      const metadata = this.withDeletedAt(existing.metadata, new Date().toISOString())
      return this.update(id, { metadata })
    } catch (error) {
      throw new DatabaseError('Failed to soft-delete conversation', error as Error)
    }
  }

  async restore(id: string): Promise<Conversation | null> {
    try {
      const existing = await this.findById(id)
      if (!existing) {
        return null
      }

      const metadata = this.withDeletedAt(existing.metadata, undefined)
      return this.update(id, { metadata })
    } catch (error) {
      throw new DatabaseError('Failed to restore conversation', error as Error)
    }
  }

  async getOrCreate(userId: string, conversationId: string): Promise<Conversation> {
    try {
      // Check if conversationId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const isValidUuid = uuidRegex.test(conversationId)

      if (isValidUuid) {
        // Try to find existing conversation by UUID
        const existing = await this.findById(conversationId)
        if (existing && !this.isConversationDeleted(existing.metadata)) {
          if (existing.userId === userId) {
            return existing
          }
          // If not owner, check if they are an invited member
          const members = await this.getMembers(conversationId)
          if (members.some(m => m.userId === userId)) {
            return existing
          }
        }
      } else {
        // For "default" or invalid UUIDs, fetch the user's most recent valid conversation
        const existingChats = await this.findByUserId(userId)
        if (existingChats.length > 0) {
          return existingChats[0]
        }
      }

      // Create new conversation (let DB generate UUID)
      const [created] = await this.db
        .insert(conversations)
        .values({
          userId,
        })
        .returning()

      return this.toDomain(created)
    } catch (error) {
      throw new DatabaseError('Failed to get or create conversation', error as Error)
    }
  }

  async addMember(conversationId: string, userId: string, role: string = 'member'): Promise<void> {
    try {
      await this.db
        .insert(conversationMembers)
        .values({
          conversationId,
          userId,
          role,
        })
        .onConflictDoNothing() // Let it gracefully fail if already exists or use try-catch
    } catch (error) {
      throw new DatabaseError('Failed to add member', error as Error)
    }
  }

  async removeMember(conversationId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, userId)
          )
        )
      return result.rowCount ? result.rowCount > 0 : false
    } catch (error) {
      throw new DatabaseError('Failed to remove member', error as Error)
    }
  }

  async getMembers(conversationId: string): Promise<{userId: string, role: string, joinedAt: Date}[]> {
    try {
      const results = await this.db
        .select()
        .from(conversationMembers)
        .where(eq(conversationMembers.conversationId, conversationId))
      
      return results.map(r => ({
        userId: r.userId,
        role: r.role,
        joinedAt: r.joinedAt
      }))
    } catch (error) {
      throw new DatabaseError('Failed to get members', error as Error)
    }
  }

  private toDomain(row: typeof conversations.$inferSelect): Conversation {
    return {
      id: row.id,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      metadata: row.metadata as Record<string, unknown> | undefined,
    }
  }

  private isConversationDeleted(metadata: unknown): boolean {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return false
    }

    const deletedAt = (metadata as Record<string, unknown>).deletedAt
    return typeof deletedAt === 'string' && deletedAt.length > 0
  }

  private withDeletedAt(
    metadata: Conversation['metadata'],
    deletedAt?: string
  ): Record<string, unknown> {
    const next = {
      ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}),
    } as Record<string, unknown>

    if (deletedAt) {
      next.deletedAt = deletedAt
    } else {
      delete next.deletedAt
    }

    return next
  }
}
