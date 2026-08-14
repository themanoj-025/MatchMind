/**
 * Auth Route Tests — MatchMind
 *
 * Tests authentication endpoints using supertest.
 * Uses an in-memory Prisma mock for isolated testing without a real database.
 * Mocks the AuthService module for isolated testing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import argon2 from 'argon2'

// Set required env vars before importing routes
process.env.JWT_SECRET = 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-64-chars-minimum-for-testing-purposes'
process.env.JWT_RESET_SECRET = 'test-reset-secret-64-chars-minimum-for-testing-purposes-only'

// ─── Mock AuthService before any route imports ──────────
vi.mock('../services/authService', () => {
  class MockAuthError extends Error {
    public code: string
    public statusCode: number
    public isAppError: boolean

    constructor(message: string, code: string, statusCode: number) {
      super(message)
      this.name = 'AuthError'
      this.code = code
      this.statusCode = statusCode
      this.isAppError = true
    }
  }

  class MockAuthService {
    private deps: any

    constructor(deps: any) {
      this.deps = deps
    }

    async signup(username: string, email: string, password: string) {
      const userRepository = this.deps.userRepository
      const existing = await userRepository.findByEmailOrUsername(email, username)
      if (existing) {
        throw new MockAuthError(
          'A user with that email or username already exists',
          'DUPLICATE_USER',
          409
        )
      }

      const argon2Mod = require('argon2')
      const user = await userRepository.create({
        username,
        email,
        passwordHash: await argon2Mod.hash(password),
        displayName: username,
      })

      const jwtMod = require('jsonwebtoken')
      const tokens = {
        accessToken: jwtMod.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' }),
        refreshToken: jwtMod.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' }),
      }

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          avatar: user.avatar,
          totalPoints: user.totalPoints,
          tier: user.tier,
        },
        tokens,
      }
    }

    async login(email: string, password: string) {
      const userRepository = this.deps.userRepository
      const user = await userRepository.findByEmail(email)
      if (!user || !user.passwordHash) {
        throw new MockAuthError('Invalid email or password', 'INVALID_CREDENTIALS', 401)
      }

      const argon2Mod = require('argon2')
      const valid = await argon2Mod.verify(user.passwordHash, password)
      if (!valid) {
        throw new MockAuthError('Invalid email or password', 'INVALID_CREDENTIALS', 401)
      }

      const jwtMod = require('jsonwebtoken')
      const tokens = {
        accessToken: jwtMod.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' }),
        refreshToken: jwtMod.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' }),
      }

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          avatar: user.avatar,
          totalPoints: user.totalPoints,
          tier: user.tier,
        },
        tokens,
      }
    }

    async refreshToken(refreshToken: string) {
      const jwtMod = require('jsonwebtoken')
      let decoded: { userId: string }
      try {
        decoded = jwtMod.verify(refreshToken, process.env.JWT_REFRESH_SECRET) as { userId: string }
      } catch {
        throw new MockAuthError('Invalid or expired refresh token', 'INVALID_TOKEN', 401)
      }

      const user = await this.deps.userRepository.findById(decoded.userId)
      if (!user) {
        throw new MockAuthError('User not found', 'USER_NOT_FOUND', 401)
      }

      return {
        accessToken: jwtMod.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' }),
        refreshToken: jwtMod.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' }),
      }
    }

    async generatePasswordResetToken(_email: string) {
      // Always return success to prevent email enumeration
    }

    async resetPassword(token: string, newPassword: string) {
      const jwtMod = require('jsonwebtoken')
      let decoded: { userId: string; purpose: string; tokenVersion?: number }
      try {
        decoded = jwtMod.verify(token, process.env.JWT_RESET_SECRET!) as any
      } catch {
        throw new MockAuthError('This reset link is no longer valid', 'INVALID_TOKEN', 401)
      }

      if (decoded.purpose !== 'password-reset') {
        throw new MockAuthError('This reset link is no longer valid', 'INVALID_TOKEN', 401)
      }

      const user = await this.deps.userRepository.findById(decoded.userId)
      if (!user) {
        throw new MockAuthError('This reset link is no longer valid', 'INVALID_TOKEN', 401)
      }

      const currentVersion = user.tokenVersion ?? 0
      if (decoded.tokenVersion !== currentVersion) {
        throw new MockAuthError('This reset link is no longer valid', 'INVALID_TOKEN', 401)
      }

      const argon2Mod = require('argon2')
      const passwordHash = await argon2Mod.hash(newPassword)
      
      const nextTokenVersion = currentVersion + 1
      await this.deps.userRepository.update(user.id, {
        passwordHash,
        tokenVersion: nextTokenVersion,
      })
    }
  }

  return {
    AuthService: MockAuthService as any,
    AuthError: MockAuthError as any,
    generateTokens: (userId: string) => {
      const jwtMod = require('jsonwebtoken') as typeof import('jsonwebtoken')
      return {
        accessToken: jwtMod.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' }),
        refreshToken: jwtMod.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' }),
      }
    },
    revokeTokens: async (userId: string, prisma: any) => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { tokenVersion: true },
      })
      const newVersion = (user?.tokenVersion ?? 0) + 1
      await prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: newVersion },
      })
      return newVersion
    },
  }
})

// ─── Also mock repositories/index.ts ───────────────────
vi.mock('../repositories/index', () => {
  class MockUserRepository {
    private prisma: any
    constructor(prisma: any) { this.prisma = prisma }

    async findById(id: string) {
      try {
        return await this.prisma.user.findUnique({ where: { id } })
      } catch { return null }
    }
    async findByEmail(email: string) {
      try {
        return await this.prisma.user.findUnique({ where: { email } })
      } catch { return null }
    }
    async findByUsername(username: string) {
      try {
        return await this.prisma.user.findUnique({ where: { username } })
      } catch { return null }
    }
    async findByEmailOrUsername(email: string, username: string) {
      try {
        return await this.prisma.user.findFirst({ where: { OR: [{ email }, { username }] } })
      } catch { return null }
    }
    async create(data: any) { return this.prisma.user.create({ data }) }
    async update(id: string, data: any) { return this.prisma.user.update({ where: { id }, data }) }
    async delete(id: string) { await this.prisma.user.delete({ where: { id } }) }
    async findMany(opts: any) { return this.prisma.user.findMany(opts) }
    async count(where?: any) { return this.prisma.user.count({ where }) }
    async updateMany(where: any, data: any) { return this.prisma.user.updateMany({ where, data }) }
  }

  return {
    createRepositories: (prisma: any) => ({
      userRepository: new MockUserRepository(prisma),
      matchRepository: {} as any,
      predictionRepository: {} as any,
      leaderboardRepository: {} as any,
      reportRepository: { count: async () => 0 },
      adminLogRepository: { create: async () => ({}), findMany: async () => [], count: async () => 0 },
    }),
  }
})

// ─── Helpers ──────────────────────────────────────────

interface MockPrisma {
  user: {
    findUnique: (opts: { where: Record<string, any> }) => Promise<any>
    findFirst: (opts: { where: Record<string, any> }) => Promise<any>
    create: (opts: { data: Record<string, any> }) => Promise<any>
    update: (opts: { where: Record<string, any>; data: Record<string, any> }) => Promise<any>
  }
  session: {
    deleteMany: (opts: { where: Record<string, any> }) => Promise<{ count: number }>
  }
}

async function createTestApp(prismaMock: MockPrisma) {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())

  // Mock DI Container
  const { AuthService } = await import('../services/authService')
  const { createRepositories } = await import('../repositories/index')
  const mockDeps = createRepositories(prismaMock)

  app.use((req, _res, next) => {
    req.app.get = (key: string) => {
      if (key === 'prisma') return prismaMock
      return null
    }
    ;(req as any).container = {
      resolve: (key: string) => {
        if (key === 'userRepository') return (mockDeps as any).userRepository
        if (key === 'authService') return new AuthService(mockDeps)
        return null
      }
    }
    next()
  })

  // Mount routes — dynamically import the .ts file
  const { default: authRoutes } = await import('./auth')
  app.use('/api/auth', authRoutes)

  // Error handler that mimics the real one
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } })
    }
    if (err.isAppError) {
      return res.status(err.statusCode || 400).json({
        error: { code: err.code || 'APP_ERROR', message: (err as Error).message },
      })
    }
    console.error('TEST ERROR:', err);
    res.status(500).json({ error: { code: 'TEST_ERROR', message: (err as Error).message } })
  })

  return app
}

function createMockPrisma(): MockPrisma {
  const users: Record<string, any> = {}
  let nextId = 1

  return {
    user: {
      findUnique: async ({ where }) => {
        if (where.id) return users[where.id] || null
        if (where.email) return Object.values(users).find((u: any) => u.email === where.email) || null
        return null
      },
      findFirst: async ({ where }) => {
        if (where.OR) {
          for (const condition of where.OR) {
            const match = Object.values(users).find((u: any) => {
              for (const [key, val] of Object.entries(condition)) {
                if (u[key] === val) return true
              }
              return false
            })
            if (match) return match
          }
        }
        return null
      },
      create: async ({ data }) => {
        const id = `user-${nextId++}`
        const user = {
          id,
          username: data.username,
          email: data.email,
          passwordHash: data.passwordHash || null,
          displayName: data.displayName || data.username,
          avatar: null,
          totalPoints: 0,
          tier: 'BRONZE',
          isPro: false,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        users[id] = user
        return user
      },
      update: async ({ where, data }) => {
        if (where.id && users[where.id]) {
          Object.assign(users[where.id], data)
          return users[where.id]
        }
        throw new Error('User not found')
      },
    },
    session: {
      deleteMany: async () => ({ count: 0 }),
    },
  }
}

describe('Auth Routes', () => {
  // ─── SIGNUP ────────────────────────────────────────────
  describe('POST /api/auth/signup', () => {
    it('creates a new user and returns tokens', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ username: 'testuser', email: 'test@example.com', password: 'Password123!' })

      expect(res.status).toBe(201)
      expect(res.body.user).toBeDefined()
      expect(res.body.user.username).toBe('testuser')
      expect(res.body.user.email).toBe('test@example.com')
      expect(res.headers['set-cookie']).toBeDefined()
    })

    it('rejects duplicate email', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      await request(app)
        .post('/api/auth/signup')
        .send({ username: 'user1', email: 'dupe@example.com', password: 'Password123!' })

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ username: 'user2', email: 'dupe@example.com', password: 'Password123!' })

      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('DUPLICATE_USER')
    })

    it('rejects duplicate username', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      await request(app)
        .post('/api/auth/signup')
        .send({ username: 'dupeuser', email: 'first@example.com', password: 'Password123!' })

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ username: 'dupeuser', email: 'second@example.com', password: 'Password123!' })

      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('DUPLICATE_USER')
    })

    it('rejects invalid email format', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ username: 'testuser', email: 'not-an-email', password: 'Password123!' })

      expect(res.status).toBe(400)
    })

    it('rejects short password', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ username: 'testuser', email: 'test@example.com', password: '123' })

      expect(res.status).toBe(400)
    })
  })

  // ─── LOGIN ─────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      // Create user first
      const passwordHash = await argon2.hash('Password123!')
      const user = await prisma.user.create({
        data: { username: 'loginuser', email: 'login@example.com', passwordHash },
      })
      expect(user).toBeDefined()

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'Password123!' })

      expect(res.status).toBe(200)
      expect(res.body.user).toBeDefined()
      expect(res.headers['set-cookie']).toBeDefined()
    })

    it('rejects invalid password', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      const passwordHash = await argon2.hash('Password123!')
      await prisma.user.create({
        data: { username: 'loginuser2', email: 'login2@example.com', passwordHash },
      })

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login2@example.com', password: 'WrongPassword!' })

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
    })

    it('rejects non-existent email', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@example.com', password: 'Password123!' })

      expect(res.status).toBe(401)
    })
  })

  // ─── REFRESH TOKEN ─────────────────────────────────────
  describe('POST /api/auth/refresh', () => {
    it.skip('refreshes tokens with valid refresh token', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      const user = await prisma.user.create({
        data: { username: 'refreshtest', email: 'refresh@example.com' },
      })

      const refreshToken = jwt.sign(
        { userId: user.id, tokenVersion: 0 },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      )

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })

      expect(res.status).toBe(200)
      expect(res.body.accessToken).toBeDefined()
    })

    it('returns 401 with missing refresh token', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({})

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('NO_REFRESH_TOKEN')
    })

    it('returns 401 with invalid refresh token', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token-value' })

      expect(res.status).toBe(401)
    })
  })

  // ─── FORGOT / RESET PASSWORD ───────────────────────────
  describe('POST /api/auth/forgot-password', () => {
    it('returns success even for unknown email (no enumeration)', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'unknown@example.com' })

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('reset link has been sent')
    })
  })

  describe('POST /api/auth/reset-password', () => {
    it('resets password with valid token', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      const user = await prisma.user.create({
        data: { username: 'resettest', email: 'reset@example.com' },
      })
      expect(user).toBeDefined()

      const resetToken = jwt.sign(
        { userId: user.id, purpose: 'password-reset', tokenVersion: 0 },
        process.env.JWT_RESET_SECRET,
        { expiresIn: '1h' }
      )

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: 'NewPassword456!' })

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('Password has been updated')
    })

    it('rejects token replay (reusing the same token after reset)', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      const user = await prisma.user.create({
        data: { username: 'replaytest', email: 'replay@example.com', tokenVersion: 0 },
      })

      const resetToken = jwt.sign(
        { userId: user.id, purpose: 'password-reset', tokenVersion: 0 },
        process.env.JWT_RESET_SECRET!,
        { expiresIn: '1h' }
      )

      // First reset works
      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: 'NewPassword456!' })

      // Second reset with the exact same token should fail
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: 'AnotherPassword789!' })

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('INVALID_TOKEN')
    })

    it('rejects invalid reset token', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'invalid-token', password: 'NewPassword456!' })

      expect(res.status).toBe(401)
    })

    it('rejects reset token forged with JWT_SECRET (not JWT_RESET_SECRET)', async () => {
      const prisma = createMockPrisma()
      const app = await createTestApp(prisma)

      const user = await prisma.user.create({
        data: { username: 'forgetest', email: 'forge@example.com' },
      })
      expect(user).toBeDefined()

      // Forge a reset token using JWT_SECRET instead of JWT_RESET_SECRET
      const forgedToken = jwt.sign(
        { userId: user.id, purpose: 'password-reset' },
        process.env.JWT_SECRET!,  // Wrong secret — should be JWT_RESET_SECRET
        { expiresIn: '1h' }
      )

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: forgedToken, password: 'NewPassword456!' })

      // Must be rejected because the token was signed with wrong secret
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('INVALID_TOKEN')
    })
  })
})
