import { Router, Response } from 'express'
import { sendMessageSchema, regenerateMessageSchema } from '../schemas/chat.schema'
import { contextService } from '../services/context.service'
import { llmService } from '../services/llm.service'
import { Message } from '../types'
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware'

export const chatRouter = Router()

// Send a new message (streaming)
chatRouter.post('/message/stream', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const validated = sendMessageSchema.parse(req.body)
    const conversationId = validated.conversationId || 'default'
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    console.log(`[Chat] userId=${userId}`)
    const scopedConversationId = `user:${userId}:${conversationId}`

    // Create user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: validated.content,
      timestamp: new Date(),
    }

    // Add to context and get conversation in one round-trip
    const context = await contextService.addMessageAndGetContext(
      scopedConversationId,
      userMessage
    )

    // Track client disconnects to stop streaming work
    let clientClosed = false
    req.on('close', () => {
      clientClosed = true
    })

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering

    // Send initial message with user message info
    res.write(`data: ${JSON.stringify({ type: 'user', message: userMessage })}\n\n`)
    if (res.flushHeaders) res.flushHeaders()

    // Create AI message ID
    const aiMessageId = (Date.now() + 1).toString()

    // Send AI message ID so frontend can create placeholder
    res.write(`data: ${JSON.stringify({ type: 'ai_start', messageId: aiMessageId })}\n\n`)

    let fullContent = ''

    // Stream the AI response
    try {
      let chunkIndex = 0
      for await (const chunk of llmService.generateResponseStream(
        validated.content,
        context
      )) {
        if (clientClosed) {
          res.end()
          return
        }
        chunkIndex++
        fullContent += chunk
        // Send chunk immediately without waiting
        const data = `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`
        res.write(data)
        // Force flush immediately for faster response
        if (typeof (res as any).flush === 'function') {
          (res as any).flush()
        }
      }
      console.log(`[Chat Router] Stream complete - ${chunkIndex} chunks, ${fullContent.length} chars`)

      if (clientClosed) {
        res.end()
        return
      }

      // Create complete AI message
      const aiMessage: Message = {
        id: aiMessageId,
        type: 'ai',
        content: fullContent,
        timestamp: new Date(),
      }

      // Add AI message to context
      await contextService.addMessage(scopedConversationId, aiMessage)

      // Send completion message
      res.write(`data: ${JSON.stringify({ type: 'done', message: aiMessage })}\n\n`)
      return res.end()
    } catch (streamError) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', error: streamError instanceof Error ? streamError.message : 'Streaming error' })}\n\n`
      )
      return res.end()
    }
  } catch (error) {
    if (!res.headersSent) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Internal server error' })
    }
    res.write(
      `data: ${JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : 'Internal server error' })}\n\n`
    )
    return res.end()
  }
})

// Send a new message (non-streaming, kept for backward compatibility)
chatRouter.post('/message', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const validated = sendMessageSchema.parse(req.body)
    const conversationId = validated.conversationId || 'default'
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    console.log(`[Chat] userId=${userId}`)
    const scopedConversationId = `user:${userId}:${conversationId}`

    // Create user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: validated.content,
      timestamp: new Date(),
    }

    // Add to context and get conversation in one round-trip
    const context = await contextService.addMessageAndGetContext(
      scopedConversationId,
      userMessage
    )

    // Generate AI response
    const aiContent = await llmService.generateResponse(
      validated.content,
      context
    )

    // Create AI message
    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'ai',
      content: aiContent,
      timestamp: new Date(),
    }

    // Add AI message to context
    await contextService.addMessage(scopedConversationId, aiMessage)

    return res.json({
      userMessage,
      aiMessage,
      conversationId,
    })
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message })
    }
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Regenerate a message
chatRouter.post('/regenerate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const validated = regenerateMessageSchema.parse(req.body)
    const conversationId = validated.conversationId || 'default'
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const scopedConversationId = `user:${userId}:${conversationId}`

    // Get conversation context
    const context = await contextService.getConversation(scopedConversationId)
    if (!context) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    const message = context.messages.find((m) => m.id === validated.messageId)
    if (!message) {
      return res.status(404).json({ error: 'Message not found' })
    }
    if (message.type !== 'ai') {
      return res.status(400).json({ error: 'Only AI messages can be regenerated' })
    }

    // Regenerate response
    const newContent = await llmService.regenerateResponse(
      validated.messageId,
      context
    )

    // Update the AI message
    const updatedMessage = await contextService.updateMessage(
      scopedConversationId,
      validated.messageId,
      {
        content: newContent,
        timestamp: new Date()
      }
    )

    if (!updatedMessage) {
      return res.status(404).json({ error: 'Message not found' })
    }

    return res.json({
      message: updatedMessage,
      conversationId,
    })
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message })
    }
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Get conversation history
chatRouter.get('/history/:conversationId?', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = req.params.conversationId || 'default'
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const scopedConversationId = `user:${userId}:${conversationId}`
    const messages = await contextService.getMessages(scopedConversationId)

    return res.json({
      messages,
      conversationId,
    })
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
})
