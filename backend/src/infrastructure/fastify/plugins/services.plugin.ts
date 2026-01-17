/**
 * Services plugin - Provides domain services to routes
 */

import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { ChatService } from '../../../domain/services/chat.service'
import { PlanService } from '../../../domain/services/plan.service'
import { AuthService } from '../../../domain/services/auth.service'
import { MessageRepository } from '../../repositories/message.repository'
import { CachedMessageRepository } from '../../repositories/cached-message.repository'
import { PlanSectionRepository } from '../../repositories/plan-section.repository'
import { ConversationRepository } from '../../repositories/conversation.repository'
import { UserRepository } from '../../repositories/user.repository'
import { PlanningRulesRepository } from '../../repositories/planning-rules.repository'
import { GeminiLLMService } from '../../services/llm.service'
import { JWTTokenService } from '../../services/token.service'
import { GoogleAuthService } from '../../services/google-auth.service'
import { getRedisClient } from '../../redis'
import { MessageSyncJob } from '../../jobs/message-sync.job'

declare module 'fastify' {
  interface FastifyInstance {
    services: {
      chat: ChatService
      plan: PlanService
      auth: AuthService
    }
    messageRepo: CachedMessageRepository
    messageSyncJob: MessageSyncJob
  }
}

const servicesPlugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify

  // Initialize Redis (optional for local development)
  let redis: ReturnType<typeof getRedisClient> | null = null
  let useRedis = false
  
  try {
    // Check if Redis URL is valid (not just "/")
    const redisUrl = process.env.REDIS_URL
    if (redisUrl && redisUrl !== '/' && !redisUrl.startsWith('redis://localhost')) {
      redis = getRedisClient()
      
      // Verify Redis connection with timeout
      const isRedisHealthy = await Promise.race([
        redis.ping(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000))
      ])
      
      if (isRedisHealthy) {
        fastify.log.info('Redis connected successfully')
        useRedis = true
      } else {
        fastify.log.warn('Redis ping failed - using PostgreSQL only')
      }
    } else {
      fastify.log.info('Redis not configured (local development) - using PostgreSQL only')
    }
  } catch (error) {
    fastify.log.warn({ error }, 'Redis initialization failed - using PostgreSQL only')
  }

  // Initialize repositories
  const pgMessageRepo = new MessageRepository(db)
  const messageRepo = useRedis && redis 
    ? new CachedMessageRepository(pgMessageRepo, redis)
    : pgMessageRepo as any
  const planSectionRepo = new PlanSectionRepository(db)
  const conversationRepo = new ConversationRepository(db)
  const userRepo = new UserRepository(db)
  const planningRulesRepo = new PlanningRulesRepository(db)

  // Initialize infrastructure services
  const llmService = new GeminiLLMService(process.env.GEMINI_API_KEY)
  const tokenService = new JWTTokenService(process.env.JWT_SECRET || 'your-secret-key')
  
  let googleAuthService: GoogleAuthService | undefined
  if (process.env.GOOGLE_CLIENT_ID) {
    googleAuthService = new GoogleAuthService(process.env.GOOGLE_CLIENT_ID)
  }

  // Initialize domain services
  const chatService = new ChatService(messageRepo, conversationRepo, planningRulesRepo, llmService)
  const planService = new PlanService(planSectionRepo, messageRepo, conversationRepo)
  const authService = new AuthService(userRepo, tokenService, googleAuthService)

  // Initialize background sync job only if Redis is available
  let messageSyncJob: MessageSyncJob | null = null
  if (useRedis && redis) {
    messageSyncJob = new MessageSyncJob(messageRepo as CachedMessageRepository, redis)
    messageSyncJob.start()
    fastify.log.info('Background message sync job started')
  } else {
    fastify.log.info('Background sync job skipped (Redis not available)')
  }

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    if (messageSyncJob) {
      fastify.log.info('Shutting down message sync job...')
      messageSyncJob.stop()
    }
    if (redis) {
      await redis.close()
    }
  })

  // Decorate fastify instance
  fastify.decorate('services', {
    chat: chatService,
    plan: planService,
    auth: authService,
  })
  
  if (useRedis && messageRepo && messageSyncJob) {
    fastify.decorate('messageRepo', messageRepo)
    fastify.decorate('messageSyncJob', messageSyncJob)
  }
}

export default fp(servicesPlugin, {
  name: 'services',
  dependencies: ['db'],
})
