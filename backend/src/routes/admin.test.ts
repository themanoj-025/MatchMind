/**
 * Admin Routes Tests — MatchMind
 *
 * Tests admin endpoints (all require auth + admin role):
 * - GET /api/admin/stats
 * - GET /api/admin/users (paginated)
 * - GET /api/admin/users/:id
 * - PATCH /api/admin/users/:id
 * - GET /api/admin/settings
 * - POST /api/admin/settings/draft-mode/:tournamentId/:action
 * - GET /api/admin/draft/pool-validation
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

const mockAdminService = {
  logAction: vi.fn().mockResolvedValue(undefined),
  getStats: vi.fn().mockResolvedValue({
    totalUsers: 100,
    activeRooms: 5,
    totalMatches: 50,
    totalPredictions: 200,
  }),
  getUsers: vi.fn().mockResolvedValue({
    data: [
      { id: 'user-1', username: 'alice', email: 'alice@test.com', tier: 'PRO', isPro: true },
      { id: 'user-2', username: 'bob', email: 'bob@test.com', tier: 'BRONZE', isPro: false },
    ],
    total: 2,
    page: 1,
    pageSize: 20,
  }),
  getUserById: vi.fn().mockImplementation((id: string) => {
    if (id === 'user-1') {
      return Promise.resolve({ id: 'user-1', username: 'alice', email: 'alice@test.com', tier: 'PRO', isPro: true })
    }
    return Promise.resolve(null)
  }),
  updateUser: vi.fn().mockImplementation((_id: string, data: Record<string, unknown>) => {
    return Promise.resolve({ id: 'user-1', ...data })
  }),
  togglePro: vi.fn().mockResolvedValue({ id: 'user-1', isPro: true }),
}

vi.mock('../services/adminService', () => ({
  AdminService: vi.fn().mockImplementation(() => mockAdminService),
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

async function createTestApp() {
  const app = express()
  app.use(express.json())

  app.use((req: express.Request & { container?: { cradle: Record<string, unknown> }; userId?: string; userRole?: string }, _res, next) => {
    req.container = { cradle: { adminService: mockAdminService, prisma: {} } }
    next()
  })

  const { default: adminRouter } = await import('./admin')
  app.use('/api/admin', adminRouter)

  // Error handler
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const httpErr = (typeof err === 'object' && err !== null ? err : {}) as { statusCode?: number; code?: string; message?: string; isAppError?: boolean }
    if (httpErr.isAppError) {
      return res.status(httpErr.statusCode || 400).json({ error: { code: httpErr.code, message: httpErr.message } })
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
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${createUserToken()}`)
      expect(res.status).toBe(403)
    })
  })

  describe('GET /api/admin/stats', () => {
    it('returns dashboard stats for admin', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${createAdminToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.totalUsers).toBe(100)
      expect(res.body.activeRooms).toBe(5)
    })
  })

  describe('GET /api/admin/users', () => {
    it('returns paginated user list', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${createAdminToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
      expect(res.body.total).toBe(2)
    })
  })

  describe('GET /api/admin/users/:id', () => {
    it('returns a user by id', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/admin/users/user-1')
        .set('Authorization', `Bearer ${createAdminToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.username).toBe('alice')
    })

    it('returns 404 for non-existent user', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/admin/users/user-nonexistent')
        .set('Authorization', `Bearer ${createAdminToken()}`)

      expect(res.status).toBe(404)
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
      expect(mockAdminService.updateUser).toHaveBeenCalledWith('user-1', expect.objectContaining({ tier: 'GOLD' }))
    })
  })

  describe('GET /api/admin/settings', () => {
    it('returns admin settings', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${createAdminToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.draftEnabledTournaments).toBeDefined()
    })
  })

  describe('GET /api/admin/draft/pool-validation', () => {
    it('returns pool validation results', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/admin/draft/pool-validation')
        .set('Authorization', `Bearer ${createAdminToken()}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('valid')
    })
  })
})
