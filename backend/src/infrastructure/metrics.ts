/**
 * Prometheus metrics for observability
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client'

export const register = new Registry()

// HTTP metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
})

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
})

// LLM metrics
export const llmRequestsTotal = new Counter({
  name: 'llm_requests_total',
  help: 'Total number of LLM requests',
  labelNames: ['model', 'status'],
  registers: [register],
})

export const llmRequestDuration = new Histogram({
  name: 'llm_request_duration_seconds',
  help: 'LLM request duration in seconds',
  labelNames: ['model'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
})

export const llmTokensUsed = new Counter({
  name: 'llm_tokens_used_total',
  help: 'Total number of LLM tokens used',
  labelNames: ['model', 'type'],
  registers: [register],
})

// Database metrics
export const dbQueriesTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table'],
  registers: [register],
})

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
})

// Business metrics
export const messagesCreated = new Counter({
  name: 'messages_created_total',
  help: 'Total number of messages created',
  labelNames: ['type'],
  registers: [register],
})

export const planSectionsCreated = new Counter({
  name: 'plan_sections_created_total',
  help: 'Total number of plan sections created',
  registers: [register],
})

export const activeConversations = new Gauge({
  name: 'active_conversations',
  help: 'Number of active conversations',
  registers: [register],
})

// Error metrics
export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code'],
  registers: [register],
})

// Default metrics (CPU, memory, etc.)
import { collectDefaultMetrics } from 'prom-client'
collectDefaultMetrics({ register })
