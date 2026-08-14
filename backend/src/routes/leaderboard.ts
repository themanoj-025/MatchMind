import express from 'express'
import { authenticateToken } from '../middleware/auth'
import { cursorPaginationSchema, CursorPaginationParams, PaginatedResponse } from '@matchmind/shared-types'
import { computeRoomLeaderboard } from '../services/leaderboardService'
import type { AuthenticatedRequest } from '../middleware/auth'
import logger from '../utils/logger'
import { openapiRegistry } from "../config/openapi";

const router = express.Router()

// GET /api/rooms/:roomId/leaderboard — per-room leaderboard from fantasyPointsLedger

openapiRegistry.registerPath({
  method: 'get',
  path: '/rooms/:roomId',
  responses: { 200: { description: 'Success' } }
})
router.get('/rooms/:roomId', async (req, res) => {
  // @ts-ignore
      const roomService = (req as any).container.resolve('roomService')
  // @ts-ignore
      const cacheService = (req as any).container.resolve('cacheService')
      const roomId = req.params.roomId as string

      const cacheKey = `leaderboard:room:${roomId}`
      const payload = await cacheService.getOrFetch(cacheKey, 300, async () => {
        const data = await roomService.getRoomLeaderboardData(roomId)
        if (!data) return { error: 'ROOM_NOT_FOUND' }

        const entries = computeRoomLeaderboard(data.ledger, roomId, data.rosters)

        return {
          roomId,
          tournamentId: data.tournamentId,
          entries,
          totalFixtures: data.ledger.length > 0 ? new Set(data.ledger.map((l: any) => l.fixtureId)).size : 0,
        }
      })

      if (payload.error === 'ROOM_NOT_FOUND') {
        return res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
      }

      res.json(payload)
    })

// GET /api/leaderboard/global — deprecated, redirects to a default tournament

openapiRegistry.registerPath({
  method: 'get',
  path: '/global',
  responses: { 200: { description: 'Success' } }
})
router.get('/global', async (req, res) => {
      res.json({ message: 'Use /api/rooms/:roomId/leaderboard for per-room leaderboards' })
    })

// DELETE /api/leaderboard/sport/:sport — removed (single-sport platform)

openapiRegistry.registerPath({
  method: 'get',
  path: '/sport/:sport',
  responses: { 200: { description: 'Success' } }
})
router.get('/sport/:sport', async (_req, res) => {
      res.json({ message: 'Single-sport platform. Use /api/rooms/:roomId/leaderboard' })
    })

// DELETE /api/leaderboard/weekly — removed (prediction streaks no longer exist)

openapiRegistry.registerPath({
  method: 'get',
  path: '/weekly',
  responses: { 200: { description: 'Success' } }
})
router.get('/weekly', async (_req, res) => {
      res.json({ message: 'Weekly ranking replaced by per-room fantasy leaderboard' })
    })

// DELETE /api/leaderboard/history/:period — removed (no more leaderboard snapshots from predictions)

openapiRegistry.registerPath({
  method: 'get',
  path: '/history/:period',
  responses: { 200: { description: 'Success' } }
})
router.get('/history/:period', async (_req, res) => {
      res.json({ message: 'History not available. Fantasy points accumulate by fixture.' })
    })

// DELETE /api/leaderboard/friends — simplified to show all users in a room

openapiRegistry.registerPath({
  method: 'get',
  path: '/friends',
  responses: { 200: { description: 'Success' } }
})
router.get('/friends', authenticateToken, async (req: AuthenticatedRequest, res) => {
      // For now, return empty. Future: show cross-room aggregate ranking
      res.json([])
    })

export default router
