# Quick Start Guide

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15
- Redis

## 1. Install Dependencies

```bash
cd backend
npm install
```

## 2. Set Up Environment

Create a `.env` file:

```env
# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5433/ai_chat

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-key-change-this-in-production

# LLM (Optional)
GEMINI_API_KEY=your-gemini-api-key

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id

# Server
PORT=3001
HOST=0.0.0.0
LOG_LEVEL=info
NODE_ENV=development
```

## 3. Start Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Verify services are running
docker-compose ps
```

## 4. Run Database Migrations

```bash
# Generate migration (already done)
npm run db:generate

# Apply migration
npm run db:push
```

## 5. Start the Server

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

## 6. Verify Installation

```bash
# Health check
curl http://localhost:3001/health

# Expected response:
# {"status":"ok","timestamp":"...","uptime":...}

# Metrics
curl http://localhost:3001/metrics

# Should return Prometheus metrics
```

## 7. Test the API

### Signup

```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Response:
```json
{
  "user": {
    "id": "...",
    "email": "test@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Send Message (Streaming)

```bash
TOKEN="your-jwt-token-from-login"

curl -X POST http://localhost:3001/api/chat/message/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "content": "Hello, AI!",
    "conversationId": "default"
  }'
```

### Get Conversation History

```bash
curl http://localhost:3001/api/chat/history/default \
  -H "Authorization: Bearer $TOKEN"
```

### Apply Message to Plan

```bash
curl -X POST http://localhost:3001/api/plan/apply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "messageId": "msg-id-from-chat",
    "conversationId": "default"
  }'
```

### Get Plan Sections

```bash
curl http://localhost:3001/api/plan/sections/default \
  -H "Authorization: Bearer $TOKEN"
```

## 8. Run Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Type checking
npm run type-check
```

## Common Issues

### Database Connection Error

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart
docker-compose restart postgres
```

### Redis Connection Error

```bash
# Check Redis is running
docker-compose ps redis

# Test connection
redis-cli -u redis://localhost:6379 ping
```

### Port Already in Use

```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Migration Issues

```bash
# Reset database (WARNING: destroys all data)
npm run db:push -- --force

# Or manually drop and recreate
psql -U postgres -h localhost -p 5433
DROP DATABASE ai_chat;
CREATE DATABASE ai_chat;
\q

npm run db:push
```

## Development Workflow

### 1. Make Changes

Edit files in `src/`

### 2. Run Tests

```bash
npm test
```

### 3. Check Types

```bash
npm run type-check
```

### 4. Test Locally

```bash
npm run dev
```

### 5. Build

```bash
npm run build
```

## Project Structure

```
backend/
├── src/
│   ├── domain/              # Business logic
│   │   ├── services/        # Domain services
│   │   ├── errors.ts        # Error types
│   │   ├── types.ts         # Domain types
│   │   └── repositories.ts  # Repository interfaces
│   ├── infrastructure/      # External dependencies
│   │   ├── repositories/    # PostgreSQL repos
│   │   ├── services/        # External services
│   │   ├── fastify/         # Fastify code
│   │   ├── logger.ts        # Logging
│   │   ├── metrics.ts       # Metrics
│   │   └── sanitizer.ts     # Sanitization
│   ├── db/                  # Database schema
│   ├── app.ts               # Fastify app
│   ├── index.ts             # Entry point
│   └── env.ts               # Env loader
├── tests/                   # Test files
│   ├── *.test.ts            # Test suites
│   └── helpers.ts           # Test utilities
├── docs/                    # Documentation
│   ├── QUICKSTART.md
│   ├── REFACTORING.md
│   ├── MIGRATION_SUMMARY.md
│   └── COMPLETION_REPORT.md
├── drizzle/                 # Migrations
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Useful Commands

```bash
# Development
npm run dev              # Start with hot reload
npm run type-check       # Check TypeScript types

# Testing
npm test                 # Run tests once
npm run test:watch       # Watch mode

# Database
npm run db:generate      # Generate migration
npm run db:push          # Apply migration

# Production
npm run build            # Build for production
npm start                # Start production server

# Docker
docker-compose up -d     # Start all services
docker-compose down      # Stop all services
docker-compose logs -f   # Follow logs
```

## Monitoring

### Logs

```bash
# Development (pretty printed)
npm run dev

# Production (JSON)
npm start | pino-pretty
```

### Metrics

Access Prometheus metrics at: http://localhost:3001/metrics

Key metrics:
- `http_requests_total` - Request count
- `http_request_duration_seconds` - Request latency
- `llm_requests_total` - LLM request count
- `db_queries_total` - Database query count
- `errors_total` - Error count

### Health Check

```bash
curl http://localhost:3001/health
```

## Next Steps

1. Configure Gemini API key for AI responses
2. Set up Google OAuth for social login
3. Configure Prometheus for metrics collection
4. Set up log aggregation (e.g., ELK stack)
5. Configure production database
6. Set up CI/CD pipeline

## Support

- See `REFACTORING.md` for detailed architecture
- See `MIGRATION_SUMMARY.md` for migration details
- Check inline code comments
- Open an issue on GitHub

## License

See LICENSE file
