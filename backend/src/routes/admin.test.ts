/**
 * Admin Routes Tests — MatchMind
 *
 * Tests admin endpoints (all require auth + admin role):
 * - GET    /api/admin/stats
 * - GET    /api/admin/users (paginated)
 * - GET    /api/admin/users/:id
 * - PATCH  /api/admin/users/:id
 * - GET    /api/admin/settings
 * - GET    /api/admin/draft/pool-validation
 *
 * Routes call Prisma directly through the request container; AdminService is
 * only used for dashboard stats and audit logging, so the prisma mock below
 * is the primary fixture.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only'

// ─── Mocks ─────────────────────────────────────────────

vi.mock('../config/env', () => ({
  env: {
    NODE_ENV: 'test',
    // authenticateToken verifies tokens against env.JWT_SECRET — without
    // this every authenticated request 403s (root cause of the previous
    // stale-mock failures in this file).
    JWT_SECRET: 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only',
    DRAFT_ENABLED_TOURNAMENTS: 'fifa-wc-2026',
  },
}))

vi.mock('../config/openapi', () => ({
  openapiRegistry: { registerPath: vi.fn() },
}))

vi.mock('../lib/redis', () => ({
  redis: {
    status: 'ready',
    keys: vi.fn().mockResolvedValue([]),
    del: vi.fn(),
  },
}))

vi.mock('../lib/validateDraftPool', () => ({
  validateTournamentDraftPool: vi.fn().mockReturnValue({ valid: true, errors: [] }),
}))

vi.mock('../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockAdminService = vi.hoisted(() => ({
  logAction: vi.fn().mockResolvedValue(undefined),
  getDashboardStats: vi.fn().mockResolvedValue({
    totalUsers: 100,
    activeRooms: 5,
    totalMatches: 50,
    totalPredictions: 200,
  }),
}))

// Routes call `new AdminService(deps)` — mock with a real class (vitest
// forwards `new` to the implementation, so an arrow implementation would
// throw "is not a constructor").
vi.mock('../services/adminService', () => ({
  AdminService: class MockAdminService {
    constructor(_deps?: unknown) {
      void _deps
    }

    logAction = mockAdminService.logAction
    getDashboardStats = mockAdminService.getDashboardStats
  },
}))

vi.mock('../repositories/index', () => ({
  createRepositories: vi.fn().mockReturnValue({}),
}))

// ─── Helpers ───────────────────────────────────────────

function createAdminToken(userId = 'admin-1') {
  return jwt.sign({ userId, role: 'ADMIN' }, process.env.JWT_SECRET!, { expiresIn: '1h' })
}

function createUserToken(userId = 'user-1') {
  return jwt.sign({ userId, role: 'USER' }, process.env.JWT_SECRET!, { expiresIn: '1h' })
}

const mockPrisma = {
  user: {
    // Serves both requireAdmin (role lookup by req.userId) and the
    // /users/:id detail route (include query by :id).
    findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) => {
      if (id === 'admin-1') {
        return Promise.resolve({ id: 'admin-1', role: 'ADMIN' })
      }
      if (id === 'user-1') {
        return Promise.resolve({
          id: 'user-1',
          username: 'alice',
          email: 'alice@test.com',
          tier: 'PRO',
          isPro: true,
        })
      }
      return Promise.resolve(null)
    }),
    findMany: vi.fn().mockResolvedValue([
      { id: 'user-1', username: 'alice', email: 'alice@test.com' },
      { id: 'user-2', username: 'bob', email: 'bob@test.com' },
    ]),
    count: vi.fn().mockResolvedValue(2),
    update: vi.fn().mockResolvedValue({ id: 'user-1', username: 'alice', email: 'alice@test.com', tier: 'GOLD' }),
  },
}

async function createTestApp() {
  const app = express()
  app.use(express.json())

  app.use((req: express.Request & { container?: { cradle: Record<string, unknown> }; userId?: string }, _res, next) => {
    req.container = { cradle: { adminService: mockAdminService, prisma: mockPrisma } }
    next()
  })

  const { default: adminRouter } = await import('./admin')
  app.use('/api/admin', adminRouter)

  // Mirror app.ts: DomainError → 400 with the standard error envelope.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const httpErr = (typeof err === 'object' && err !== null ? err : {}) as {
      statusCode?: number
      code?: string
      message?: string
    }
    if ((err as { name?: string }).name === 'DomainError') {
      return res
        .status(httpErr.statusCode || 400)
        .json({ error: { code: httpErr.code || 'DOMAIN_ERROR', message: httpErr.message } })
    }
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } })
  })

  return app
}

// ─── Tests ─────────────────────────────────────────────

describe('Admin Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication & Authorization', () => {
    it('rejects unauthenticated requests', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/admin/stats')
      expect(res.status).toBe(401)
    })

    it('rejects non-admin users', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${createUserToken()}`)
      expect(res.status).toBe(403)
    })
  })

  describe('GET /api/admin/stats', () => {
    it('returns dashboard stats for admin', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${createAdminToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.totalUsers).toBe(100)
      expect(res.body.activeRooms).toBe(5)
      expect(mockAdminService.getDashboardStats).toHaveBeenCalled()
    })
  })

  describe('GET /api/admin/users', () => {
    it('returns a paginated user list', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/admin/users?page=1&limit=20')
        .set('Authorization', `Bearer ${createAdminToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.users).toHaveLength(2)
      expect(res.body.total).toBe(2)
      expect(res.body.page).toBe(1)
    })

    it('returns 400 VALIDATION_ERROR for a non-numeric page (safeParse)', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/admin/users?page=banana')
        .set('Authorization', `Bearer ${createAdminToken()}`)

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /api/admin/users/:id', () => {
    it('returns a user by id', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/admin/users/user-1').set('Authorization', `Bearer ${createAdminToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.user.username).toBe('alice')
    })

    it('returns 404 for non-existent user', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/admin/users/user-nonexistent')
        .set('Authorization', `Bearer ${createAdminToken()}`)

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('USER_NOT_FOUND')
    })
  })

  describe('PATCH /api/admin/users/:id', () => {
    it('updates a user', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .patch('/api/admin/users/user-1')
        .set('Authorization', `Bearer ${createAdminToken()}`)
        .send({ tier: 'GOLD' })

      expect(res.status).toBe(200)
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ tier: 'GOLD' }),
        }),
      )
      expect(res.body.user.tier).toBe('GOLD')
    })
  })

  describe('GET /api/admin/settings', () => {
    it('returns feature-flag settings including draft mode', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/admin/settings').set('Authorization', `Bearer ${createAdminToken()}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.settings)).toBe(true)
      const draft = res.body.settings.find((s: { key: string }) => s.key === 'DRAFT_ENABLED_TOURNAMENTS')
      expect(draft).toBeDefined()
      expect(draft.enabled).toBe(true)
      expect(draft.tournaments).toContain('fifa-wc-2026')
    })
  })

  describe('GET /api/admin/draft/pool-validation', () => {
    it('returns per-tournament pool validation results', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/admin/draft/pool-validation')
        .set('Authorization', `Bearer ${createAdminToken()}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.tournaments)).toBe(true)
      // TOURNAMENTS is a static registry import, so every tournament is
      // validated and enriched with counts in one pass.
      expect(res.body.tournaments.length).toBeGreaterThan(0)
      for (const t of res.body.tournaments as Array<Record<string, unknown>>) {
        expect(t).toMatchObject({
          tournamentName: expect.any(String),
          shortName: expect.any(String),
          enabled: expect.any(Boolean),
          iconCount: expect.any(Number),
          playerCount: expect.any(Number),
        })
      }
    })
  })
})
