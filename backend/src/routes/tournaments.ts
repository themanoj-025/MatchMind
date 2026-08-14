import express from 'express'
import { getTournament, listLive, listAnnounced, listVisible } from '../config/tournaments'
import { openapiRegistry } from "../config/openapi";

const router = express.Router()

// GET /api/tournaments — returns LIVE + ANNOUNCED tournaments (visible to end users)

openapiRegistry.registerPath({
  method: 'get',
  path: '/',
  responses: { 200: { description: 'Success' } }
})
router.get('/', async (_req, res) => {
      const tournaments = listVisible()
      res.json(tournaments)
    })

// GET /api/tournaments/live — returns only LIVE tournaments (for room creation, etc.)

openapiRegistry.registerPath({
  method: 'get',
  path: '/live',
  responses: { 200: { description: 'Success' } }
})
router.get('/live', async (_req, res) => {
      res.json(listLive())
    })

// GET /api/tournaments/announced — returns only ANNOUNCED tournaments (coming soon)

openapiRegistry.registerPath({
  method: 'get',
  path: '/announced',
  responses: { 200: { description: 'Success' } }
})
router.get('/announced', async (_req, res) => {
      res.json(listAnnounced())
    })

// GET /api/tournaments/:id — returns a single tournament or 404

openapiRegistry.registerPath({
  method: 'get',
  path: '/:id',
  responses: { 200: { description: 'Success' } }
})
router.get('/:id', async (req, res) => {
      const tournament = getTournament(req.params.id as string)
      if (!tournament) {
        return res.status(404).json({ error: { code: 'TOURNAMENT_NOT_FOUND', message: 'Tournament not found' } })
      }
      if (tournament.status === 'ANNOUNCED_NOT_CONFIRMED') {
        return res.status(404).json({ error: { code: 'TOURNAMENT_NOT_FOUND', message: 'Tournament not found' } })
      }
      res.json(tournament)
    })

export default router
