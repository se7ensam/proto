/**
 * Token Infrastructure Service - JWT token management
 */

import jwt from 'jsonwebtoken'
import { ITokenService } from '../../domain/services/auth.service'
import { AuthTokenPayload } from '../../domain/types'
import { AuthenticationError } from '../../domain/errors'

export class JWTTokenService implements ITokenService {
  private secret: string
  private expiresIn: string

  constructor(secret: string, expiresIn: string = '7d') {
    if (!secret) {
      throw new Error('JWT secret is required')
    }
    this.secret = secret
    this.expiresIn = expiresIn
  }

  sign(payload: AuthTokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn } as jwt.SignOptions)
  }

  verify(token: string): AuthTokenPayload {
    try {
      const payload = jwt.verify(token, this.secret) as AuthTokenPayload
      return payload
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token')
    }
  }
}
