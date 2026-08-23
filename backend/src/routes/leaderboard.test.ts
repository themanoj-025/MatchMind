/**
 * Leaderboard Routes Tests — MatchMind
 *
 * Tests leaderboard endpoints:
 * - GET /api/leaderboard/rooms/:roomId — returns room leaderboard
 * - GET /api/leaderboard/rooms/:roomId — 404 for unknown room
 * - GET /api/leaderboard/global — returns deprecation message
 * - GET /api/leaderboard/sport/:sport — returns deprecation message
 * - GET /api/leaderboard/weekly — returns deprecation message
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Mock openapi registry
vi.mock('../config/openapi', () => ({
  openapiRegistry: { registerPath: vi.fn() },
}))

// Mock leaderboardService
vi.mock('../services/leaderboardService', () => ({
  computeRoomLeaderboard: vi.fn().mockReturnValue([
    { rank: 1, userId: 'user-1', totalPoints: 100, entries: 3, avgPoints: 33.3, rosterValue: 500 },
  ]),
}))

import leaderboardRouter from './leaderboard'

function createApp(overrides: Record<string, unknown> = {}) {
  const app = express()
  app.use(express.json())

  const defaultMocks = {
    roomService: {
      getRoomLeaderboardData: vi.fn().mockResolvedValue({
        ledger: [{ userId: 'user-1', totalPoints: 55 }],
        tournamentId: 'fifa-wc-2026',
        rosters: [{ userId: 'user-1', soldPrice: 500 }],
      }),
    },
    cacheService: {
      getOrFetch: vi.fn().mockImplementation((_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher()),
    },
  }

  app.use((req: any, _res, next) => {
    req.container = { cradle: { ...defaultMocks, ...overrides } }
    next()
  })

  app.use('/api/leaderboard', leaderboardRouter)
  return app
}

describe('Leaderboard Routes', () => {
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    app = createApp()
  })

  it('GET /api/leaderboard/rooms/:roomId returns leaderboard', async () => {
    const res = await request(app).get('/api/leaderboard/rooms/room-1')

    expect(res.status).toBe(200)
    expect(res.body.roomId).toBe('room-1')
    expect(res.body.tournamentId).toBe('fifa-wc-2026')
    expect(Array.isArray(res.body.entries)).toBe(true)
  })

  it('GET /api/leaderboard/rooms/:roomId returns 404 for unknown room', async () => {
    const mockRoomService = {
      getRoomLeaderboardData: vi.fn().mockResolvedValue(null),
    }
    const mockCacheService = {
      getOrFetch: vi.fn().mockImplementation((_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher()),
    }
    const app404 = createApp({ roomService: mockRoomService, cacheService: mockCacheService })

    const res = await request(app404).get('/api/leaderboard/rooms/unknown')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('ROOM_NOT_FOUND')
  })

  it('GET /api/leaderboard/global returns deprecation message', async () => {
    const res = await request(app).get('/api/leaderboard/global')

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('per-room leaderboards')
  })

  it('GET /api/leaderboard/sport/:sport returns deprecation message', async () => {
    const res = await request(app).get('/api/leaderboard/sport/football')

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('Single-sport platform')
  })

  it('GET /api/leaderboard/weekly returns deprecation message', async () => {
    const res = await request(app).get('/api/leaderboard/weekly')

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('Weekly ranking replaced')
  })
})
