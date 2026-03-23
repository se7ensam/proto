/**
 * Chat routes - Thin HTTP adapters for chat domain service
 */

import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sanitizeText, sanitizeUserInput } from '../../sanitizer'

const sendMessageSchema = z.object({
  content: z.string().min(1),
  conversationId: z.string().optional().default('default'),
})

const regenerateMessageSchema = z.object({
  messageId: z.string().min(1),
  conversationId: z.string().optional().default('default'),
})

const addMemberSchema = z.object({
  userId: z.string().uuid(),
})

const updateConversationTitleSchema = z.object({
  title: z.string().min(1).max(120),
})

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  // Send message (streaming)
  fastify.post(
    '/message/stream',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = sendMessageSchema.parse(request.body)
      const userId = request.userId!
      
      // Sanitize input
      const sanitizedContent = sanitizeUserInput(body.content)

      // Set up SSE
      reply.raw.setHeader('Content-Type', 'text/event-stream')
      reply.raw.setHeader('Cache-Control', 'no-cache')
      reply.raw.setHeader('Connection', 'keep-alive')
      reply.raw.setHeader('X-Accel-Buffering', 'no')

      try {
        for await (const event of fastify.services.chat.sendMessageStream(
          userId,
          body.conversationId,
          sanitizedContent
        )) {
          if (event.type === 'user') {
            reply.raw.write(`data: ${JSON.stringify({ type: 'user', message: event.message })}\n\n`)
          } else if (event.type === 'ai_start') {
            reply.raw.write(`data: ${JSON.stringify({ type: 'ai_start', messageId: event.messageId })}\n\n`)
          } else if (event.type === 'chunk') {
            reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', content: event.content })}\n\n`)
          } else if (event.type === 'done') {
            reply.raw.write(`data: ${JSON.stringify({ type: 'done', message: event.message })}\n\n`)
          }
        }
      } catch (error) {
        fastify.log.error({ err: error }, 'Streaming error')
        reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: (error as Error).message })}\n\n`)
      }

      reply.raw.end()
    }
  )

  // Send message (non-streaming)
  fastify.post(
    '/message',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = sendMessageSchema.parse(request.body)
      const userId = request.userId!
      
      // Sanitize input
      const sanitizedContent = sanitizeUserInput(body.content)

      const result = await fastify.services.chat.sendMessage(
        userId,
        body.conversationId,
        sanitizedContent
      )

      return reply.send({
        userMessage: result.userMessage,
        aiMessage: result.aiMessage,
        conversationId: body.conversationId,
      })
    }
  )

  // Regenerate message
  fastify.post(
    '/regenerate',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = regenerateMessageSchema.parse(request.body)
      const userId = request.userId!

      const message = await fastify.services.chat.regenerateMessage(
        userId,
        body.conversationId,
        body.messageId
      )

      return reply.send({
        message,
        conversationId: body.conversationId,
      })
    }
  )

  // Get conversation history
  fastify.get(
    '/history/:conversationId',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const params = z.object({
        conversationId: z.string().default('default'),
      }).parse(request.params)
      
      const userId = request.userId!

      const messages = await fastify.services.chat.getConversationHistory(
        userId,
        params.conversationId
      )

      return reply.send({
        messages,
        conversationId: params.conversationId,
      })
    }
  )

  // Get all user conversations
  fastify.get(
    '/conversations',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = request.userId!
      const conversations = await fastify.services.chat.getConversationSummaries(userId)

      return reply.send({ conversations })
    }
  )

  // Get deleted user conversations (recycle bin)
  fastify.get(
    '/conversations/deleted',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = request.userId!
      const conversations = await fastify.services.chat.getDeletedConversationSummaries(userId)

      return reply.send({ conversations })
    }
  )

  // Create a new conversation
  fastify.post(
    '/conversations',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = request.userId!
      const conversation = await fastify.services.chat.createConversation(userId)

      return reply.send({ conversation })
    }
  )

  // Soft-delete a conversation
  fastify.delete(
    '/conversations/:conversationId',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const params = z.object({
        conversationId: z.string().uuid(),
      }).parse(request.params)

      const userId = request.userId!
      const conversation = await fastify.services.chat.deleteConversation(userId, params.conversationId)

      return reply.send({ conversation })
    }
  )

  // Rename a conversation
  fastify.patch(
    '/conversations/:conversationId',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const params = z.object({
        conversationId: z.string().uuid(),
      }).parse(request.params)
      const body = updateConversationTitleSchema.parse(request.body)

      const userId = request.userId!
      const sanitizedTitle = sanitizeText(body.title)
      const conversation = await fastify.services.chat.updateConversationTitle(
        userId,
        params.conversationId,
        sanitizedTitle
      )

      return reply.send({ conversation })
    }
  )

  // Restore a soft-deleted conversation
  fastify.post(
    '/conversations/:conversationId/restore',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const params = z.object({
        conversationId: z.string().uuid(),
      }).parse(request.params)

      const userId = request.userId!
      const conversation = await fastify.services.chat.restoreConversation(userId, params.conversationId)

      return reply.send({ conversation })
    }
  )

  // Add member to chat
  fastify.post(
    '/:conversationId/members',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const params = z.object({
        conversationId: z.string(),
      }).parse(request.params)
      
      const body = addMemberSchema.parse(request.body)
      const userId = request.userId!

      await fastify.services.chat.addMember(userId, params.conversationId, body.userId)

      return reply.send({ success: true })
    }
  )

  // Remove member from chat
  fastify.delete(
    '/:conversationId/members/:memberId',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const params = z.object({
        conversationId: z.string(),
        memberId: z.string().uuid(),
      }).parse(request.params)
      
      const userId = request.userId!

      await fastify.services.chat.removeMember(userId, params.conversationId, params.memberId)

      return reply.send({ success: true })
    }
  )

  // List chat members (host + invited members)
  fastify.get(
    '/:conversationId/members',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const params = z.object({
        conversationId: z.string(),
      }).parse(request.params)

      const userId = request.userId!
      const members = await fastify.services.chat.getConversationMembers(userId, params.conversationId)
      return reply.send({ members })
    }
  )
}

export default chatRoutes
