/**
 * Error handler plugin - Centralized error handling
 */

import { FastifyPluginAsync, FastifyError } from 'fastify'
import fp from 'fastify-plugin'
import { isDomainError, isInfrastructureError, formatErrorResponse, getStatusCode } from '../../../domain/errors'
import { logger, logError } from '../../logger'
import { ZodError } from 'zod'

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error: FastifyError | Error, request, reply) => {
    // Log error with context
    logError(error, {
      method: request.method,
      url: request.url,
      userId: request.userId,
    })

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fields: error.errors.reduce((acc, err) => {
            const path = err.path.join('.')
            acc[path] = err.message
            return acc
          }, {} as Record<string, string>),
        },
      })
    }

    // Handle domain and infrastructure errors
    if (isDomainError(error) || isInfrastructureError(error)) {
      const statusCode = getStatusCode(error)
      const response = formatErrorResponse(error)

      // Don't log stack traces for expected domain errors
      if (!isDomainError(error)) {
        logger.error({ err: error }, 'Infrastructure error occurred')
      }

      return reply.status(statusCode).send(response)
    }

    // Handle Fastify errors
    if ('statusCode' in error && error.statusCode) {
      return reply.status(error.statusCode).send({
        error: {
          code: 'FASTIFY_ERROR',
          message: error.message,
        },
      })
    }

    // Handle unknown errors
    logger.error({ err: error }, 'Unexpected error occurred')
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    })
  })
}

export default fp(errorHandlerPlugin, {
  name: 'error-handler',
})
