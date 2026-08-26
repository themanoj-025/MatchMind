/**
 * AuthService Tests — MatchMind
 *
 * Tests AuthService:
 * - signup: creates user, generates tokens, sends verification email
 * - login: validates credentials, generates tokens
 * - refreshToken: validates refresh token, checks token version
 * - generatePasswordResetToken: generates and sends reset email
 * - resetPassword: validates reset token, updates password
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import * as argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import {
  AuthService,
  AuthError,
  generateTokens,
  getTokenVersion,
  revokeTokens,
} from './authService'
import type { IUserRepository, UserData } from '../repositories/types'

// Set JWT secrets before any imports that read env
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long!'
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-that-is-at-least-32-chars!'
  process.env.JWT_RESET_SECRET = 'test-reset-secret-key-that-is-at-least-32-chars!!'
})

// Mock email service
vi.mock('./emailService', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}))

function createMockUser(overrides: Partial<UserData> = {}): UserData {
  return {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    emailVerified: false,
    passwordHash: null,
    displayName: 'Test User',
    avatar: null,
    bannerImage: null,
    bio: null,
    countryCode: null,
    role: 'USER',
    tier: 'BRONZE',
    totalPoints: 0,
    weeklyPoints: 0,
    globalRank: null,
    predAccuracy: 0,
    totalPredictions: 0,
    correctPredictions: 0,
    streakCurrent: 0,
    streakBest: 0,
    isPro: false,
    proExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActiveAt: null,
    tokenVersion: 0,
    ...overrides,
  } as UserData
}

function createMockRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    findByUsername: vi.fn().mockResolvedValue(null),
    findByEmailOrUsername: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(createMockUser()),
    update: vi.fn().mockImplementation((_id: string, data: Partial<UserData>) =>
      Promise.resolve(createMockUser(data)),
    ),
    delete: vi.fn().mockResolvedValue(undefined),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    updateSports: vi.fn().mockResolvedValue(undefined),
    updateTeams: vi.fn().mockResolvedValue(undefined),
    followUser: vi.fn().mockResolvedValue(undefined),
    unfollowUser: vi.fn().mockResolvedValue(undefined),
    getNotifications: vi.fn().mockResolvedValue([]),
    markNotificationsRead: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('AuthService', () => {
  let repo: ReturnType<typeof createMockRepo>
  let service: AuthService

  beforeEach(() => {
    vi.clearAllMocks()
    repo = createMockRepo()
    service = new AuthService({ userRepository: repo })
  })

  describe('signup', () => {
    it('creates a new user and returns tokens', async () => {
      repo.findByEmailOrUsername = vi.fn().mockResolvedValue(null)
      repo.create = vi.fn().mockResolvedValue(
        createMockUser({
          id: 'new-user',
          username: 'newuser',
          email: 'new@example.com',
        }),
      )

      const result = await service.signup('newuser', 'new@example.com', 'password123')

      expect(result.user).toMatchObject({
        id: 'new-user',
        username: 'newuser',
        email: 'new@example.com',
      })
      expect(result.tokens.accessToken).toBeDefined()
      expect(result.tokens.refreshToken).toBeDefined()
      expect(repo.findByEmailOrUsername).toHaveBeenCalledWith('new@example.com', 'newuser')
      expect(repo.create).toHaveBeenCalled()
    })

    it('throws AuthError if email or username already exists', async () => {
      repo.findByEmailOrUsername = vi.fn().mockResolvedValue(createMockUser())

      await expect(
        service.signup('existinguser', 'existing@example.com', 'password123'),
      ).rejects.toThrow(AuthError)

      await expect(
        service.signup('existinguser', 'existing@example.com', 'password123'),
      ).rejects.toMatchObject({
        code: 'DUPLICATE_USER',
        statusCode: 409,
      })
    })
  })

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const passwordHash = await argon2.hash('correctpassword')
      repo.findByEmail = vi.fn().mockResolvedValue(
        createMockUser({
          id: 'user-1',
          email: 'test@example.com',
          passwordHash,
        }),
      )

      const result = await service.login('test@example.com', 'correctpassword')

      expect(result.user.id).toBe('user-1')
      expect(result.tokens.accessToken).toBeDefined()
      expect(result.tokens.refreshToken).toBeDefined()
    })

    it('throws AuthError for invalid email', async () => {
      repo.findByEmail = vi.fn().mockResolvedValue(null)

      await expect(service.login('wrong@example.com', 'password')).rejects.toThrow(AuthError)
      await expect(service.login('wrong@example.com', 'password')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        statusCode: 401,
      })
    })

    it('throws AuthError for wrong password', async () => {
      const passwordHash = await argon2.hash('correctpassword')
      repo.findByEmail = vi.fn().mockResolvedValue(
        createMockUser({ passwordHash }),
      )

      await expect(service.login('test@example.com', 'wrongpassword')).rejects.toThrow(AuthError)
    })

    it('throws AuthError if user has no passwordHash', async () => {
      repo.findByEmail = vi.fn().mockResolvedValue(
        createMockUser({ passwordHash: null }),
      )

      await expect(service.login('test@example.com', 'password')).rejects.toThrow(AuthError)
    })
  })

  describe('refreshToken', () => {
    it('returns new tokens for valid refresh token', async () => {
      const userId = 'user-1'
      const tokenVersion = 0
      const refreshToken = jwt.sign(
        { userId, tokenVersion },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '30d' },
      )

      repo.findById = vi.fn().mockResolvedValue(createMockUser({ id: userId, tokenVersion }))

      const result = await service.refreshToken(refreshToken)

      expect(result.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
    })

    it('throws AuthError for invalid refresh token', async () => {
      await expect(service.refreshToken('invalid-token')).rejects.toThrow(AuthError)
    })

    it('throws AuthError when user not found', async () => {
      const refreshToken = jwt.sign(
        { userId: 'nonexistent', tokenVersion: 0 },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '30d' },
      )

      repo.findById = vi.fn().mockResolvedValue(null)

      await expect(service.refreshToken(refreshToken)).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      })
    })

    it('throws AuthError on token reuse detection', async () => {
      const userId = 'user-1'
      const oldTokenVersion = 0
      const refreshToken = jwt.sign(
        { userId, tokenVersion: oldTokenVersion },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '30d' },
      )

      // User has incremented token version (e.g., after password change)
      repo.findById = vi.fn().mockResolvedValue(
        createMockUser({ id: userId, tokenVersion: 1 }),
      )

      await expect(service.refreshToken(refreshToken)).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
      })

      // Should revoke all tokens
      expect(repo.update).toHaveBeenCalledWith(userId, { tokenVersion: 2 })
    })
  })

  describe('generatePasswordResetToken', () => {
    it('does not reveal if email exists', async () => {
      repo.findByEmail = vi.fn().mockResolvedValue(null)

      // Should not throw — always returns success to prevent email enumeration
      await expect(
        service.generatePasswordResetToken('nonexistent@example.com'),
      ).resolves.toBeUndefined()
    })

    it('generates reset token for existing user', async () => {
      repo.findByEmail = vi.fn().mockResolvedValue(
        createMockUser({ id: 'user-1', tokenVersion: 0 }),
      )
      repo.update = vi.fn().mockResolvedValue(createMockUser({ tokenVersion: 1 }))

      await service.generatePasswordResetToken('test@example.com')

      // Should increment token version (invalidate existing tokens)
      expect(repo.update).toHaveBeenCalledWith('user-1', { tokenVersion: 1 })
    })
  })

  describe('resetPassword', () => {
    it('resets password with valid token', async () => {
      const userId = 'user-1'
      const tokenVersion = 0
      const resetToken = jwt.sign(
        { userId, purpose: 'password-reset', tokenVersion },
        process.env.JWT_RESET_SECRET!,
        { expiresIn: '1h' },
      )

      repo.findById = vi.fn().mockResolvedValue(
        createMockUser({ id: userId, tokenVersion }),
      )
      repo.update = vi.fn().mockResolvedValue(createMockUser({ tokenVersion: 1 }))

      await service.resetPassword(resetToken, 'newpassword123')

      expect(repo.update).toHaveBeenCalledWith(userId, {
        passwordHash: expect.any(String),
        tokenVersion: 1,
      })
    })

    it('throws AuthError for invalid token', async () => {
      await expect(
        service.resetPassword('invalid-token', 'newpassword'),
      ).rejects.toThrow(AuthError)
    })

    it('throws AuthError for wrong purpose token', async () => {
      const resetToken = jwt.sign(
        { userId: 'user-1', purpose: 'email-verification' },
        process.env.JWT_RESET_SECRET!,
        { expiresIn: '1h' },
      )

      await expect(
        service.resetPassword(resetToken, 'newpassword'),
      ).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
    })
  })
})

describe('generateTokens', () => {
  it('generates access and refresh tokens', () => {
    const tokens = generateTokens('user-1', 0)

    expect(tokens.accessToken).toBeDefined()
    expect(tokens.refreshToken).toBeDefined()

    // Verify access token
    const decoded = jwt.verify(
      tokens.accessToken,
      process.env.JWT_SECRET!,
    ) as { userId: string; tokenVersion: number }
    expect(decoded.userId).toBe('user-1')
    expect(decoded.tokenVersion).toBe(0)
  })

  it('includes tokenVersion in tokens', () => {
    const tokens = generateTokens('user-1', 5)

    const decoded = jwt.verify(
      tokens.accessToken,
      process.env.JWT_SECRET!,
    ) as { tokenVersion: number }
    expect(decoded.tokenVersion).toBe(5)
  })
})

describe('getTokenVersion', () => {
  it('returns tokenVersion from user', async () => {
    const repo = createMockRepo({
      findById: vi.fn().mockResolvedValue(createMockUser({ tokenVersion: 3 })),
    })

    const version = await getTokenVersion('user-1', repo)
    expect(version).toBe(3)
  })

  it('returns 0 when user not found', async () => {
    const repo = createMockRepo({
      findById: vi.fn().mockResolvedValue(null),
    })

    const version = await getTokenVersion('nonexistent', repo)
    expect(version).toBe(0)
  })
})

describe('revokeTokens', () => {
  it('increments tokenVersion', async () => {
    const repo = createMockRepo({
      findById: vi.fn().mockResolvedValue(createMockUser({ tokenVersion: 2 })),
      update: vi.fn().mockResolvedValue(createMockUser({ tokenVersion: 3 })),
    })

    const newVersion = await revokeTokens('user-1', repo)
    expect(newVersion).toBe(3)
    expect(repo.update).toHaveBeenCalledWith('user-1', { tokenVersion: 3 })
  })
})

describe('AuthError', () => {
  it('has correct properties', () => {
    const error = new AuthError('Test error', 'TEST_CODE', 400)

    expect(error.message).toBe('Test error')
    expect(error.code).toBe('TEST_CODE')
    expect(error.statusCode).toBe(400)
    expect(error.isAppError).toBe(true)
    expect(error.name).toBe('AuthError')
    expect(error).toBeInstanceOf(Error)
  })
})
