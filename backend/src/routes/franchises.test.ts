/**
 * Franchises Routes Tests — MatchMind
 *
 * Tests roster/franchise endpoints:
 * - GET /api/rooms/:roomId/franchises/:userId (view roster)
 * - PATCH /api/rooms/:roomId/franchises/me/captain (set captain/vice-captain)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only'

// ─── Mock Prisma ───────────────────────────────────────

function createMockPrisma() {
  const roster: Record<string, { id: string; roomId: string; userId: string; playerId: string; isCaptain: boolean; isViceCaptain: boolean; player: { id: string; name: string; position: string; club: string; nationality: string } | null }> = {}
  const rooms: Record<string, { id: string; status: string }> = {
    'room-1': { id: 'room-1', status: 'AUCTION' },
    'room-2': { id: 'room-2', status: 'LOBBY' },
  }
  const members: Record<string, { roomId: string; userId: string; remainingBudget: number }> = {
    'room-1:user-1': { roomId: 'room-1', userId: 'user-1', remainingBudget: 200 },
  }
  let nextRosterId = 1

  return {
    roster: {
      findMany: vi.fn().mockImplementation(({ where }: { where: Record<string, string> }) => {
        return Promise.resolve(
          Object.values(roster).filter((r) => r.roomId === where.roomId && r.userId === where.userId),
        )
      }),
      findUnique: vi.fn().mockImplementation(({ where }: { where: Record<string, string> }) => {
        return Promise.resolve(roster[where.id] || null)
      }),
      update: vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        if (roster[where.id]) {
          Object.assign(roster[where.id], data)
          return Promise.resolve(roster[where.id])
        }
        return Promise.resolve(null)
      }),
      _seed(id: string, roomId: string, userId: string, playerId: string, player: Record<string, string>) {
        roster[id] = { id, roomId, userId, playerId, isCaptain: false, isViceCaptain: false, player: player as never }
      },
    },
    room: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        return Promise.resolve(rooms[where.id] || null)
      }),
    },
    roomMember: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { roomId_userId: { roomId: string; userId: string } } }) => {
        const key = `${where.roomId_userId.roomId}:${where.roomId_userId.userId}`
        return Promise.resolve(members[key] || null)
      }),
    },
  }
}

// ─── Tests ─────────────────────────────────────────────

describe('Franchises Routes', () => {
  let prisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    prisma = createMockPrisma()
    // Seed roster entries
    prisma.roster._seed('r-1', 'room-1', 'user-1', 'p-1', { id: 'p-1', name: 'Lionel Messi', position: 'FW', club: 'Inter Miami', nationality: 'Argentina' })
    prisma.roster._seed('r-2', 'room-1', 'user-1', 'p-2', { id: 'p-2', name: 'Kylian Mbappé', position: 'FW', club: 'Real Madrid', nationality: 'France' })
    prisma.roster._seed('r-3', 'room-1', 'user-1', 'p-3', { id: 'p-3', name: 'Erling Haaland', position: 'FW', club: 'Man City', nationality: 'Norway' })
    vi.clearAllMocks()
  })

  function createTestApp() {
    const app = express()
    app.use(express.json())

    app.use((req: express.Request & { container?: { cradle: Record<string, unknown> }; userId?: string }, _res, next) => {
      req.container = { cradle: { prisma: prisma as never } }
      next()
    })

    return app
  }

  function createAuthToken(userId = 'user-1') {
    return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '1h' })
  }

  describe('GET /api/rooms/:roomId/franchises/:userId', () => {
    it('returns roster for a user', async () => {
      const app = createTestApp()
      const { default: router } = await import('./franchises')
      app.use('/api/rooms', router)

      const res = await request(app)
        .get('/api/rooms/room-1/franchises/user-1')
        .set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.userId).toBe('user-1')
      expect(res.body.roster).toHaveLength(3)
      expect(res.body.remainingBudget).toBe(200)
      expect(res.body.rosterSize).toBe(3)
    })

    it('returns empty roster for user with no players', async () => {
      const app = createTestApp()
      const { default: router } = await import('./franchises')
      app.use('/api/rooms', router)

      const res = await request(app)
        .get('/api/rooms/room-1/franchises/user-unknown')
        .set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.roster).toHaveLength(0)
      expect(res.body.rosterSize).toBe(0)
    })

    it('rejects unauthenticated request', async () => {
      const app = createTestApp()
      const { default: router } = await import('./franchises')
      app.use('/api/rooms', router)

      const res = await request(app).get('/api/rooms/room-1/franchises/user-1')
      expect(res.status).toBe(401)
    })
  })

  describe('PATCH /api/rooms/:roomId/franchises/me/captain', () => {
    it('sets a player as captain', async () => {
      const app = createTestApp()
      const { default: router } = await import('./franchises')
      app.use('/api/rooms', router)

      const res = await request(app)
        .patch('/api/rooms/room-1/franchises/me/captain')
        .set('Authorization', `Bearer ${createAuthToken()}`)
        .send({ playerId: 'p-1', isViceCaptain: false })

      expect(res.status).toBe(200)
      // Should have called update to clear all flags, then set captain
      expect(prisma.roster.update).toHaveBeenCalled()
    })

    it('sets a player as vice-captain', async () => {
      const app = createTestApp()
      const { default: router } = await import('./franchises')
      app.use('/api/rooms', router)

      const res = await request(app)
        .patch('/api/rooms/room-1/franchises/me/captain')
        .set('Authorization', `Bearer ${createAuthToken()}`)
        .send({ playerId: 'p-2', isViceCaptain: true })

      expect(res.status).toBe(200)
      expect(prisma.roster.update).toHaveBeenCalled()
    })

    it('returns 400 when playerId is missing', async () => {
      const app = createTestApp()
      const { default: router } = await import('./franchises')
      app.use('/api/rooms', router)

      const res = await request(app)
        .patch('/api/rooms/room-1/franchises/me/captain')
        .set('Authorization', `Bearer ${createAuthToken()}`)
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('MISSING_PLAYER_ID')
    })

    it('returns 404 when room is not found', async () => {
      const app = createTestApp()
      const { default: router } = await import('./franchises')
      app.use('/api/rooms', router)

      const res = await request(app)
        .patch('/api/rooms/room-nonexistent/franchises/me/captain')
        .set('Authorization', `Bearer ${createAuthToken()}`)
        .send({ playerId: 'p-1' })

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('ROOM_NOT_FOUND')
    })

    it('returns 400 when room is in LOBBY', async () => {
      const app = createTestApp()
      const { default: router } = await import('./franchises')
      app.use('/api/rooms', router)

      const res = await request(app)
        .patch('/api/rooms/room-2/franchises/me/captain')
        .set('Authorization', `Bearer ${createAuthToken()}`)
        .send({ playerId: 'p-1' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('ROOM_NOT_ACTIVE')
    })

    it('returns 400 when player is not in roster', async () => {
      const app = createTestApp()
      const { default: router } = await import('./franchises')
      app.use('/api/rooms', router)

      const res = await request(app)
        .patch('/api/rooms/room-1/franchises/me/captain')
        .set('Authorization', `Bearer ${createAuthToken()}`)
        .send({ playerId: 'p-nonexistent' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('PLAYER_NOT_IN_ROSTER')
    })
  })
})
