# Backend Project Structure

## Overview

The backend follows a clean architecture with clear separation between business logic, infrastructure, tests, and documentation.

## Directory Structure

```
backend/
├── src/                          # Source code
│   ├── domain/                   # Business logic (framework-agnostic)
│   │   ├── services/             # Domain services
│   │   │   ├── auth.service.ts
│   │   │   ├── chat.service.ts
│   │   │   └── plan.service.ts
│   │   ├── errors.ts             # Typed error hierarchy
│   │   ├── repositories.ts       # Repository interfaces
│   │   └── types.ts              # Domain entities
│   │
│   ├── infrastructure/           # External dependencies
│   │   ├── repositories/         # PostgreSQL implementations
│   │   │   ├── conversation.repository.ts
│   │   │   ├── message.repository.ts
│   │   │   ├── plan-section.repository.ts
│   │   │   ├── planning-rules.repository.ts
│   │   │   └── user.repository.ts
│   │   ├── services/             # External service adapters
│   │   │   ├── google-auth.service.ts
│   │   │   ├── llm.service.ts
│   │   │   └── token.service.ts
│   │   ├── fastify/              # Fastify-specific code
│   │   │   ├── plugins/          # Fastify plugins
│   │   │   │   ├── auth.plugin.ts
│   │   │   │   ├── db.plugin.ts
│   │   │   │   ├── error-handler.plugin.ts
│   │   │   │   ├── metrics.plugin.ts
│   │   │   │   └── services.plugin.ts
│   │   │   └── routes/           # HTTP route handlers
│   │   │       ├── auth.routes.ts
│   │   │       ├── chat.routes.ts
│   │   │       └── plan.routes.ts
│   │   ├── logger.ts             # Structured logging (Pino)
│   │   ├── metrics.ts            # Prometheus metrics
│   │   └── sanitizer.ts          # Input sanitization (DOMPurify)
│   │
│   ├── db/                       # Database
│   │   ├── index.ts              # Database connection
│   │   └── schema.ts             # Drizzle schema
│   │
│   ├── app.ts                    # Fastify application setup
│   ├── index.ts                  # Entry point
│   └── env.ts                    # Environment loader
│
├── tests/                        # Test files
│   ├── auth.service.test.ts      # Auth service tests (14 tests)
│   ├── chat.service.test.ts      # Chat service tests (7 tests)
│   ├── plan.service.test.ts      # Plan service tests (9 tests)
│   ├── helpers.ts                # Test utilities
│   └── README.md                 # Test documentation
│
├── docs/                         # Documentation
│   ├── QUICKSTART.md             # Quick start guide
│   ├── REFACTORING.md            # Architecture details
│   ├── MIGRATION_SUMMARY.md      # Migration details
│   ├── COMPLETION_REPORT.md      # Verification report
│   └── README.md                 # Documentation index
│
├── drizzle/                      # Database migrations
│   └── 0000_chilly_randall.sql   # Initial migration
│
├── dist/                         # Build output (generated)
├── node_modules/                 # Dependencies (generated)
│
├── .env                          # Environment variables (not in git)
├── .eslintrc.js                  # ESLint configuration
├── .gitignore                    # Git ignore rules
├── docker-compose.yml            # Docker services
├── Dockerfile                    # Docker build
├── drizzle.config.ts             # Drizzle configuration
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
└── vitest.config.ts              # Vitest configuration
```

## Layer Responsibilities

### Domain Layer (`src/domain/`)
**Purpose**: Pure business logic, framework-agnostic

- **Services**: Business logic implementation
  - `auth.service.ts` - Authentication and authorization
  - `chat.service.ts` - Chat and messaging logic
  - `plan.service.ts` - Plan management logic

- **Repositories**: Data access interfaces
  - Define contracts for data operations
  - No implementation details

- **Types**: Domain entities and value objects
  - `User`, `Message`, `Conversation`, `PlanSection`
  - Framework-agnostic data structures

- **Errors**: Typed error hierarchy
  - Domain errors (ValidationError, AuthenticationError, etc.)
  - Infrastructure errors (DatabaseError, LLMError, etc.)

**Rules**:
- ✅ No framework imports
- ✅ No database imports
- ✅ Pure TypeScript
- ✅ Fully testable

### Infrastructure Layer (`src/infrastructure/`)
**Purpose**: External dependencies and adapters

- **Repositories**: PostgreSQL implementations
  - Implement domain repository interfaces
  - Use Drizzle ORM
  - Handle database errors

