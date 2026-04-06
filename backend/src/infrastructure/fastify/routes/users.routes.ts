import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const searchSchema = z.object({
  q: z.string().min(1),
})

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/search',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const query = searchSchema.parse(request.query)
      const users = await fastify.services.auth.searchUsers(query.q, 10)
      
      // Don't return passwords
      return reply.send({
        users: users.map((u: any) => ({
          id: u.id,
          email: u.email,
        }))
      })
    }
  )
}

export default usersRoutes
