/**
 * Players Routes Tests — MatchMind
 *
 * Tests:
 * - GET /api/players — lists players with cursor pagination
 * - GET /api/players/:id — returns player details or 404
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import playersRouter from './players'

function createMockContainer(overrides: Record<string, unknown> = {}) {
  return {
    cradle: {
      prisma: {
        player: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
        },
      },
      cacheService: {
        getOrFetch: vi.fn().mockImplementation((_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
      },
      ...overrides,
    },
  }
}

function createApp(container: ReturnType<typeof createMockContainer>) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    ;(req as any).container = container
    ;(req as any).userId = 'user-1'
    next()
  })
  app.use('/api/players', playersRouter)
  return app
}

describe('Players Routes', () => {
  let container: ReturnType<typeof createMockContainer>

  beforeEach(() => {
    vi.clearAllMocks()
    container = createMockContainer()
  })

  describe('GET /api/players', () => {
    it('returns empty list when no players', async () => {
      const app = createApp(container)

      const res = await request(app).get('/api/players')

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ data: [], hasMore: false })
    })

    it('returns players with cursor pagination', async () => {
      const mockPlayers = [
        { id: 'p1', name: 'Player 1' },
        { id: 'p2', name: 'Player 2' },
      ]
      container.cradle.cacheService.getOrFetch = vi.fn().mockResolvedValue({
        data: mockPlayers,
        hasMore: false,
        nextCursor: undefined,
      })

      const app = createApp(container)

      const res = await request(app).get('/api/players')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
    })

    it('filters by tournamentId', async () => {
      const app = createApp(container)

      await request(app).get('/api/players?tournamentId=t1')

      expect(container.cradle.cacheService.getOrFetch).toHaveBeenCalled()
    })
  })

  describe('GET /api/players/:id', () => {
    it('returns player when found', async () => {
      const mockPlayer = { id: 'p1', name: 'Player 1', position: 'BATTER' }
      container.cradle.cacheService.getOrFetch = vi.fn().mockResolvedValue(mockPlayer)

      const app = createApp(container)

      const res = await request(app).get('/api/players/p1')

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ id: 'p1', name: 'Player 1' })
    })

    it('returns 404 when player not found', async () => {
      container.cradle.cacheService.getOrFetch = vi.fn().mockResolvedValue(null)

      const app = createApp(container)

      const res = await request(app).get('/api/players/nonexistent')

      expect(res.status).toBe(404)
      expect(res.body).toMatchObject({
        error: { code: 'PLAYER_NOT_FOUND' },
      })
    })
  })
})
