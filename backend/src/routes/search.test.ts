/**
 * Search Routes Tests — MatchMind
 *
 * Tests:
 * - GET /api/search?q= — searches users and players
 * - Returns empty results for short queries
 * - Returns empty results for missing query
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import request from 'supertest'
import searchRouter from './search'

function createMockContainer(overrides: Record<string, unknown> = {}) {
  return {
    cradle: {
      prisma: {
        user: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        player: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      ...overrides,
    },
  }
}

interface TestRequest extends Request {
  container?: ReturnType<typeof createMockContainer>
  userId?: string
}

function createApp(container: ReturnType<typeof createMockContainer>) {
  const app = express()
  app.use(express.json())
  app.use((req: TestRequest, _res: Response, next: NextFunction) => {
    req.container = container
    req.userId = 'user-1'
    next()
  })
  app.use('/api/search', searchRouter)
  return app
}

describe('Search Routes', () => {
  let container: ReturnType<typeof createMockContainer>

  beforeEach(() => {
    vi.clearAllMocks()
    container = createMockContainer()
  })

  describe('GET /api/search', () => {
    it('returns empty results for missing query', async () => {
      const app = createApp(container)

      const res = await request(app).get('/api/search')

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ users: [], players: [] })
    })

    it('returns empty results for short query', async () => {
      const app = createApp(container)

      const res = await request(app).get('/api/search?q=a')

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ users: [], players: [] })
    })

    it('searches users and players for valid query', async () => {
      const mockUsers = [
        { id: 'u1', username: 'alice', displayName: 'Alice', avatar: null, tier: 'GOLD' },
      ]
      const mockPlayers = [
        { id: 'p1', name: 'Alice Smith', position: 'BATTER' },
      ]

      container.cradle.prisma.user.findMany = vi.fn().mockResolvedValue(mockUsers)
      container.cradle.prisma.player.findMany = vi.fn().mockResolvedValue(mockPlayers)

      const app = createApp(container)

      const res = await request(app).get('/api/search?q=alice')

      expect(res.status).toBe(200)
      expect(res.body.users).toHaveLength(1)
      expect(res.body.players).toHaveLength(1)
      expect(res.body.users[0].username).toBe('alice')
      expect(res.body.players[0].name).toBe('Alice Smith')
    })

    it('trims whitespace from query', async () => {
      const app = createApp(container)

      await request(app).get('/api/search?q=%20%20test%20%20')

      // Should still search with trimmed "test"
      expect(container.cradle.prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                username: expect.objectContaining({ contains: 'test' }),
              }),
            ]),
          }),
        }),
      )
    })
  })
})
