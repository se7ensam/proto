/**
 * Auth Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthService } from '../src/domain/services/auth.service'
import {
  createMockUserRepository,
  createMockTokenService,
  createMockGoogleAuthService,
  createTestUser,
} from './helpers'
import { ValidationError, AuthenticationError, ConflictError } from '../src/domain/errors'
import bcrypt from 'bcryptjs'

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}))

describe('AuthService', () => {
  let authService: AuthService
  let mockUserRepo: ReturnType<typeof createMockUserRepository>
  let mockTokenService: ReturnType<typeof createMockTokenService>
  let mockGoogleAuthService: ReturnType<typeof createMockGoogleAuthService>

  beforeEach(() => {
    mockUserRepo = createMockUserRepository()
    mockTokenService = createMockTokenService()
    mockGoogleAuthService = createMockGoogleAuthService()

    authService = new AuthService(mockUserRepo, mockTokenService, mockGoogleAuthService)
  })

  describe('register', () => {
    it('should register a new user', async () => {
      const email = 'test@example.com'
      const password = 'password123'
      const user = createTestUser({ email })

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(null)
      vi.mocked(bcrypt.hash).mockResolvedValue('hashedpassword' as never)
      vi.mocked(mockUserRepo.create).mockResolvedValue(user)
      vi.mocked(mockTokenService.sign).mockReturnValue('token123')

      const result = await authService.register(email, password)

      expect(result.user).toEqual(user)
      expect(result.token).toBe('token123')
      expect(mockUserRepo.create).toHaveBeenCalledWith({
        email,
        passwordHash: 'hashedpassword',
      })
    })

    it('should throw ValidationError for invalid email', async () => {
      await expect(
        authService.register('invalid-email', 'password123')
      ).rejects.toThrow(ValidationError)
    })

    it('should throw ValidationError for short password', async () => {
      await expect(
        authService.register('test@example.com', '12345')
      ).rejects.toThrow(ValidationError)
    })

    it('should throw ConflictError for existing user', async () => {
      const user = createTestUser()
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(user)

      await expect(
        authService.register('test@example.com', 'password123')
      ).rejects.toThrow(ConflictError)
    })
  })

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const email = 'test@example.com'
      const password = 'password123'
      const user = createTestUser({ email, passwordHash: 'hashedpassword' })

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(user)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
      vi.mocked(mockTokenService.sign).mockReturnValue('token123')

      const result = await authService.login(email, password)

      expect(result.user).toEqual(user)
      expect(result.token).toBe('token123')
    })

    it('should throw AuthenticationError for non-existent user', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(null)

      await expect(
        authService.login('test@example.com', 'password123')
      ).rejects.toThrow(AuthenticationError)
    })

    it('should throw AuthenticationError for invalid password', async () => {
      const user = createTestUser({ passwordHash: 'hashedpassword' })
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(user)
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      await expect(
        authService.login('test@example.com', 'wrongpassword')
      ).rejects.toThrow(AuthenticationError)
    })

    it('should throw AuthenticationError for Google-only account', async () => {
      const user = createTestUser({ passwordHash: undefined, googleId: 'google123' })
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(user)

      await expect(
        authService.login('test@example.com', 'password123')
      ).rejects.toThrow(AuthenticationError)
    })
  })

  describe('loginWithGoogle', () => {
    it('should login with Google for new user', async () => {
      const email = 'test@example.com'
      const googleId = 'google123'
      const user = createTestUser({ email, googleId })

      vi.mocked(mockGoogleAuthService.verifyIdToken).mockResolvedValue({ email, googleId })
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(null)
      vi.mocked(mockUserRepo.create).mockResolvedValue(user)
      vi.mocked(mockTokenService.sign).mockReturnValue('token123')

      const result = await authService.loginWithGoogle('idtoken')

      expect(result.user).toEqual(user)
      expect(result.token).toBe('token123')
    })

    it('should login with Google for existing user', async () => {
      const email = 'test@example.com'
      const googleId = 'google123'
      const user = createTestUser({ email, googleId })

      vi.mocked(mockGoogleAuthService.verifyIdToken).mockResolvedValue({ email, googleId })
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(user)
      vi.mocked(mockTokenService.sign).mockReturnValue('token123')

      const result = await authService.loginWithGoogle('idtoken')

      expect(result.user).toEqual(user)
      expect(result.token).toBe('token123')
    })

    it('should link Google ID to existing account', async () => {
      const email = 'test@example.com'
      const googleId = 'google123'
      const user = createTestUser({ email, googleId: undefined })
      const updatedUser = createTestUser({ email, googleId })

      vi.mocked(mockGoogleAuthService.verifyIdToken).mockResolvedValue({ email, googleId })
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(user)
      vi.mocked(mockUserRepo.update).mockResolvedValue(updatedUser)
      vi.mocked(mockTokenService.sign).mockReturnValue('token123')

      await authService.loginWithGoogle('idtoken')

      expect(mockUserRepo.update).toHaveBeenCalledWith(user.id, { googleId })
    })
  })

  describe('verifyToken', () => {
    it('should verify valid token and return user', async () => {
      const user = createTestUser()
      vi.mocked(mockTokenService.verify).mockReturnValue({ userId: user.id, email: user.email })
      vi.mocked(mockUserRepo.findById).mockResolvedValue(user)

      const result = await authService.verifyToken('token123')

      expect(result).toEqual(user)
    })

    it('should throw AuthenticationError for invalid token', async () => {
      vi.mocked(mockTokenService.verify).mockImplementation(() => {
        throw new Error('Invalid token')
      })

      await expect(authService.verifyToken('invalid')).rejects.toThrow(AuthenticationError)
    })

    it('should throw AuthenticationError for non-existent user', async () => {
      vi.mocked(mockTokenService.verify).mockReturnValue({ userId: 'user-1', email: 'test@example.com' })
      vi.mocked(mockUserRepo.findById).mockResolvedValue(null)

      await expect(authService.verifyToken('token123')).rejects.toThrow(AuthenticationError)
    })
  })
})
