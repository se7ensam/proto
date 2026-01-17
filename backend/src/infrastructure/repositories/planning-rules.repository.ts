import { eq } from 'drizzle-orm'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { IPlanningRulesRepository } from '../../domain/repositories'
import { planningRules } from '../../db/schema'
import { DatabaseError } from '../../domain/errors'
import * as schema from '../../db/schema'

export class PlanningRulesRepository implements IPlanningRulesRepository {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  async setRules(conversationId: string, rules: string[]): Promise<void> {
    try {
      // Delete existing rules
      await this.db.delete(planningRules).where(eq(planningRules.conversationId, conversationId))

      // Insert new rules
      if (rules.length > 0) {
        await this.db.insert(planningRules).values(
          rules.map((rule, index) => ({
            conversationId,
            rule,
            order: index.toString().padStart(5, '0'), // Pad for proper sorting
          }))
        )
      }
    } catch (error) {
      throw new DatabaseError('Failed to set planning rules', error as Error)
    }
  }

  async getRules(conversationId: string): Promise<string[]> {
    try {
      const results = await this.db
        .select()
        .from(planningRules)
        .where(eq(planningRules.conversationId, conversationId))
        .orderBy(planningRules.order)

      return results.map((r) => r.rule)
    } catch (error) {
      throw new DatabaseError('Failed to get planning rules', error as Error)
    }
  }

  async deleteRules(conversationId: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(planningRules)
        .where(eq(planningRules.conversationId, conversationId))

      return result.rowCount ? result.rowCount > 0 : false
    } catch (error) {
      throw new DatabaseError('Failed to delete planning rules', error as Error)
    }
  }
}
