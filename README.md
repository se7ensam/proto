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
└── backend/           # Node.js + TypeScript + Express
    ├── src/
    │   ├── routes/        # API routes
    │   ├── services/       # Business logic
    │   ├── schemas/       # Zod validation schemas
    │   └── types.ts       # TypeScript types
    └── package.json
```

## Features

### Frontend
- ✅ Custom chat UI with message types: `user`, `ai`, `system`, `plan_update`
- ✅ Split-panel layout: Chat (left) + Plan Draft (right)
- ✅ Action buttons: "Apply to Plan", "Regenerate", "Lock Section"
- ✅ Real-time plan updates when AI suggestions are applied

### Backend
- ✅ Conversation context management
- ✅ Planning rules injection into prompts
- ✅ Structured output enforcement (via Zod schemas)
- ✅ Separate chat vs plan mutations
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

## Next Steps

### LLM Integration
Replace the placeholder in `backend/src/services/llm.service.ts` with your LLM provider:

```typescript
// Example with OpenAI
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async generateResponse(userMessage: string, context: ConversationContext): Promise<string> {
  const prompt = this.promptService.buildPromptWithRules(userMessage, context)
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  })
  return completion.choices[0].message.content || ''
}
```

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
- Node.js
- Express
- TypeScript (strict mode)
- Zod (schema validation)

## License

See LICENSE file
