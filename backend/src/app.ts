/**
 * Fastify application setup
 */

import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import sensible from '@fastify/sensible'
import { register as metricsRegister } from './infrastructure/metrics'

// Plugins
import dbPlugin from './infrastructure/fastify/plugins/db.plugin'
import servicesPlugin from './infrastructure/fastify/plugins/services.plugin'
import authPlugin from './infrastructure/fastify/plugins/auth.plugin'
import errorHandlerPlugin from './infrastructure/fastify/plugins/error-handler.plugin'
import metricsPlugin from './infrastructure/fastify/plugins/metrics.plugin'

// Routes
import authRoutes from './infrastructure/fastify/routes/auth.routes'
import chatRoutes from './infrastructure/fastify/routes/chat.routes'
import planRoutes from './infrastructure/fastify/routes/plan.routes'
import githubRoutes from './infrastructure/fastify/routes/github.routes'

export async function buildApp() {
  const isDevelopment = process.env.NODE_ENV !== 'production'
  
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
    disableRequestLogging: false,
    requestIdLogLabel: 'requestId',
    requestIdHeader: 'x-request-id',
  })

  // Register core plugins
  await app.register(cors, {
    origin: true,
    credentials: true,
  })

  await app.register(sensible)

  // Rate limiting (using in-memory store for now)
  // To use Redis, pass a Redis client instance instead of URL
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    cache: 10000,
    allowList: ['127.0.0.1'],
  })

  // Custom plugins
  await app.register(metricsPlugin)
  await app.register(errorHandlerPlugin)
  await app.register(dbPlugin)
  await app.register(servicesPlugin)
  await app.register(authPlugin)

  // Health check
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }
  })

  // Metrics endpoint
  app.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', metricsRegister.contentType)
    return metricsRegister.metrics()
  })

  // Register routes
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(chatRoutes, { prefix: '/api/chat' })
  await app.register(planRoutes, { prefix: '/api/plan' })
  await app.register(githubRoutes, { prefix: '/api/github' })

  return app
}
