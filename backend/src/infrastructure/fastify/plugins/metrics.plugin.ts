/**
 * Metrics plugin - Request/response metrics collection
 */

import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { httpRequestsTotal, httpRequestDuration } from '../../metrics'

const metricsPlugin: FastifyPluginAsync = async (fastify) => {
  // Hook to measure request duration
  fastify.addHook('onRequest', async (request, reply) => {
    request.startTime = Date.now()
  })

  fastify.addHook('onResponse', async (request, reply) => {
    const duration = (Date.now() - (request.startTime || Date.now())) / 1000
    const route = request.routeOptions.url || request.url
    const method = request.method
    const statusCode = reply.statusCode.toString()

    // Record metrics
    httpRequestsTotal.inc({ method, route, status_code: statusCode })
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration)
  })
}

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number
  }
}

export default fp(metricsPlugin, {
  name: 'metrics',
})
