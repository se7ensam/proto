/**
 * Domain Errors - Business logic violations
 */

export abstract class DomainError extends Error {
  abstract readonly code: string
  abstract readonly statusCode: number

  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR'
  readonly statusCode = 400

  constructor(message: string, public readonly fields?: Record<string, string>) {
    super(message)
  }
}

export class AuthenticationError extends DomainError {
  readonly code = 'AUTHENTICATION_ERROR'
  readonly statusCode = 401

  constructor(message: string = 'Authentication required') {
    super(message)
  }
}

export class AuthorizationError extends DomainError {
  readonly code = 'AUTHORIZATION_ERROR'
  readonly statusCode = 403

  constructor(message: string = 'Insufficient permissions') {
    super(message)
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND'
  readonly statusCode = 404

  constructor(resource: string, identifier?: string) {
    super(identifier ? `${resource} with id '${identifier}' not found` : `${resource} not found`)
  }
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT'
  readonly statusCode = 409

  constructor(message: string) {
    super(message)
  }
}

export class RateLimitError extends DomainError {
  readonly code = 'RATE_LIMIT_EXCEEDED'
  readonly statusCode = 429

  constructor(message: string = 'Rate limit exceeded') {
    super(message)
  }
}

/**
 * Infrastructure Errors - External system failures
 */

export abstract class InfrastructureError extends Error {
  abstract readonly code: string
  readonly statusCode = 500

  constructor(message: string, public readonly cause?: Error) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class DatabaseError extends InfrastructureError {
  readonly code = 'DATABASE_ERROR'

  constructor(message: string, cause?: Error) {
    super(message, cause)
  }
}

export class CacheError extends InfrastructureError {
  readonly code = 'CACHE_ERROR'

  constructor(message: string, cause?: Error) {
    super(message, cause)
  }
}

export class ExternalServiceError extends InfrastructureError {
  readonly code = 'EXTERNAL_SERVICE_ERROR'

  constructor(service: string, message: string, cause?: Error) {
    super(`${service}: ${message}`, cause)
  }
}

export class LLMError extends InfrastructureError {
  readonly code = 'LLM_ERROR'

  constructor(message: string, cause?: Error) {
    super(message, cause)
  }
}

/**
 * Type guards
 */

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError
}

export function isInfrastructureError(error: unknown): error is InfrastructureError {
  return error instanceof InfrastructureError
}

/**
 * Error response formatter
 */

export interface ErrorResponse {
  error: {
    code: string
    message: string
    fields?: Record<string, string>
  }
}

export function formatErrorResponse(error: unknown): ErrorResponse {
  if (isDomainError(error)) {
    const response: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
      },
    }

    if (error instanceof ValidationError && error.fields) {
      response.error.fields = error.fields
    }

    return response
  }

  if (isInfrastructureError(error)) {
    return {
      error: {
        code: error.code,
        message: 'An internal error occurred',
      },
    }
  }

  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  }
}

export function getStatusCode(error: unknown): number {
  if (isDomainError(error) || isInfrastructureError(error)) {
    return error.statusCode
  }
  return 500
}
