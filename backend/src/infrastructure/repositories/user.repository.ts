import { eq } from 'drizzle-orm'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { IUserRepository } from '../../domain/repositories'
import { User } from '../../domain/types'
import { users } from '../../db/schema'
import { DatabaseError } from '../../domain/errors'
import * as schema from '../../db/schema'

export class UserRepository implements IUserRepository {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    try {
      const [created] = await this.db
        .insert(users)
        .values({
          email: user.email,
          password: user.passwordHash,
          googleId: user.googleId,
        })
        .returning()

      return this.toDomain(created)
    } catch (error) {
      throw new DatabaseError('Failed to create user', error as Error)
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1)

      return user ? this.toDomain(user) : null
    } catch (error) {
      throw new DatabaseError('Failed to find user', error as Error)
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1)

      return user ? this.toDomain(user) : null
    } catch (error) {
      throw new DatabaseError('Failed to find user by email', error as Error)
    }
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    try {
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.googleId, googleId))
        .limit(1)

      return user ? this.toDomain(user) : null
    } catch (error) {
      throw new DatabaseError('Failed to find user by Google ID', error as Error)
    }
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    try {
      const [updated] = await this.db
        .update(users)
        .set({
          email: updates.email,
          password: updates.passwordHash,
          googleId: updates.googleId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning()

      return updated ? this.toDomain(updated) : null
    } catch (error) {
      throw new DatabaseError('Failed to update user', error as Error)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db.delete(users).where(eq(users.id, id))
      return result.rowCount ? result.rowCount > 0 : false
    } catch (error) {
      throw new DatabaseError('Failed to delete user', error as Error)
    }
  }

  private toDomain(row: typeof users.$inferSelect): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password ?? undefined,
      googleId: row.googleId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}
