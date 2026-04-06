/**
 * GitHub Integration Routes
 * Handles GitHub OAuth flow and integration management
 */

import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const initiateAuthSchema = z.object({
  conversationId: z.string().uuid(),
  collaboratorEmail: z.string().email().optional(),
})

const githubRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/github/auth/initiate
   * Initiate GitHub OAuth flow
   */
  fastify.post(
    '/auth/initiate',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = initiateAuthSchema.parse(request.body)
      const userId = request.userId!

      // Generate state with user and conversation info
      const state = Buffer.from(
        JSON.stringify({
          userId,
          conversationId: body.conversationId,
          collaboratorEmail: body.collaboratorEmail,
          timestamp: Date.now(),
        })
      ).toString('base64')

      const authUrl = fastify.githubAuth.getAuthorizationUrl(state)

      return reply.send({
        authUrl,
        state,
      })
    }
  )

  /**
   * GET /api/github/auth/callback
   * GitHub OAuth callback
   */
  fastify.get('/auth/callback', async (request, reply) => {
    const query = z.object({
      code: z.string(),
      state: z.string(),
    }).parse(request.query)

    try {
      // Decode state
      const stateData = JSON.parse(
        Buffer.from(query.state, 'base64').toString('utf-8')
      )

      const { userId, conversationId, collaboratorEmail } = stateData

      // Exchange code for access token
      const tokenData = await fastify.githubAuth.getAccessToken(query.code)
      const accessToken = tokenData.access_token

      // Get GitHub user info
      const githubUser = await fastify.githubAuth.getUser(accessToken)

      // Generate repository name
      const repoName = `ai-project-${conversationId.slice(0, 8)}-${Date.now()}`
      const repoDescription = `AI-generated project from conversation ${conversationId}`

      // Create repository
      const repo = await fastify.githubAuth.createRepository(
        accessToken,
        repoName,
        repoDescription,
        true // private
      )

      // Create integration record
      const integration = await fastify.githubIntegrationRepo.create({
        userId,
        conversationId,
        githubAccessToken: accessToken, // TODO: Encrypt in production
        githubRefreshToken: null,
        githubTokenExpiresAt: null,
        githubUsername: githubUser.login,
        githubUserId: githubUser.id.toString(),
        githubEmail: githubUser.email,
        githubAvatarUrl: githubUser.avatar_url,
        repoName: repo.name,
        repoFullName: repo.full_name,
        repoUrl: repo.html_url,
        repoOwner: repo.owner.login,
        repoIsPrivate: repo.private,
        collaboratorEmail: collaboratorEmail || null,
        collaborationStatus: collaboratorEmail ? 'pending' : 'none',
        integrationStatus: 'active',
        lastSyncAt: null,
      })

      // Add collaborator if email provided
      if (collaboratorEmail) {
        try {
          // Try to find GitHub username from email
          const collaboratorUsername = await fastify.githubAuth.searchUserByEmail(
            accessToken,
            collaboratorEmail
          )

          if (collaboratorUsername) {
            await fastify.githubAuth.addCollaborator(
              accessToken,
              repo.owner.login,
              repo.name,
              collaboratorUsername,
              'push'
            )

            // Update integration with collaborator info
            await fastify.githubIntegrationRepo.update(integration.id, {
              collaboratorUsername,
              collaborationStatus: 'pending',
            })

            fastify.log.info(`Added collaborator ${collaboratorUsername} to ${repo.full_name}`)
          } else {
            fastify.log.warn(`Could not find GitHub user for email: ${collaboratorEmail}`)
          }
        } catch (error) {
          fastify.log.error({ error }, 'Failed to add collaborator')
          // Don't fail the entire flow if collaborator addition fails
        }
      }

      // Create initial sync history entry
      await fastify.githubIntegrationRepo.createSyncHistory({
        integrationId: integration.id,
        syncType: 'repo_created',
        planSectionId: null,
        messageId: null,
        githubResourceType: 'repo',
        githubResourceId: repo.id.toString(),
        githubResourceNumber: null,
        githubResourceUrl: repo.html_url,
        status: 'success',
        errorMessage: null,
        metadata: { repo },
      })

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
      const redirectUrl = `${frontendUrl}/chat?githubIntegrated=true&repoUrl=${encodeURIComponent(repo.html_url)}&conversationId=${conversationId}`

      return reply.redirect(redirectUrl)
    } catch (error) {
      fastify.log.error({ error }, 'GitHub OAuth callback error')

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      const redirectUrl = `${frontendUrl}/chat?githubError=${encodeURIComponent(errorMsg)}`

      return reply.redirect(redirectUrl)
    }
  })

  /**
   * GET /api/github/integration/:conversationId
   * Get integration status for a conversation
   */
  fastify.get(
    '/integration/:conversationId',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { conversationId } = request.params as { conversationId: string }
      const userId = request.userId!

      const integration = await fastify.githubIntegrationRepo.findByConversationId(conversationId)

      if (!integration) {
        return reply.send({ integrated: false })
      }

      // Verify user owns this integration
      if (integration.userId !== userId) {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      // Don't send sensitive data to frontend
      return reply.send({
        integrated: true,
        id: integration.id,
        githubUsername: integration.githubUsername,
        githubAvatarUrl: integration.githubAvatarUrl,
        repoName: integration.repoName,
        repoFullName: integration.repoFullName,
        repoUrl: integration.repoUrl,
        repoOwner: integration.repoOwner,
        collaboratorUsername: integration.collaboratorUsername,
        collaborationStatus: integration.collaborationStatus,
        integrationStatus: integration.integrationStatus,
        lastSyncAt: integration.lastSyncAt,
        createdAt: integration.createdAt,
      })
    }
  )

  /**
   * GET /api/github/integration/:conversationId/history
   * Get sync history for an integration
   */
  fastify.get(
    '/integration/:conversationId/history',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { conversationId } = request.params as { conversationId: string }
      const userId = request.userId!

      const integration = await fastify.githubIntegrationRepo.findByConversationId(conversationId)

      if (!integration) {
        return reply.code(404).send({ error: 'Integration not found' })
      }

      if (integration.userId !== userId) {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      const history = await fastify.githubIntegrationRepo.getSyncHistory(integration.id, 50)

      return reply.send({ history })
    }
  )

  /**
   * DELETE /api/github/integration/:conversationId
   * Disconnect GitHub integration
   */
  fastify.delete(
    '/integration/:conversationId',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { conversationId } = request.params as { conversationId: string }
      const userId = request.userId!

      const integration = await fastify.githubIntegrationRepo.findByConversationId(conversationId)

      if (!integration) {
        return reply.code(404).send({ error: 'Integration not found' })
      }

      if (integration.userId !== userId) {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      await fastify.githubIntegrationRepo.delete(integration.id)

      return reply.send({ success: true })
    }
  )
}

export default githubRoutes
