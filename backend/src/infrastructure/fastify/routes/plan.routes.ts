/**
 * Plan routes - Thin HTTP adapters for plan domain service
 */

import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sanitizeUserInput } from '../../sanitizer'

const applyToPlanSchema = z.object({
  messageId: z.string().min(1),
  conversationId: z.string().optional().default('default'),
})

const updatePlanSectionSchema = z.object({
  sectionId: z.string().min(1),
  content: z.string().optional(),
  locked: z.boolean().optional(),
})

const lockSectionSchema = z.object({
  sectionId: z.string().min(1),
  locked: z.boolean(),
})

const planRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply AI message to plan
  fastify.post(
    '/apply',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = applyToPlanSchema.parse(request.body)
      const userId = request.userId!

      const result = await fastify.services.plan.applyMessageToPlan(
        userId,
        body.conversationId,
        body.messageId
      )

      return reply.send({
        planSection: result.planSection,
        planUpdateMessage: result.planUpdateMessage,
        conversationId: body.conversationId,
      })
    }
  )

  // Get plan sections
  fastify.get(
    '/sections/:conversationId',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const params = z.object({
        conversationId: z.string().default('default'),
      }).parse(request.params)
      
      const userId = request.userId!

      const sections = await fastify.services.plan.getPlanSections(
        userId,
        params.conversationId
      )

      return reply.send({
        sections,
        conversationId: params.conversationId,
      })
    }
  )

  // Update plan section
  fastify.patch(
    '/section',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = updatePlanSectionSchema.parse(request.body)
      const query = z.object({
        conversationId: z.string().default('default'),
      }).parse(request.query)
      
      const userId = request.userId!

      // Sanitize content if provided
      const updates = {
        ...body,
        content: body.content ? sanitizeUserInput(body.content) : undefined,
      }

      const section = await fastify.services.plan.updatePlanSection(
        userId,
        query.conversationId,
        body.sectionId,
        updates
      )

      return reply.send({
        section,
        conversationId: query.conversationId,
      })
    }
  )

  // Lock/unlock section
  fastify.post(
    '/lock',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = lockSectionSchema.parse(request.body)
      const query = z.object({
        conversationId: z.string().default('default'),
      }).parse(request.query)
      
      const userId = request.userId!

      const section = await fastify.services.plan.toggleSectionLock(
        userId,
        query.conversationId,
        body.sectionId,
        body.locked
      )

      return reply.send({
        section,
        conversationId: query.conversationId,
      })
    }
  )
}

export default planRoutes
