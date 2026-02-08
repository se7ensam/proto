/**
 * Database plugin - Provides database connection to routes
 */

import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { db } from '../../../db'

declare module 'fastify' {
  interface FastifyInstance {
    db: typeof db
  }
}

const dbPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('db', db)

  fastify.addHook('onClose', async () => {
    // Close database connection on shutdown
    // Note: drizzle-orm with node-postgres doesn't expose close method directly
    // The pool will be closed when the process exits
  })
}

export default fp(dbPlugin, {
  name: 'db',
})
