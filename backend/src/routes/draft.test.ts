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
// Import the router statically so the (heavy) module graph is loaded during
// the file's import phase — a dynamic import inside the first test can blow
// past the 10s per-test timeout on slower runners.
import draftRouter from './draft'

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

// ─── Mock DraftService (mirrors the current draftAppService API) ─

const mockSession = {
  sessionId: 'draft-1',
  tournamentId: 'fifa-wc-2026',
  userId: 'user-1',
  formation: '4-3-3',
  status: 'IN_PROGRESS',
  currentRound: 1,
  totalRounds: 11,
}

const mockDraftService = {
  startDraft: vi.fn().mockResolvedValue({
    success: true,
    session: mockSession,
    nextRound: { roundNumber: 1, choices: [] },
  }),
  loadFormations: vi.fn().mockReturnValue([{ id: '4-3-3', name: '4-3-3', slots: 11 }]),
  listUserDrafts: vi.fn().mockResolvedValue([]),
  getTicketBalance: vi.fn().mockResolvedValue({ balance: 5, total: 10, used: 5, remaining: 5 }),
  getSessionState: vi.fn().mockImplementation((sessionId: string) => {
    if (sessionId === 'draft-1') {
      return Promise.resolve({ error: undefined, session: mockSession, picks: [], squad: [] })
    }
    return Promise.resolve({ error: 'Session not found' })
  }),
  processPick: vi.fn().mockResolvedValue({ success: true, nextRound: null, session: mockSession, complete: false }),
  commitSquad: vi.fn().mockResolvedValue({
    success: true,
    session: mockSession,
    synergyScore: 12,
    formationBonus: 2,
    squad: [],
  }),
}

const mockUserService = {
  getUser: vi.fn().mockResolvedValue({ id: 'user-1', isPro: true }),
}

const mockPrisma = {
  player: { findMany: vi.fn().mockResolvedValue([]) },
}

// ─── Helpers ───────────────────────────────────────────

function createAuthToken(userId = 'user-1') {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '1h' })
}

async function createTestApp() {
  const app = express()
  app.use(express.json())

  app.use((req: express.Request & { container?: { cradle: Record<string, unknown> }; userId?: string }, _res, next) => {
    req.container = { cradle: { draftService: mockDraftService, userService: mockUserService, prisma: mockPrisma } }
    next()
  })

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
      const res = await request(app).get('/api/draft/formations').set('Authorization', `Bearer ${createAuthToken()}`)

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
      expect(res.body.session.sessionId).toBe('draft-1')
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
      const res = await request(app).get('/api/draft/mine').set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe('GET /api/draft/tickets', () => {
    it('returns ticket balance', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/draft/tickets')
        .query({ tournamentId: 'fifa-wc-2026' })
        .set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.balance).toBe(5)
    })
  })

  describe('GET /api/draft/:sessionId', () => {
    it('returns session state', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/draft/draft-1').set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.session.sessionId).toBe('draft-1')
    })

    it('returns 404 for non-existent session', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/draft/nonexistent').set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/draft/:sessionId/pick', () => {
    it('makes a player pick', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .post('/api/draft/draft-1/pick')
        .set('Authorization', `Bearer ${createAuthToken()}`)
        .send({ slotIndex: 0, pickedPlayerId: 'p-1' })

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
