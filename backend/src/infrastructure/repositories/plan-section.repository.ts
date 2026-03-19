import { eq } from 'drizzle-orm'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { IPlanSectionRepository } from '../../domain/repositories'
import { PlanSection } from '../../domain/types'
import { planSections } from '../../db/schema'
import { DatabaseError } from '../../domain/errors'
import * as schema from '../../db/schema'

export class PlanSectionRepository implements IPlanSectionRepository {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  async create(section: Omit<PlanSection, 'id' | 'timestamp'>): Promise<PlanSection> {
    try {
      const [created] = await this.db
        .insert(planSections)
        .values({
          conversationId: section.conversationId,
          userId: section.userId,
          content: section.content,
          locked: section.locked,
          sourceMessageId: section.sourceMessageId,
          phaseId: section.phaseId,
          phaseOrder: section.phaseOrder,
          structuredData: section.structuredData as any,
        })
        .returning()

      return this.toDomain(created)
    } catch (error) {
      throw new DatabaseError('Failed to create plan section', error as Error)
    }
  }

  async findById(id: string): Promise<PlanSection | null> {
    try {
      const [section] = await this.db
        .select()
        .from(planSections)
        .where(eq(planSections.id, id))
        .limit(1)

      return section ? this.toDomain(section) : null
    } catch (error) {
      throw new DatabaseError('Failed to find plan section', error as Error)
    }
  }

  async findByConversationId(conversationId: string): Promise<PlanSection[]> {
    try {
      const results = await this.db
        .select()
        .from(planSections)
        .where(eq(planSections.conversationId, conversationId))
        .orderBy(planSections.timestamp)

      return results.map((s) => this.toDomain(s))
    } catch (error) {
      throw new DatabaseError('Failed to find plan sections by conversation', error as Error)
    }
  }

  async update(id: string, updates: Partial<PlanSection>): Promise<PlanSection | null> {
    try {
      const [updated] = await this.db
        .update(planSections)
        .set({
          content: updates.content,
          locked: updates.locked,
          sourceMessageId: updates.sourceMessageId,
          phaseId: updates.phaseId,
          phaseOrder: updates.phaseOrder,
          structuredData: updates.structuredData as any,
        })
        .where(eq(planSections.id, id))
        .returning()

      return updated ? this.toDomain(updated) : null
    } catch (error) {
      throw new DatabaseError('Failed to update plan section', error as Error)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db.delete(planSections).where(eq(planSections.id, id))
      return result.rowCount ? result.rowCount > 0 : false
    } catch (error) {
      throw new DatabaseError('Failed to delete plan section', error as Error)
    }
  }

  async deleteByConversationId(conversationId: string): Promise<number> {
    try {
      const result = await this.db
        .delete(planSections)
        .where(eq(planSections.conversationId, conversationId))

      return result.rowCount ?? 0
    } catch (error) {
      throw new DatabaseError('Failed to delete plan sections by conversation', error as Error)
    }
  }

  private toDomain(row: typeof planSections.$inferSelect): PlanSection {
    return {
      id: row.id,
      conversationId: row.conversationId,
      userId: row.userId,
      content: row.content,
      locked: row.locked,
      timestamp: row.timestamp,
      sourceMessageId: row.sourceMessageId ?? undefined,
      phaseId: row.phaseId ?? undefined,
      phaseOrder: row.phaseOrder ?? undefined,
      structuredData: (row.structuredData as PlanSection['structuredData']) ?? undefined,
    }
  }
}
