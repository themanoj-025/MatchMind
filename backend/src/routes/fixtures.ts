import express from 'express'
import { authenticateToken } from '../middleware/auth'
import { requireAdmin } from '../middleware/requireAdmin'
import { computeFantasyPoints } from '../services/fantasyPoints'
import type { AuthenticatedRequest } from '../middleware/auth'
import logger from '../utils/logger'
import { openapiRegistry } from "../config/openapi";

const router = express.Router()

// GET /api/fixtures — list fixtures for a tournament

openapiRegistry.registerPath({
  method: 'get',
  path: '/',
  responses: { 200: { description: 'Success' } }
})
router.get('/', async (req, res) => {
  // @ts-ignore
      const matchService = (req as any).container.resolve('matchService')
      const { tournamentId } = req.query as { tournamentId?: string }

      const fixtures = await matchService.getFixtures(tournamentId)
      res.json(fixtures)
    })

// GET /api/fixtures/:id — single fixture with player stats

openapiRegistry.registerPath({
  method: 'get',
  path: '/:id',
  responses: { 200: { description: 'Success' } }
})
router.get('/:id', async (req, res) => {
  // @ts-ignore
      const matchService = (req as any).container.resolve('matchService')
      const fixture = await matchService.getFixtureDetails(req.params.id)
      if (!fixture) {
        return res.status(404).json({ error: { code: 'FIXTURE_NOT_FOUND', message: 'Fixture not found' } })
      }
      res.json(fixture)
    })

// POST /api/admin/fixtures — create fixture (admin only)

openapiRegistry.registerPath({
  method: 'post',
  path: '/',
  responses: { 200: { description: 'Success' } }
})
router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const matchService = (req as any).container.resolve('matchService')
      const fixture = await matchService.createFixture(req.body)
      res.status(201).json(fixture)
    })

// POST /api/admin/fixtures/:id/player-stats — enter player match stats (admin)

openapiRegistry.registerPath({
  method: 'post',
  path: '/:id/player-stats',
  responses: { 200: { description: 'Success' } }
})
router.post('/:id/player-stats', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const matchService = (req as any).container.resolve('matchService')
      const { playerStats } = req.body as {
        playerStats: Array<{
          playerId: string
          minutesPlayed: number
          goals: number
          assists: number
          cleanSheet: boolean
          saves: number
          penaltiesSaved: number
          yellowCards: number
          redCards: number
          penaltiesMissed: number
          ownGoals: number
          goalsConceded: number
        }>
      }

      const created = await matchService.enterPlayerStats(req.params.id, playerStats)

      logger.info({ event: 'admin.player_stats_entered', fixtureId: req.params.id, count: created.length })
      res.status(201).json(created)
    })

// POST /api/admin/fixtures/:id/finalize — lock stats, compute fantasy points, update leaderboards (admin)

openapiRegistry.registerPath({
  method: 'post',
  path: '/:id/finalize',
  responses: { 200: { description: 'Success' } }
})
router.post('/:id/finalize', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const matchService = (req as any).container.resolve('matchService')
      const io = req.app.get('io')

      const { roomsProcessed, fantasyEntries } = await matchService.finalizeFixture(
        req.params.id,
        req.userId,
        io
      )

      res.json({ message: 'Fixture finalized', roomsProcessed, fantasyEntries })
    })

export default router
