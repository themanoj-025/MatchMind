/**
 * Match Routes — MatchMind (Replacement)
 *
 * MatchMind's old multi-sport match/prediction system is removed.
 * Auctions use the fixture-based system (routes/fixtures.ts).
 * This file provides backward-compatible redirects.
 */

import express from 'express'
import { openapiRegistry } from "../config/openapi";

const router = express.Router()

// GET /api/matches — redirect to fixtures

openapiRegistry.registerPath({
  method: 'get',
  path: '/',
  responses: { 200: { description: 'Success' } }
})
router.get('/', async (req, res) => {
  // @ts-ignore
      const matchService = (req as any).container.resolve('matchService')
      const fixtures = await matchService.getMatches()
      res.json(fixtures)
    })

// GET /api/matches/:id — redirect to fixture by ID

openapiRegistry.registerPath({
  method: 'get',
  path: '/:id',
  responses: { 200: { description: 'Success' } }
})
router.get('/:id', async (req, res) => {
  // @ts-ignore
      const matchService = (req as any).container.resolve('matchService')
      const fixture = await matchService.getMatchById(req.params.id)
      if (!fixture) {
        return res.status(404).json({ error: { code: 'FIXTURE_NOT_FOUND', message: 'Fixture not found' } })
      }
      res.json(fixture)
    })

export default router
