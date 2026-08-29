/**
 * Fixtures Routes Tests — MatchMind
 *
 * Tests the fixture endpoints:
 * - GET /api/fixtures (list by tournament)
 * - GET /api/fixtures/:id (single fixture)
 * - POST /api/fixtures (create — admin)
 * - POST /api/fixtures/:id/player-stats (enter stats — admin)
 * - POST /api/fixtures/:id/finalize (lock + compute points — admin)
 */

import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only'

// ─── Mocks ─────────────────────────────────────────────

const mockMatchService = {
  getFixtures: vi.fn().mockResolvedValue([
    { id: 'fix-1', tournamentId: 'fifa-wc-2026', homeTeam: 'Brazil', awayTeam: 'Argentina', status: 'SCHEDULED' },
    { id: 'fix-2', tournamentId: 'fifa-wc-2026', homeTeam: 'Germany', awayTeam: 'France', status: 'SCHEDULED' },
  ]),
  getFixtureDetails: vi.fn().mockImplementation((id: string) => {
    if (id === 'fix-1') {
      return Promise.resolve({ id: 'fix-1', tournamentId: 'fifa-wc-2026', homeTeam: 'Brazil', awayTeam: 'Argentina', playerStats: [] })
    }
    return Promise.resolve(null)
  }),
  createFixture: vi.fn().mockImplementation((data: Record<string, unknown>) => {
    return Promise.resolve({ id: 'fix-new', ...data })
  }),
  enterPlayerStats: vi.fn().mockResolvedValue([{ id: 'stat-1', fixtureId: 'fix-1', playerId: 'p-1' }]),
  finalizeFixture: vi.fn().mockResolvedValue({ roomsProcessed: 3, fantasyEntries: 12 }),
}

vi.mock('../services/fantasyPoints', () => ({
  computeFantasyPoints: vi.fn().mockReturnValue([]),
}))

vi.mock('../config/openapi', () => ({
  openapiRegistry: { registerPath: vi.fn() },
}))

vi.mock('../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// ─── Helpers ───────────────────────────────────────────

function createAdminToken(userId = 'admin-1') {
  return jwt.sign({ userId, role: 'ADMIN' }, process.env.JWT_SECRET!, { expiresIn: '1h' })
}

async function createTestApp() {
  const app = express()
  app.use(express.json())

  // DI middleware
  app.use((req: express.Request & { container?: { cradle: Record<string, unknown> }; userId?: string }, _res, next) => {
    req.container = { cradle: { matchService: mockMatchService } }
    next()
  })

  const { default: fixturesRouter } = await import('./fixtures')
  app.use('/api/fixtures', fixturesRouter)

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

describe('Fixtures Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/fixtures', () => {
    it('returns fixtures for a tournament', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/fixtures?tournamentId=fifa-wc-2026')

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
      expect(res.body[0].id).toBe('fix-1')
      expect(mockMatchService.getFixtures).toHaveBeenCalledWith('fifa-wc-2026')
    })

    it('returns fixtures without tournament filter', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/fixtures')

      expect(res.status).toBe(200)
      expect(mockMatchService.getFixtures).toHaveBeenCalledWith(undefined)
    })
  })

  describe('GET /api/fixtures/:id', () => {
    it('returns a single fixture', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/fixtures/fix-1')

      expect(res.status).toBe(200)
      expect(res.body.id).toBe('fix-1')
      expect(mockMatchService.getFixtureDetails).toHaveBeenCalledWith('fix-1')
    })

    it('returns 404 for non-existent fixture', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/fixtures/fix-nonexistent')

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('FIXTURE_NOT_FOUND')
    })
  })

  describe('POST /api/fixtures (admin)', () => {
    it('creates a fixture with admin token', async () => {
      const app = await createTestApp()
      const token = createAdminToken()
      const res = await request(app)
        .post('/api/fixtures')
        .set('Authorization', `Bearer ${token}`)
        .send({ tournamentId: 'fifa-wc-2026', homeTeam: 'Spain', awayTeam: 'Italy' })

      expect(res.status).toBe(201)
      expect(res.body.id).toBe('fix-new')
      expect(mockMatchService.createFixture).toHaveBeenCalled()
    })

    it('rejects unauthenticated request', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .post('/api/fixtures')
        .send({ tournamentId: 'fifa-wc-2026', homeTeam: 'Spain', awayTeam: 'Italy' })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/fixtures/:id/player-stats (admin)', () => {
    it('enters player stats', async () => {
      const app = await createTestApp()
      const token = createAdminToken()
      const res = await request(app)
        .post('/api/fixtures/fix-1/player-stats')
        .set('Authorization', `Bearer ${token}`)
        .send({
          playerStats: [
            { playerId: 'p-1', minutesPlayed: 90, goals: 1, assists: 0, cleanSheet: true, saves: 0, penaltiesSaved: 0, yellowCards: 0, redCards: 0, penaltiesMissed: 0, ownGoals: 0, goalsConceded: 0 },
          ],
        })

      expect(res.status).toBe(201)
      expect(res.body).toHaveLength(1)
      expect(mockMatchService.enterPlayerStats).toHaveBeenCalledWith('fix-1', expect.any(Array))
    })

    it('rejects unauthenticated request', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .post('/api/fixtures/fix-1/player-stats')
        .send({ playerStats: [] })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/fixtures/:id/finalize (admin)', () => {
    it('finalizes a fixture', async () => {
      const app = await createTestApp()
      const token = createAdminToken()
      const res = await request(app)
        .post('/api/fixtures/fix-1/finalize')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Fixture finalized')
      expect(res.body.roomsProcessed).toBe(3)
      expect(res.body.fantasyEntries).toBe(12)
    })

    it('rejects unauthenticated request', async () => {
      const app = await createTestApp()
      const res = await request(app).post('/api/fixtures/fix-1/finalize')

      expect(res.status).toBe(401)
    })
  })
})
