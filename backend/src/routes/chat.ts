import { Router, Request, Response } from 'express'
import { sendMessageSchema, regenerateMessageSchema } from '../schemas/chat.schema'
import { contextService } from '../services/context.service'
import { llmService } from '../services/llm.service'
import { Message } from '../types'

export const chatRouter = Router()

// Send a new message
chatRouter.post('/message', async (req: Request, res: Response) => {
  try {
    const validated = sendMessageSchema.parse(req.body)
    const conversationId = validated.conversationId || 'default'

    // Create user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: validated.content,
      timestamp: new Date(),
    }

    // Add to context
    contextService.addMessage(conversationId, userMessage)

    // Get conversation context
    const context = contextService.getConversation(conversationId)!

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
    contextService.addMessage(conversationId, aiMessage)

    res.json({
      userMessage,
      aiMessage,
      conversationId,
    })
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
})

// Regenerate a message
chatRouter.post('/regenerate', async (req: Request, res: Response) => {
  try {
    const validated = regenerateMessageSchema.parse(req.body)
    const conversationId = validated.conversationId || 'default'

    // Get conversation context
    const context = contextService.getConversation(conversationId)
    if (!context) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    // Regenerate response
    const newContent = await llmService.regenerateResponse(
      validated.messageId,
      context
    )

    // Update the AI message
    const messageIndex = context.messages.findIndex(
      (m) => m.id === validated.messageId
    )
    if (messageIndex === -1) {
      return res.status(404).json({ error: 'Message not found' })
    }

    context.messages[messageIndex].content = newContent
    context.messages[messageIndex].timestamp = new Date()

    res.json({
      message: context.messages[messageIndex],
      conversationId,
    })
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
})

// Get conversation history
chatRouter.get('/history/:conversationId?', (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId || 'default'
    const messages = contextService.getMessages(conversationId)

    res.json({
      messages,
      conversationId,
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})
