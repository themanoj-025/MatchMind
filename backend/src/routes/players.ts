/**
 * Player Routes — MatchMind
 *
 * Football-specific players scoped to tournamentId.
 * Removed multi-sport sport filter from MatchMind.
 */

import express from 'express'
import { openapiRegistry } from "../config/openapi";
import { z } from 'zod'
import { cursorPaginationSchema, CursorPaginationParams, PaginatedResponse } from '@matchmind/shared-types'
import logger from '../utils/logger'

const router = express.Router()

// GET /api/players — list players for a tournament (football only)

openapiRegistry.registerPath({
  method: 'get',
  path: '/',
  responses: { 200: { description: 'Success' } }
})
router.get('/', async (req, res) => {
  // @ts-ignore
      const prisma = (req as any).container.resolve('prisma')
  // @ts-ignore
      const cacheService = (req as any).container.resolve('cacheService')
      const { tournamentId, cursor, take } = cursorPaginationSchema.extend({ tournamentId: z.string().optional() }).parse(req.query)

      const cacheKey = `players:list:${tournamentId || 'all'}:cursor:${cursor || 'none'}:take:${take}`
      
      const result = await cacheService.getOrFetch(cacheKey, 86400, async () => {
        const where: Record<string, any> = {}
        if (tournamentId) where.tournamentId = tournamentId

        const players = await prisma.player.findMany({
          where,
          orderBy: { name: 'asc' },
          take: take + 1, // fetch one extra to determine hasMore
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        })

        const hasMore = players.length > take
        const data = hasMore ? players.slice(0, -1) : players
        const nextCursor = hasMore ? data[data.length - 1].id : undefined

        return { data, hasMore, nextCursor }
      })

      res.json(result)
    })

// GET /api/players/:id — player details

openapiRegistry.registerPath({
  method: 'get',
  path: '/:id',
  responses: { 200: { description: 'Success' } }
})
router.get('/:id', async (req, res) => {
  // @ts-ignore
      const prisma = (req as any).container.resolve('prisma')
  // @ts-ignore
      const cacheService = (req as any).container.resolve('cacheService')
      const { id } = req.params

      const cacheKey = `players:detail:${id}`

      const player = await cacheService.getOrFetch(cacheKey, 86400, async () => {
        return prisma.player.findUnique({ where: { id } })
      })

      if (!player) {
        return res.status(404).json({ error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found' } })
      }

      res.json(player)
    })

export default router