- **Services**: External service adapters
  - LLM service (Gemini)
  - Token service (JWT)
  - Google Auth service

- **Fastify**: Web framework code
  - Plugins for dependency injection
  - Routes as thin HTTP adapters
  - Error handling

- **Utilities**:
  - Logger (Pino)
  - Metrics (Prometheus)
  - Sanitizer (DOMPurify)

**Rules**:
- ✅ Can import from domain
- ✅ Can import frameworks
- ✅ Adapts external systems to domain interfaces

### Database Layer (`src/db/`)
**Purpose**: Database schema and connection

- **schema.ts**: Drizzle schema definitions
  - Tables: users, conversations, messages, plan_sections, planning_rules
  - Indexes for performance
  - Foreign key relationships

- **index.ts**: Database connection
  - PostgreSQL connection pool
  - Drizzle ORM instance

### Tests (`tests/`)
**Purpose**: Test suites for domain services

- **Test Files**: One per domain service
  - `auth.service.test.ts` - 14 tests
  - `chat.service.test.ts` - 7 tests
  - `plan.service.test.ts` - 9 tests

- **helpers.ts**: Test utilities
  - Mock creators
  - Test data factories
  - Reusable test helpers

**Rules**:
- ✅ Test domain services only
- ✅ Mock all dependencies
- ✅ Use helpers for consistency

### Documentation (`docs/`)
**Purpose**: Project documentation

- **QUICKSTART.md**: Setup and getting started
- **REFACTORING.md**: Architecture and design
- **MIGRATION_SUMMARY.md**: What changed
- **COMPLETION_REPORT.md**: Verification
- **README.md**: Documentation index

## File Naming Conventions

- **Services**: `*.service.ts` (domain services)
- **Repositories**: `*.repository.ts` (data access)
- **Routes**: `*.routes.ts` (HTTP handlers)
- **Plugins**: `*.plugin.ts` (Fastify plugins)
- **Tests**: `*.test.ts` (test files)
- **Types**: `*.types.ts` or `types.ts` (type definitions)

## Import Rules

### Domain Layer
```typescript
// ✅ Allowed
import { User } from './types'
import { IUserRepository } from './repositories'
import { ValidationError } from './errors'

// ❌ Not allowed
import { FastifyRequest } from 'fastify'
import { db } from '../db'
```

### Infrastructure Layer
```typescript
// ✅ Allowed
import { FastifyPluginAsync } from 'fastify'
import { IUserRepository } from '../../domain/repositories'
import { db } from '../../db'

// ✅ Can import from domain
import { AuthService } from '../../domain/services/auth.service'
```

### Tests
```typescript
// ✅ Allowed
import { ChatService } from '../src/domain/services/chat.service'
import { createMockRepository } from './helpers'

// ✅ Can import from domain
import { ValidationError } from '../src/domain/errors'
```

## Configuration Files

- **tsconfig.json**: TypeScript compiler options
  - Target: ES2022
  - Module: CommonJS
  - Strict mode enabled

- **vitest.config.ts**: Test configuration
  - Test files: `tests/**/*.test.ts`
  - Environment: Node.js

- **drizzle.config.ts**: Database configuration
  - Schema: `src/db/schema.ts`
  - Migrations: `drizzle/`
  - Dialect: PostgreSQL

- **docker-compose.yml**: Services
  - PostgreSQL (port 5433)
  - Redis (port 6379)
  - Backend (port 3001)
  - Frontend (port 3000)

## Key Principles

1. **Separation of Concerns**: Each layer has a single responsibility
2. **Dependency Inversion**: Domain defines interfaces, infrastructure implements
3. **Framework Agnostic**: Business logic has no framework dependencies
4. **Testability**: Domain services are fully testable with mocks
5. **Type Safety**: Strict TypeScript throughout
6. **Clear Boundaries**: Explicit imports between layers

## Quick Reference

### Run Commands
```bash
npm run dev          # Start development server
npm test             # Run tests
npm run build        # Build for production
npm start            # Start production server
```

### Database Commands
```bash
npm run db:generate  # Generate migration
npm run db:push      # Apply migration
```

### Development Workflow
1. Make changes in `src/`
2. Run tests: `npm test`
3. Check types: `npm run type-check`
4. Build: `npm run build`

## Related Documentation

- [Quick Start Guide](./docs/QUICKSTART.md)
- [Architecture Details](./docs/REFACTORING.md)
- [Migration Summary](./docs/MIGRATION_SUMMARY.md)
- [Test Documentation](./tests/README.md)
