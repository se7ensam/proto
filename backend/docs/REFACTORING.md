# Backend Refactoring Documentation

## Overview

This document describes the comprehensive refactoring of the AI Chat backend to follow senior engineering best practices and architectural principles.

## Major Changes

### 1. Framework Migration: Express → Fastify

**Why**: Fastify provides better performance, built-in schema validation, and a plugin-based architecture that aligns with dependency boundaries.

**Changes**:
- Replaced Express with Fastify 5.x
- Migrated middleware to Fastify plugins
- Implemented plugin-based dependency injection
- Added proper lifecycle hooks for graceful shutdown

### 2. Domain-Driven Architecture

**Layered Architecture**:
```
domain/           # Business logic (framework-agnostic)
├── errors.ts     # Typed error hierarchy
├── types.ts      # Domain entities and value objects
├── repositories.ts  # Repository interfaces
└── services/     # Domain services with business logic

infrastructure/   # Framework and external dependencies
├── repositories/ # PostgreSQL implementations
├── services/     # LLM, Token, Google Auth adapters
├── fastify/      # Fastify-specific code
│   ├── plugins/  # Dependency injection
│   └── routes/   # Thin HTTP adapters
├── logger.ts     # Structured logging
├── metrics.ts    # Prometheus metrics
└── sanitizer.ts  # Input sanitization
```

**Key Principles**:
- Business logic is framework-agnostic and testable
- Clear separation between domain and infrastructure
- Dependency inversion (domain defines interfaces, infrastructure implements)
- No framework imports in domain layer

### 3. Error Handling

**Typed Error Hierarchy**:
```typescript
DomainError (400-level)
├── ValidationError (400)
├── AuthenticationError (401)
├── AuthorizationError (403)
├── NotFoundError (404)
├── ConflictError (409)
└── RateLimitError (429)

InfrastructureError (500-level)
├── DatabaseError
├── CacheError
├── ExternalServiceError
└── LLMError
```

**Benefits**:
- Errors are part of the API contract
- Clear distinction between client and server errors
- Infrastructure errors never leak internal details
- Centralized error formatting

### 4. PostgreSQL Persistence

**Previous**: Redis-only (ephemeral)
**Now**: PostgreSQL with proper schema

**New Tables**:
- `users` - User accounts
- `conversations` - Conversation metadata
- `messages` - Persistent message history
- `plan_sections` - Plan sections with locking
- `planning_rules` - Conversation-specific rules

**Benefits**:
- Data survives restarts
- ACID transactions
- Proper foreign key relationships
- Indexed queries for performance

### 5. Repository Pattern

**Interfaces** (`domain/repositories.ts`):
- Define what the domain needs
- Framework-agnostic contracts
- Easy to mock for testing

**Implementations** (`infrastructure/repositories/`):
- PostgreSQL-specific code
- Error handling and type conversion
- Transaction support

**Benefits**:
- Testable without database
- Can swap implementations (e.g., for testing)
- Clear data access boundaries

### 6. Structured Logging

**Pino Logger**:
- JSON-structured logs in production
- Pretty-printed logs in development
- Request correlation with `requestId`
- Error serialization with stack traces

**Log Levels**:
- `debug` - Development diagnostics
- `info` - Request/response, business events
- `warn` - Recoverable issues
- `error` - Errors with context

### 7. Observability & Metrics

**Prometheus Metrics**:
- HTTP request count and duration
- LLM request count, duration, tokens
- Database query count and duration
- Business metrics (messages, plan sections)
- Error counts by type

**Endpoints**:
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics

### 8. Security Hardening

**Rate Limiting**:
- 100 requests per minute per IP
- Redis-backed for distributed systems
- Configurable per route

**Input Sanitization**:
- DOMPurify for HTML sanitization
- XSS prevention on all user inputs
- Configurable allowed tags

**Authentication**:
- JWT with 7-day expiration
- Secure password hashing (bcrypt)
- Google OAuth support

### 9. Comprehensive Testing

**Test Coverage**:
- Domain service unit tests
- Mock repositories and services
- Test helpers and factories
- Vitest for fast execution

**Test Files** (in `tests/`):
- `chat.service.test.ts` - Chat business logic
- `auth.service.test.ts` - Authentication logic
- `plan.service.test.ts` - Plan management logic
- `helpers.ts` - Test utilities and factories

## Migration Guide

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Run Database Migrations

```bash
npm run db:generate
npm run db:push
```

### 3. Update Environment Variables

```env
# Required
DATABASE_URL=postgres://postgres:postgres@localhost:5433/ai_chat
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secure-secret-key

# Optional
GEMINI_API_KEY=your-gemini-key
GOOGLE_CLIENT_ID=your-google-client-id
PORT=3001
HOST=0.0.0.0
LOG_LEVEL=info
```

### 4. Start the Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 5. Run Tests

```bash
npm test
npm run test:watch
```

## API Changes

### Breaking Changes

1. **Error Response Format**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "email": "Invalid email address"
    }
  }
}
```

2. **Authentication Required**:
All `/api/chat` and `/api/plan` endpoints now require `Authorization: Bearer <token>` header.

3. **Conversation Scoping**:
Conversations are now automatically scoped to the authenticated user.

### New Endpoints

- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics

## Performance Improvements

1. **Database Indexing**:
   - Indexed foreign keys
   - Indexed timestamp columns
   - Optimized query patterns

2. **Connection Pooling**:
   - PostgreSQL connection pool
   - Redis connection reuse

3. **Streaming**:
   - Maintained SSE streaming for AI responses
   - Efficient chunk processing

## Monitoring & Debugging

### Logs

```bash
# View logs in development
npm run dev

# Production logs (JSON)
npm start | pino-pretty
```

### Metrics

```bash
# Access metrics
curl http://localhost:3001/metrics

# Integrate with Prometheus
# Add to prometheus.yml:
scrape_configs:
  - job_name: 'ai-chat-backend'
    static_configs:
      - targets: ['localhost:3001']
```

### Health Checks

```bash
curl http://localhost:3001/health
```

## Architecture Decisions

### Why Fastify over Express?

1. **Performance**: 2-3x faster than Express
2. **Schema Validation**: Built-in with JSON Schema
3. **Plugin System**: Better dependency management
4. **TypeScript**: First-class TypeScript support
5. **Ecosystem**: Modern, actively maintained

### Why Repository Pattern?

1. **Testability**: Easy to mock data access
2. **Flexibility**: Can swap implementations
3. **Separation**: Clear boundary between domain and data
4. **Maintainability**: Changes to data layer don't affect domain

### Why Domain Services?

1. **Testability**: Pure business logic, no framework
2. **Reusability**: Can be used from different entry points
3. **Clarity**: Business rules in one place
4. **Maintainability**: Easy to understand and modify

## Future Improvements

1. **Caching Layer**:
   - Redis caching for frequently accessed data
   - Cache invalidation strategies

2. **Event Sourcing**:
   - Event log for audit trail
   - Replay capability

3. **Message Queue**:
   - Async processing for long-running tasks
   - Background jobs

4. **API Versioning**:
   - `/api/v1/` prefix
   - Backward compatibility

5. **GraphQL**:
   - Alternative to REST
   - Client-driven queries

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check connection
psql $DATABASE_URL
```

### Redis Connection Issues

```bash
# Check Redis is running
docker-compose ps redis

# Test connection
redis-cli -u $REDIS_URL ping
```

### Migration Issues

```bash
# Reset database (WARNING: destroys data)
npm run db:push -- --force
```

## Contact

For questions or issues, please refer to the main README or open an issue.
