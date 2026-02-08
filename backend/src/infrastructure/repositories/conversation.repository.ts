import { eq } from 'drizzle-orm'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { IConversationRepository } from '../../domain/repositories'
import { Conversation } from '../../domain/types'
import { conversations } from '../../db/schema'
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
    try {
      const results = await this.db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(conversations.updatedAt)

      return results.map((c) => this.toDomain(c))
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

  async getOrCreate(userId: string, conversationId: string): Promise<Conversation> {
    try {
      // Check if conversationId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const isValidUuid = uuidRegex.test(conversationId)

      if (isValidUuid) {
        // Try to find existing conversation by UUID
        const existing = await this.findById(conversationId)
        if (existing && existing.userId === userId) {
          return existing
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

  private toDomain(row: typeof conversations.$inferSelect): Conversation {
    return {
      id: row.id,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      metadata: row.metadata as Record<string, unknown> | undefined,
    }
  }
}
