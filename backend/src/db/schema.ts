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

export const githubIntegrations = pgTable('github_integrations', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    
    // GitHub OAuth tokens (encrypted in production)
    githubAccessToken: text('github_access_token').notNull(),
    githubRefreshToken: text('github_refresh_token'),
    githubTokenExpiresAt: timestamp('github_token_expires_at'),
    
    // GitHub user info
    githubUsername: text('github_username').notNull(),
    githubUserId: text('github_user_id').notNull(),
    githubEmail: text('github_email'),
    githubAvatarUrl: text('github_avatar_url'),
    
    // Repository info
    repoName: text('repo_name'),
    repoFullName: text('repo_full_name'), // owner/repo
    repoUrl: text('repo_url'),
    repoOwner: text('repo_owner'),
    repoIsPrivate: boolean('repo_is_private').default(true),
    
    // Collaborator info
    collaboratorUsername: text('collaborator_username'),
    collaboratorEmail: text('collaborator_email'),
    collaborationStatus: text('collaboration_status').default('none'), // none, pending, accepted, active
    
    // Integration status
    integrationStatus: text('integration_status').default('configured'), // configured, active, error, disabled
    lastSyncAt: timestamp('last_sync_at'),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    userIdIdx: index('github_integrations_user_id_idx').on(table.userId),
    conversationIdIdx: index('github_integrations_conversation_id_idx').on(table.conversationId),
    githubUserIdIdx: index('github_integrations_github_user_id_idx').on(table.githubUserId),
}))

export const githubSyncHistory = pgTable('github_sync_history', {
    id: uuid('id').defaultRandom().primaryKey(),
    integrationId: uuid('integration_id').notNull().references(() => githubIntegrations.id, { onDelete: 'cascade' }),
    
    // Sync details
    syncType: text('sync_type').notNull(), // issue_created, pr_created, file_pushed, comment_added, etc.
    planSectionId: uuid('plan_section_id').references(() => planSections.id, { onDelete: 'set null' }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
    
    // GitHub resource info
    githubResourceType: text('github_resource_type'), // issue, pr, commit, file, comment
    githubResourceId: text('github_resource_id'),
    githubResourceNumber: text('github_resource_number'), // Issue/PR number
    githubResourceUrl: text('github_resource_url'),
    
    // Status and error handling
    status: text('status').notNull(), // success, failed, pending
    errorMessage: text('error_message'),
    
    // Additional metadata
    metadata: jsonb('metadata'),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    integrationIdIdx: index('github_sync_history_integration_id_idx').on(table.integrationId),
    statusIdx: index('github_sync_history_status_idx').on(table.status),
    createdAtIdx: index('github_sync_history_created_at_idx').on(table.createdAt),
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

export type GitHubIntegration = typeof githubIntegrations.$inferSelect
export type NewGitHubIntegration = typeof githubIntegrations.$inferInsert

export type GitHubSyncHistory = typeof githubSyncHistory.$inferSelect
export type NewGitHubSyncHistory = typeof githubSyncHistory.$inferInsert
