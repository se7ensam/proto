/**
 * Auth Domain Service - Business logic for authentication
 * Framework-agnostic, testable
 */

import bcrypt from 'bcryptjs'
import { IUserRepository } from '../repositories'
import { User, AuthTokenPayload } from '../types'
import { AuthenticationError, ConflictError, ValidationError } from '../errors'

export interface ITokenService {
  sign(payload: AuthTokenPayload): string
  verify(token: string): AuthTokenPayload
}

export interface IGoogleAuthService {
  verifyIdToken(token: string): Promise<{ email: string; googleId: string }>
}

export class AuthService {
  constructor(
    private userRepo: IUserRepository,
    private tokenService: ITokenService,
    private googleAuthService?: IGoogleAuthService
  ) {}

  /**
   * Register a new user with email and password
   */
  async register(email: string, password: string): Promise<{ user: User; token: string }> {
    // Validate input
    if (!email || !this.isValidEmail(email)) {
      throw new ValidationError('Invalid email address')
    }

    if (!password || password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters')
    }

    // Check if user exists
    const existing = await this.userRepo.findByEmail(email)
    if (existing) {
      throw new ConflictError('User with this email already exists')
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user
    const user = await this.userRepo.create({
      email,
      passwordHash,
    })

    // Generate token
    const token = this.tokenService.sign({
      userId: user.id,
      email: user.email,
    })

    return { user, token }
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    // Find user
    const user = await this.userRepo.findByEmail(email)
    if (!user) {
      throw new AuthenticationError('Invalid credentials')
    }

    // Check if user has password (not Google-only account)
    if (!user.passwordHash) {
      throw new AuthenticationError('This account uses Google Login. Please use Google Sign-In.')
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      throw new AuthenticationError('Invalid credentials')
    }

    // Generate token
    const token = this.tokenService.sign({
      userId: user.id,
      email: user.email,
    })

    return { user, token }
  }

  /**
   * Login with Google OAuth
   */
  async loginWithGoogle(idToken: string): Promise<{ user: User; token: string }> {
    if (!this.googleAuthService) {
      throw new ValidationError('Google authentication is not configured')
    }

    // Verify Google token
    const { email, googleId } = await this.googleAuthService.verifyIdToken(idToken)

    // Check if user exists
    let user = await this.userRepo.findByEmail(email)

    if (!user) {
      // Create new user
      user = await this.userRepo.create({
        email,
        googleId,
      })
    } else if (!user.googleId) {
      // Link Google ID to existing account
      const updated = await this.userRepo.update(user.id, { googleId })
      if (updated) {
        user = updated
      }
    }

    // Generate token
    const token = this.tokenService.sign({
      userId: user.id,
      email: user.email,
    })

    return { user, token }
  }

  /**
   * Verify a token and get user
   */
  async verifyToken(token: string): Promise<User> {
    try {
      const payload = this.tokenService.verify(token)
      const user = await this.userRepo.findById(payload.userId)

      if (!user) {
        throw new AuthenticationError('User not found')
      }

      return user
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token')
    }
  }

  /**
   * Email validation helper
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
}
