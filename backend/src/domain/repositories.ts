/**
 * Repository interfaces - Define contracts for data access
 * These are framework-agnostic and define what the domain needs
 */

import { Message, PlanSection, Conversation, User } from './types'

export interface IMessageRepository {
  create(message: Omit<Message, 'id' | 'timestamp'> & { id?: string }): Promise<Message>
  findById(id: string): Promise<Message | null>
  findByConversationId(conversationId: string, limit?: number): Promise<Message[]>
  findByUserId(userId: string, limit?: number): Promise<Message[]>
  update(id: string, updates: Partial<Message>): Promise<Message | null>
  delete(id: string): Promise<boolean>
}

export interface IPlanSectionRepository {
  create(section: Omit<PlanSection, 'id' | 'timestamp'>): Promise<PlanSection>
  findById(id: string): Promise<PlanSection | null>
  findByConversationId(conversationId: string): Promise<PlanSection[]>
  update(id: string, updates: Partial<PlanSection>): Promise<PlanSection | null>
  delete(id: string): Promise<boolean>
}

export interface IConversationRepository {
  create(conversation: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Conversation>
  findById(id: string): Promise<Conversation | null>
  findByUserId(userId: string): Promise<Conversation[]>
  update(id: string, updates: Partial<Conversation>): Promise<Conversation | null>
  delete(id: string): Promise<boolean>
  getOrCreate(userId: string, conversationId: string): Promise<Conversation>
}

export interface IUserRepository {
  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  findByGoogleId(googleId: string): Promise<User | null>
  update(id: string, updates: Partial<User>): Promise<User | null>
  delete(id: string): Promise<boolean>
}

export interface IPlanningRulesRepository {
  setRules(conversationId: string, rules: string[]): Promise<void>
  getRules(conversationId: string): Promise<string[]>
  deleteRules(conversationId: string): Promise<boolean>
}
