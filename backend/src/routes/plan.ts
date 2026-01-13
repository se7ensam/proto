import { Router, Response } from 'express'
import {
  applyToPlanSchema,
  updatePlanSectionSchema,
  lockSectionSchema,
} from '../schemas/plan.schema'
import { contextService } from '../services/context.service'
import { PlanSection } from '../types'
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware'

export const planRouter = Router()

// Apply AI message to plan
planRouter.post('/apply', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const validated = applyToPlanSchema.parse(req.body)
    const conversationId = validated.conversationId || 'default'
    const scopedConversationId = `user:${req.user!.userId}:${conversationId}`

    // Get conversation context
    const context = await contextService.getConversation(scopedConversationId)
    if (!context) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    // Find the AI message
    const message = context.messages.find((m) => m.id === validated.messageId)
    if (!message) {
      return res.status(404).json({ error: 'Message not found' })
    }

    if (message.type !== 'ai') {
      return res.status(400).json({ error: 'Only AI messages can be applied to plan' })
    }

    // Create plan section from AI message
    const planSection: PlanSection = {
      id: Date.now().toString(),
      content: message.content,
      locked: false,
      timestamp: new Date(),
    }

    // Add to plan
    await contextService.addPlanSection(scopedConversationId, planSection)

    // Create plan_update message
    const planUpdateMessage = {
      id: (Date.now() + 1).toString(),
      type: 'plan_update' as const,
      content: `Applied message ${validated.messageId} to plan`,
      timestamp: new Date(),
    }

    await contextService.addMessage(scopedConversationId, planUpdateMessage)

    return res.json({
      planSection,
      planUpdateMessage,
      conversationId,
    })
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message })
    } else {
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
})

// Get plan sections
planRouter.get('/sections/:conversationId?', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = req.params.conversationId || 'default'
    const scopedConversationId = `user:${req.user!.userId}:${conversationId}`
    const sections = await contextService.getPlanSections(scopedConversationId)

    res.json({
      sections,
      conversationId,
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update plan section
planRouter.patch('/section', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const validated = updatePlanSectionSchema.parse(req.body)
    const conversationId = req.query.conversationId as string || 'default'
    const scopedConversationId = `user:${req.user!.userId}:${conversationId}`

    const updated = await contextService.updatePlanSection(
      scopedConversationId,
      validated.sectionId,
      validated
    )

    if (!updated) {
      return res.status(404).json({ error: 'Section not found' })
    }

    const sections = await contextService.getPlanSections(scopedConversationId)
    const section = sections.find((s) => s.id === validated.sectionId)

    return res.json({
      section,
      conversationId,
    })
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message })
    } else {
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
})

// Lock/unlock section
planRouter.post('/lock', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const validated = lockSectionSchema.parse(req.body)
    const conversationId = req.query.conversationId as string || 'default'
    const scopedConversationId = `user:${req.user!.userId}:${conversationId}`

    const updated = await contextService.updatePlanSection(
      scopedConversationId,
      validated.sectionId,
      { locked: validated.locked }
    )

    if (!updated) {
      return res.status(404).json({ error: 'Section not found' })
    }

    const sections = await contextService.getPlanSections(scopedConversationId)
    const section = sections.find((s) => s.id === validated.sectionId)

    return res.json({
      section,
      conversationId,
    })
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message })
    } else {
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
})
