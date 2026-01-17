import { eq, desc } from 'drizzle-orm'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { IMessageRepository } from '../../domain/repositories'
import { Message } from '../../domain/types'
import { messages } from '../../db/schema'
import { DatabaseError } from '../../domain/errors'
import * as schema from '../../db/schema'

export class MessageRepository implements IMessageRepository {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  async create(message: Omit<Message, 'id' | 'timestamp'> & { id?: string }): Promise<Message> {
    try {
      const values: any = {
        conversationId: message.conversationId,
        userId: message.userId,
        type: message.type,
        content: message.content,
        metadata: message.metadata as any,
      }

      // Include ID if provided
      if (message.id) {
        values.id = message.id
      }

      const [created] = await this.db
        .insert(messages)
        .values(values)
        .returning()

      return this.toDomain(created)
    } catch (error) {
      throw new DatabaseError('Failed to create message', error as Error)
    }
  }

  async findById(id: string): Promise<Message | null> {
    try {
      const [message] = await this.db
        .select()
        .from(messages)
        .where(eq(messages.id, id))
        .limit(1)

      return message ? this.toDomain(message) : null
    } catch (error) {
      throw new DatabaseError('Failed to find message', error as Error)
    }
  }

  async findByConversationId(conversationId: string, limit: number = 100): Promise<Message[]> {
    try {
      const results = await this.db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.timestamp))
        .limit(limit)

      return results.map((m) => this.toDomain(m)).reverse()
    } catch (error) {
      throw new DatabaseError('Failed to find messages by conversation', error as Error)
    }
  }

  async findByUserId(userId: string, limit: number = 100): Promise<Message[]> {
    try {
      const results = await this.db
        .select()
        .from(messages)
        .where(eq(messages.userId, userId))
        .orderBy(desc(messages.timestamp))
        .limit(limit)

      return results.map((m) => this.toDomain(m)).reverse()
    } catch (error) {
      throw new DatabaseError('Failed to find messages by user', error as Error)
    }
  }

  async update(id: string, updates: Partial<Message>): Promise<Message | null> {
    try {
      const [updated] = await this.db
        .update(messages)
        .set({
          content: updates.content,
          metadata: updates.metadata as any,
        })
        .where(eq(messages.id, id))
        .returning()

      return updated ? this.toDomain(updated) : null
    } catch (error) {
      throw new DatabaseError('Failed to update message', error as Error)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db.delete(messages).where(eq(messages.id, id))
      return result.rowCount ? result.rowCount > 0 : false
    } catch (error) {
      throw new DatabaseError('Failed to delete message', error as Error)
    }
  }

  private toDomain(row: typeof messages.$inferSelect): Message {
    return {
      id: row.id,
      conversationId: row.conversationId,
      userId: row.userId,
      type: row.type as Message['type'],
      content: row.content,
      timestamp: row.timestamp,
      metadata: row.metadata as Record<string, unknown> | undefined,
    }
  }
}
