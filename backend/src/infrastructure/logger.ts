/**
 * Structured logging with Pino
 */

import pino from 'pino'

const isDevelopment = process.env.NODE_ENV !== 'production'

export const logger = pino({
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
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
})

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context)
}

/**
 * Log request/response for debugging
 */
export function logRequest(method: string, url: string, userId?: string) {
  logger.info({ method, url, userId }, 'Incoming request')
}

export function logResponse(method: string, url: string, statusCode: number, duration: number) {
  logger.info({ method, url, statusCode, duration }, 'Request completed')
}

export function logError(error: Error, context?: Record<string, unknown>) {
  logger.error({ err: error, ...context }, error.message)
}
