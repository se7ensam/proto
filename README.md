# AI Chat UI - Frontend & Backend Boilerplate

A full-stack AI chat application with separate chat and plan management features.

## Architecture

This project follows a handoff pattern architecture where:
- **Chat messages** are separate from **plan updates** unless explicitly applied
- The backend maintains conversation context and enforces structured output
- Planning rules can be injected into prompts dynamically

## Project Structure

```
proto/
├── frontend/          # React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── services/      # API service layer
│   │   └── types.ts       # TypeScript types
│   └── package.json
│
└── backend/           # Node.js + TypeScript + Fastify
    ├── src/
    │   ├── domain/        # Business logic (framework-agnostic)
    │   │   ├── services/  # Domain services
    │   │   ├── repositories.ts  # Repository interfaces
    │   │   ├── errors.ts  # Typed errors
    │   │   └── types.ts   # Domain types
    │   ├── infrastructure/  # Framework & external dependencies
    │   │   ├── repositories/  # PostgreSQL implementations
    │   │   ├── services/  # LLM, Auth adapters
    │   │   ├── fastify/   # Fastify plugins & routes
    │   │   ├── logger.ts  # Structured logging
    │   │   └── metrics.ts # Prometheus metrics
    │   ├── db/           # Database schema
    │   ├── app.ts        # Fastify app setup
    │   ├── index.ts      # Entry point
    │   └── env.ts        # Environment loader
    ├── tests/            # Test files
    │   └── helpers.ts    # Test utilities
    ├── docs/             # Documentation
    └── package.json
```

## Features

### Frontend
- ✅ Custom chat UI with message types: `user`, `ai`, `system`, `plan_update`
- ✅ Split-panel layout: Chat (left) + Plan Draft (right)
- ✅ Action buttons: "Apply to Plan", "Regenerate", "Lock Section"
- ✅ Real-time plan updates when AI suggestions are applied

### Backend
- ✅ Domain-driven architecture (framework-agnostic business logic)
- ✅ PostgreSQL persistence for messages and plans
- ✅ Typed error handling (domain vs infrastructure errors)
- ✅ Structured logging with Pino
- ✅ Prometheus metrics for observability
- ✅ Rate limiting and input sanitization
- ✅ Comprehensive unit tests
- ✅ Repository pattern for data access
- ✅ TypeScript strict mode

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:3000`

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

Backend will run on `http://localhost:3001`

**Environment Variables:**
- `GEMINI_API_KEY` - Your Google Gemini API key (required for AI responses)
  - Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
  - Set it as an environment variable: `export GEMINI_API_KEY=your_api_key_here`

## API Endpoints

### Chat
- `POST /api/chat/message` - Send a message and get AI response
- `POST /api/chat/regenerate` - Regenerate an AI message
- `GET /api/chat/history/:conversationId` - Get conversation history

### Plan
- `POST /api/plan/apply` - Apply an AI message to the plan
- `GET /api/plan/sections/:conversationId` - Get plan sections
- `PATCH /api/plan/section` - Update a plan section
- `POST /api/plan/lock` - Lock/unlock a plan section

## Key UX Rule

**AI messages ≠ Plan updates unless explicitly applied**

This means:
- AI responses in chat are suggestions only
- Users must click "Apply to Plan" to add content to the plan
- Plan updates are tracked separately and shown as `plan_update` messages

## LLM Integration

The backend is configured to use **Google Gemini API** for generating AI responses.

- The LLM service is located in `backend/src/services/llm.service.ts`
- Currently using the `gemini-pro` model
- Set the `GEMINI_API_KEY` environment variable to enable AI responses
- If the API key is not set, the service will return placeholder responses

### Database Integration
Replace in-memory storage in `backend/src/services/context.service.ts` with a database (PostgreSQL, MongoDB, etc.)

### Structured Output
Implement structured output from your LLM to extract plan suggestions automatically.

## Tech Stack

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- TypeScript

**Backend:**
- Node.js 18+
- Fastify 5.x
- TypeScript (strict mode)
- PostgreSQL 15 + Drizzle ORM
- Redis (rate limiting & caching)
- Pino (structured logging)
- Prometheus (metrics)
- Zod (schema validation)
- Vitest (testing)

## License

See LICENSE file
