/**
 * Draft Routes Tests — MatchMind
 *
 * Tests the Draft Mode endpoints:
 * - POST /api/draft/start
 * - GET /api/draft/formations
 * - GET /api/draft/mine
 * - GET /api/draft/tickets
 * - GET /api/draft/:sessionId
 * - POST /api/draft/:sessionId/pick
 * - POST /api/draft/:sessionId/commit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only'

// ─── Mocks ─────────────────────────────────────────────

vi.mock('../middleware/validate', () => ({
  validate: (_schema: unknown) => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))

vi.mock('../middleware/rateLimiter', () => ({
  draftLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))

vi.mock('../middleware/draftGate', () => ({
  getDraftEnabledTournaments: vi.fn().mockReturnValue(['fifa-wc-2026']),
}))

vi.mock('../config/openapi', () => ({
  openapiRegistry: { registerPath: vi.fn() },
}))

vi.mock('../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// ─── Mock DraftService ─────────────────────────────────

const mockDraftService = {
  startDraft: vi.fn().mockResolvedValue({
    sessionId: 'draft-1',
    tournamentId: 'fifa-wc-2026',
    formation: '4-3-3',
    status: 'IN_PROGRESS',
    currentRound: 1,
    totalRounds: 11,
    picks: [],
  }),
  getSession: vi.fn().mockImplementation((id: string) => {
    if (id === 'draft-1') {
      return Promise.resolve({
        sessionId: 'draft-1',
        tournamentId: 'fifa-wc-2026',
        formation: '4-3-3',
        status: 'IN_PROGRESS',
        currentRound: 1,
        totalRounds: 11,
        picks: [],
        choices: [],
      })
    }
    return Promise.resolve(null)
  }),
  getNextChoices: vi.fn().mockResolvedValue([
    { playerId: 'p-1', name: 'Lionel Messi', position: 'FW', basePrice: 50, club: 'Inter Miami' },
    { playerId: 'p-2', name: 'Kylian Mbappé', position: 'FW', basePrice: 45, club: 'Real Madrid' },
  ]),
  makePick: vi.fn().mockResolvedValue({ success: true, pick: { playerId: 'p-1', round: 1 } }),
  commitSquad: vi.fn().mockResolvedValue({ success: true, squadId: 'squad-1' }),
  getUserSessions: vi.fn().mockResolvedValue([]),
}

const mockUserService = {
  getDraftTickets: vi.fn().mockResolvedValue({ balance: 5, total: 10, used: 5 }),
}

// ─── Helpers ───────────────────────────────────────────

function createAuthToken(userId = 'user-1') {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '1h' })
}

async function createTestApp() {
  const app = express()
  app.use(express.json())

  app.use((req: express.Request & { container?: { cradle: Record<string, unknown> }; userId?: string }, _res, next) => {
    req.container = { cradle: { draftService: mockDraftService, userService: mockUserService } }
    next()
  })

  const { default: draftRouter } = await import('./draft')
  app.use('/api/draft', draftRouter)

  return app
}

// ─── Tests ─────────────────────────────────────────────

describe('Draft Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication', () => {
    it('rejects unauthenticated requests', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/draft/formations')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/draft/formations', () => {
    it('returns available formations', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/draft/formations')
        .set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe('POST /api/draft/start', () => {
    it('starts a new draft session', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .post('/api/draft/start')
        .set('Authorization', `Bearer ${createAuthToken()}`)
        .send({ tournamentId: 'fifa-wc-2026', formation: '4-3-3' })

      expect(res.status).toBe(201)
      expect(res.body.sessionId).toBe('draft-1')
      expect(mockDraftService.startDraft).toHaveBeenCalled()
    })

    it('rejects draft for disabled tournament', async () => {
      const { getDraftEnabledTournaments } = await import('../middleware/draftGate')
      vi.mocked(getDraftEnabledTournaments).mockReturnValue(['fifa-wc-2026'])

      const app = await createTestApp()
      const res = await request(app)
        .post('/api/draft/start')
        .set('Authorization', `Bearer ${createAuthToken()}`)
        .send({ tournamentId: 'disabled-tournament', formation: '4-3-3' })

      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('DRAFT_MODE_DISABLED')
    })
  })

  describe('GET /api/draft/mine', () => {
    it('returns user draft sessions', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/draft/mine')
        .set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe('GET /api/draft/tickets', () => {
    it('returns ticket balance', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/draft/tickets')
        .set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.balance).toBe(5)
    })
  })

  describe('GET /api/draft/:sessionId', () => {
    it('returns session state', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/draft/draft-1')
        .set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.sessionId).toBe('draft-1')
    })

    it('returns 404 for non-existent session', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/draft/nonexistent')
        .set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/draft/:sessionId/pick', () => {
    it('makes a player pick', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .post('/api/draft/draft-1/pick')
        .set('Authorization', `Bearer ${createAuthToken()}`)
        .send({ playerId: 'p-1' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe('POST /api/draft/:sessionId/commit', () => {
    it('commits the squad', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .post('/api/draft/draft-1/commit')
        .set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })
})
