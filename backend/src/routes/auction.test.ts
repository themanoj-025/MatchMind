/**
 * Auction Routes Tests — MatchMind
 *
 * Tests the auction host control endpoints:
 * - GET /api/auction/:roomId/state
 * - POST /api/auction/:roomId/start
 * - POST /api/auction/:roomId/next-player
 * - POST /api/auction/:roomId/force-sold
 * - POST /api/auction/:roomId/pause
 * - POST /api/auction/:roomId/resume
 * - POST /api/auction/:roomId/end
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only'

// ─── Mocks ─────────────────────────────────────────────

vi.mock('../services/auctionEngine', () => ({
  processBid: vi.fn(),
  sellCurrentPlayer: vi.fn().mockResolvedValue({ phase: 'SOLD' }),
  unsoldCurrentPlayer: vi.fn().mockResolvedValue({ phase: 'UNSOLD' }),
  moveToNextPlayer: vi.fn().mockResolvedValue({ phase: 'PLAYER_LIVE' }),
  startReAuction: vi.fn().mockResolvedValue({ phase: 'RE_AUCTION' }),
}))

vi.mock('../middleware/rateLimiter', () => ({
  auctionActionLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))

vi.mock('../config/openapi', () => ({
  openapiRegistry: { registerPath: vi.fn() },
}))

vi.mock('../lib/queue', () => ({
  scheduleAuctionTimer: vi.fn(),
}))

vi.mock('../lib/redis', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}))

vi.mock('../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// ─── Helpers ───────────────────────────────────────────

function createAuthToken(userId = 'host-1') {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '1h' })
}

function createMockPrisma() {
  const auctionStates: Record<string, { roomId: string; phase: string; currentPlayerId: string | null; currentBid: number; currentBidderId: string | null; timerEndsAt: string | null; version: number }> = {
    'room-1': {
      roomId: 'room-1',
      phase: 'IDLE',
      currentPlayerId: null,
      currentBid: 0,
      currentBidderId: null,
      timerEndsAt: null,
      version: 1,
    },
  }

  const rooms: Record<string, { id: string; hostId: string; status: string; tournamentId: string }> = {
    'room-1': { id: 'room-1', hostId: 'host-1', status: 'AUCTION', tournamentId: 'fifa-wc-2026' },
    'room-2': { id: 'room-2', hostId: 'other-host', status: 'AUCTION', tournamentId: 'fifa-wc-2026' },
  }

  return {
    auctionState: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { roomId: string } }) => Promise.resolve(auctionStates[where.roomId] || null)),
      update: vi.fn().mockImplementation(({ where, data }: { where: { roomId: string }; data: Record<string, unknown> }) => {
        if (auctionStates[where.roomId]) {
          Object.assign(auctionStates[where.roomId], data)
          return Promise.resolve(auctionStates[where.roomId])
        }
        return Promise.resolve(null)
      }),
      updateMany: vi.fn().mockImplementation(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (auctionStates[where.roomId as string]) {
          Object.assign(auctionStates[where.roomId as string], data)
          return Promise.resolve({ count: 1 })
        }
        return Promise.resolve({ count: 0 })
      }),
    },
    room: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve(rooms[where.id] || null)),
    },
    roster: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  }
}

async function createTestApp(prisma: ReturnType<typeof createMockPrisma>) {
  const app = express()
  app.use(express.json())

  app.use((req: express.Request & { container?: { cradle: Record<string, unknown> }; userId?: string }, _res, next) => {
    req.container = { cradle: { prisma: prisma as never } }
    next()
  })

  const { default: auctionRouter } = await import('./auction')
  app.use('/api/auction', auctionRouter)

  return app
}

// ─── Tests ─────────────────────────────────────────────

describe('Auction Routes', () => {
  let prisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    prisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('Authentication', () => {
    it('rejects unauthenticated requests', async () => {
      const app = await createTestApp(prisma)
      const res = await request(app).get('/api/auction/room-1/state')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/auction/:roomId/state', () => {
    it('returns auction state', async () => {
      const app = await createTestApp(prisma)
      const res = await request(app)
        .get('/api/auction/room-1/state')
        .set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.phase).toBe('IDLE')
      expect(res.body.roomId).toBe('room-1')
    })

    it('returns 404 when state not found', async () => {
      const app = await createTestApp(prisma)
      const res = await request(app)
        .get('/api/auction/room-nonexistent/state')
        .set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/auction/:roomId/start', () => {
    it('starts the auction (host)', async () => {
      const app = await createTestApp(prisma)
      const res = await request(app)
        .post('/api/auction/room-1/start')
        .set('Authorization', `Bearer ${createAuthToken('host-1')}`)
        .send({ playerId: 'p-1' })

      expect(res.status).toBe(200)
      expect(res.body.phase).toBe('PLAYER_LIVE')
    })

    it('rejects non-host user', async () => {
      const app = await createTestApp(prisma)
      const res = await request(app)
        .post('/api/auction/room-1/start')
        .set('Authorization', `Bearer ${createAuthToken('not-host')}`)
        .send({ playerId: 'p-1' })

      expect(res.status).toBe(403)
    })
  })

  describe('POST /api/auction/:roomId/next-player', () => {
    it('moves to next player', async () => {
      prisma.auctionState.findUnique = vi.fn().mockResolvedValue({
        roomId: 'room-1', phase: 'SOLD', currentPlayerId: 'p-1', currentBid: 100,
        currentBidderId: 'user-1', timerEndsAt: null, version: 2,
      })

      const app = await createTestApp(prisma)
      const res = await request(app)
        .post('/api/auction/room-1/next-player')
        .set('Authorization', `Bearer ${createAuthToken('host-1')}`)

      expect(res.status).toBe(200)
    })
  })

  describe('POST /api/auction/:roomId/pause', () => {
    it('pauses the auction', async () => {
      prisma.auctionState.findUnique = vi.fn().mockResolvedValue({
        roomId: 'room-1', phase: 'PLAYER_LIVE', currentPlayerId: 'p-1', currentBid: 0,
        currentBidderId: null, timerEndsAt: null, version: 1,
      })

      const app = await createTestApp(prisma)
      const res = await request(app)
        .post('/api/auction/room-1/pause')
        .set('Authorization', `Bearer ${createAuthToken('host-1')}`)

      expect(res.status).toBe(200)
    })
  })

  describe('POST /api/auction/:roomId/end', () => {
    it('ends the auction', async () => {
      prisma.auctionState.findUnique = vi.fn().mockResolvedValue({
        roomId: 'room-1', phase: 'SOLD', currentPlayerId: 'p-1', currentBid: 100,
        currentBidderId: 'user-1', timerEndsAt: null, version: 3,
      })

      const app = await createTestApp(prisma)
      const res = await request(app)
        .post('/api/auction/room-1/end')
        .set('Authorization', `Bearer ${createAuthToken('host-1')}`)

      expect(res.status).toBe(200)
      expect(res.body.phase).toBe('FINISHED')
    })
  })
})
