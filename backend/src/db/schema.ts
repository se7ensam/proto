import { pgTable, text, timestamp, uuid, boolean, jsonb, index } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').unique().notNull(),
    password: text('password'), // Nullable for Google Auth users
    googleId: text('google_id').unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const conversations = pgTable('conversations', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    metadata: jsonb('metadata'),
}, (table) => ({
    userIdIdx: index('conversations_user_id_idx').on(table.userId),
}))

export const messages = pgTable('messages', {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'user' | 'ai' | 'system' | 'plan_update'
    content: text('content').notNull(),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    metadata: jsonb('metadata'),
}, (table) => ({
    conversationIdIdx: index('messages_conversation_id_idx').on(table.conversationId),
    userIdIdx: index('messages_user_id_idx').on(table.userId),
    timestampIdx: index('messages_timestamp_idx').on(table.timestamp),
}))

export const planSections = pgTable('plan_sections', {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    locked: boolean('locked').default(false).notNull(),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    sourceMessageId: uuid('source_message_id').references(() => messages.id, { onDelete: 'set null' }),
}, (table) => ({
    conversationIdIdx: index('plan_sections_conversation_id_idx').on(table.conversationId),
    userIdIdx: index('plan_sections_user_id_idx').on(table.userId),
}))

export const planningRules = pgTable('planning_rules', {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    rule: text('rule').notNull(),
    order: text('order').notNull(), // For ordering rules
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    conversationIdIdx: index('planning_rules_conversation_id_idx').on(table.conversationId),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert

export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert

export type PlanSection = typeof planSections.$inferSelect
export type NewPlanSection = typeof planSections.$inferInsert

export type PlanningRule = typeof planningRules.$inferSelect
export type NewPlanningRule = typeof planningRules.$inferInsert
