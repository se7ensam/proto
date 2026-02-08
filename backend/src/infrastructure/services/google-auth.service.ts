/**
 * Google Auth Infrastructure Service - Google OAuth verification
 */

import { OAuth2Client } from 'google-auth-library'
import { IGoogleAuthService } from '../../domain/services/auth.service'
import { AuthenticationError } from '../../domain/errors'

export class GoogleAuthService implements IGoogleAuthService {
  private client: OAuth2Client

  constructor(private clientId: string) {
    if (!clientId) {
      throw new Error('Google Client ID is required')
    }
    this.client = new OAuth2Client(clientId)
  }

  async verifyIdToken(token: string): Promise<{ email: string; googleId: string }> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: this.clientId,
      })

      const payload = ticket.getPayload()

      if (!payload || !payload.email || !payload.sub) {
        throw new AuthenticationError('Invalid Google token payload')
      }

      return {
        email: payload.email,
        googleId: payload.sub,
      }
    } catch (error) {
      throw new AuthenticationError('Failed to verify Google token')
    }
  }
}
