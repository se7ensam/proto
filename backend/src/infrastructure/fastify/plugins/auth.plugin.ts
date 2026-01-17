/**
 * Auth plugin - JWT authentication decorator
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { AuthenticationError } from '../../../domain/errors'

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string
    userEmail?: string
  }
  
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthenticationError('Authentication token required')
      }

      const token = authHeader.substring(7)
      const user = await fastify.services.auth.verifyToken(token)

      request.userId = user.id
      request.userEmail = user.email
    } catch (error) {
      throw error
    }
  })
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['services'],
})
