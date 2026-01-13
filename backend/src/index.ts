// Import env loader FIRST - this must be before any other imports
import './env'

import express from 'express'
import cors from 'cors'
import { chatRouter } from './routes/chat'
import { planRouter } from './routes/plan'
import { authRouter } from './routes/auth'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/chat', chatRouter)
app.use('/api/plan', planRouter)
app.use('/api/auth', authRouter)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
