/**
 * Player Routes — MatchMind
 *
 * Football-specific players scoped to tournamentId.
 * Removed multi-sport sport filter from MatchMind.
 */

import express from 'express'
import { openapiRegistry } from '../config/openapi'
import { z } from 'zod'
import { cursorPaginationSchema, CursorPaginationParams, PaginatedResponse } from '@matchmind/shared-types'
import { DomainError } from '../errors/DomainError'
import logger from '../utils/logger'

const router = express.Router()

// GET /api/players — list players for a tournament (football only)

openapiRegistry.registerPath({
  method: 'get',
  path: '/',
  responses: { 200: { description: 'Success' } },
})
router.get('/', async (req, res) => {
  const prisma = req.container.cradle.prisma
  const cacheService = req.container.cradle.cacheService
  // safeParse (audit 9.2): malformed query → 400 VALIDATION_ERROR, not a 500.
  const validated = cursorPaginationSchema.extend({ tournamentId: z.string().optional() }).safeParse(req.query)
  if (!validated.success) {
    throw new DomainError(
      `Invalid query parameters: ${validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      'VALIDATION_ERROR',
      400,
    )
  }
  const { tournamentId, cursor, take } = validated.data

  const cacheKey = `players:list:${tournamentId || 'all'}:cursor:${cursor || 'none'}:take:${take}`

  const result = await cacheService.getOrFetch(cacheKey, 86400, async () => {
    const where: { tournamentId?: string } = {}
    if (tournamentId) {
      where.tournamentId = tournamentId
    }

    const players = await prisma.player.findMany({
      where,
      orderBy: { name: 'asc' },
      take: take + 1, // fetch one extra to determine hasMore
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = players.length > take
    const data = hasMore ? players.slice(0, -1) : players
    const nextCursor = hasMore ? data[data.length - 1]!.id : undefined

    return { data, hasMore, nextCursor }
  })

  res.json(result)
})

// GET /api/players/:id — player details

openapiRegistry.registerPath({
  method: 'get',
  path: '/:id',
  responses: { 200: { description: 'Success' } },
})
router.get('/:id', async (req, res) => {
  const prisma = req.container.cradle.prisma
  const cacheService = req.container.cradle.cacheService
  const { id } = req.params

  const cacheKey = `players:detail:${id}`

  const player = await cacheService.getOrFetch(cacheKey, 86400, async () => {
    return prisma.player.findUnique({ where: { id } })
  })

  if (!player) {
    return res.status(404).json({ error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found' } })
  }

  return res.json(player)
})

export default router
