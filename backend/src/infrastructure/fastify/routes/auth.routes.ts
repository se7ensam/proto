/**
 * Auth routes - Thin HTTP adapters for auth domain service
 */

import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const googleLoginSchema = z.object({
  token: z.string(),
})

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Signup
  fastify.post('/signup', async (request, reply) => {
    const body = signupSchema.parse(request.body)
    
    const result = await fastify.services.auth.register(body.email, body.password)
    
    // Warm cache if Redis is available
    if (fastify.messageRepo && typeof fastify.messageRepo.warmCache === 'function') {
      fastify.messageRepo.warmCache(result.user.id).catch((err) => {
        fastify.log.error({ err, userId: result.user.id }, 'Failed to warm cache on signup')
      })
    }
    
    return reply.send({
      user: {
        id: result.user.id,
        email: result.user.email,
      },
      token: result.token,
    })
  })

  // Login
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)
    
    const result = await fastify.services.auth.login(body.email, body.password)
    
    // Warm cache if Redis is available
    if (fastify.messageRepo && typeof fastify.messageRepo.warmCache === 'function') {
      fastify.messageRepo.warmCache(result.user.id).catch((err) => {
        fastify.log.error({ err, userId: result.user.id }, 'Failed to warm cache on login')
      })
    }
    
    return reply.send({
      user: {
        id: result.user.id,
        email: result.user.email,
      },
      token: result.token,
    })
  })

  // Google OAuth
  fastify.post('/google', async (request, reply) => {
    const body = googleLoginSchema.parse(request.body)
    
    const result = await fastify.services.auth.loginWithGoogle(body.token)
    
    // Warm cache if Redis is available
    if (fastify.messageRepo && typeof fastify.messageRepo.warmCache === 'function') {
      fastify.messageRepo.warmCache(result.user.id).catch((err) => {
        fastify.log.error({ err, userId: result.user.id }, 'Failed to warm cache on Google login')
      })
    }
    
    return reply.send({
      user: {
        id: result.user.id,
        email: result.user.email,
      },
      token: result.token,
    })
  })
}

export default authRoutes
