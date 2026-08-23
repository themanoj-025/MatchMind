/**
 * User Routes Tests — MatchMind
 *
 * Tests user endpoints:
 * - GET /api/users/check-username — available/taken
 * - GET /api/users/:id — returns user profile or 404
 * - PATCH /api/users/me — updates profile (auth required)
 * - POST /api/users/:id/follow — follows user (auth required)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only'
process.env.JWT_SECRET = JWT_SECRET

// Mock openapi registry
vi.mock('../config/openapi', () => ({
  openapiRegistry: { registerPath: vi.fn() },
}))

// Mock validate middleware to pass through
vi.mock('../middleware/validate', () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}))

// Mock schemas
vi.mock('../config/schemas', () => ({
  updateProfileSchema: {},
}))

// Mock authenticateToken to simulate auth
vi.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    const authHeader = req.headers['authorization']
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET!) as { userId: string }
        req.userId = decoded.userId
        next()
      } catch {
        _res.status(401).json({ message: 'Invalid token' })
      }
    } else {
      _res.status(401).json({ message: 'Authentication required' })
    }
  },
  optionalAuth: (req: any, _res: any, next: any) => next(),
}))

import usersRouter from './users'

function createApp(overrides: Record<string, unknown> = {}) {
  const app = express()
  app.use(express.json())

  const defaultMocks = {
    userService: {
      checkUsernameAvailable: vi.fn().mockResolvedValue(true),
      getUserProfile: vi.fn().mockImplementation((id: string) => {
        if (id === 'user-1') {
          return Promise.resolve({
            id: 'user-1',
            username: 'testuser',
            displayName: 'Test User',
            totalPoints: 500,
            tier: 'GOLD',
          })
        }
        return Promise.resolve(null)
      }),
      updateProfile: vi.fn().mockImplementation((_id: string, data: any) =>
        Promise.resolve({ id: 'user-1', ...data }),
      ),
    },
  }

  app.use((req: any, _res, next) => {
    req.container = { cradle: { ...defaultMocks, ...overrides } }
    next()
  })

  app.use('/api/users', usersRouter)
  return app
}

function makeToken(userId = 'user-1'): string {
  return jwt.sign({ userId, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '1h' })
}

describe('User Routes', () => {
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    app = createApp()
  })

  describe('GET /api/users/check-username', () => {
    it('returns available: true when username is free', async () => {
      const res = await request(app).get('/api/users/check-username?username=newuser')

      expect(res.status).toBe(200)
      expect(res.body.available).toBe(true)
    })

    it('returns available: false when username is taken', async () => {
      const mockService = {
        checkUsernameAvailable: vi.fn().mockResolvedValue(false),
      }
      const appTaken = createApp({ userService: mockService })

      const res = await request(appTaken).get('/api/users/check-username?username=taken')

      expect(res.status).toBe(200)
      expect(res.body.available).toBe(false)
    })
  })

  describe('GET /api/users/:id', () => {
    it('returns user profile by ID', async () => {
      const res = await request(app).get('/api/users/user-1')

      expect(res.status).toBe(200)
      expect(res.body.id).toBe('user-1')
      expect(res.body.username).toBe('testuser')
    })

    it('returns 404 for unknown user', async () => {
      const res = await request(app).get('/api/users/unknown')

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('USER_NOT_FOUND')
    })
  })

  describe('PATCH /api/users/me', () => {
    it('updates profile when authenticated', async () => {
      const token = makeToken('user-1')
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'New Name' })

      expect(res.status).toBe(200)
    })

    it('returns 401 when not authenticated', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .send({ displayName: 'New Name' })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/users/:id/follow', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).post('/api/users/user-2/follow')

      expect(res.status).toBe(401)
    })
  })
})
