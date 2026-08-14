/**
 * Auction Routes — MatchMind
 *
 * Host controls (start, next-player, pause, force-sold/unsold, re-auction)
 * and bid placement. All bid logic delegates to auctionEngine.ts.
 *
 * Real-time bid processing happens via WebSocket (PLACE_BID event in socket/index.ts),
 * but REST endpoints are provided for host actions.
 */

import express from 'express'
import { authenticateToken } from '../middleware/auth'
import {
  processBid,
  sellCurrentPlayer,
  unsoldCurrentPlayer,
  moveToNextPlayer,
  startReAuction,
} from '../services/auctionEngine'
import type { AuthenticatedRequest } from '../middleware/auth'
import type { AuctionState } from '../services/auctionEngine'
import logger from '../utils/logger'
import { auctionActionLimiter } from '../middleware/rateLimiter'
import { openapiRegistry } from '../config/openapi'
import { scheduleAuctionTimer } from '../lib/queue'
import { ConcurrencyError } from '../errors/DomainError'
import { redis } from '../lib/redis'

const router = express.Router()

// ─── Helper to load/save auction state ───────────────────

function makeAuctionHelpers(prisma: any) {
  return {
    getAuctionState: async (roomId: string) => {
      const state = await prisma.auctionState.findUnique({ where: { roomId } })
      return state as AuctionState | null
    },
    saveAuctionState: async (roomId: string, state: AuctionState) => {
      const expectedVersion = state.version - 1
      const result = await prisma.auctionState.updateMany({
        where: { roomId, version: expectedVersion },
        data: { ...state },
      })
      if (result.count === 0) {
        throw new ConcurrencyError()
      }
    },
  }
}

// ─── Auction State ────────────────────────────────────

// GET /api/rooms/:roomId/auction/state — get current auction state

openapiRegistry.registerPath({
  method: 'get',
  path: '/:roomId/state',
  responses: { 200: { description: 'Success' } },
})
router.get('/:roomId/state', authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
  const prisma = (req as any).container.resolve('prisma')
  const state = await prisma.auctionState.findUnique({ where: { roomId: req.params.roomId as string } })
  if (!state) {
    return res.status(404).json({ error: { code: 'STATE_NOT_FOUND', message: 'Auction state not found' } })
  }
  res.json(state)
})

// ─── Host Controls ──────────────────────────────────────

// POST /api/rooms/:roomId/auction/start — host starts auction

openapiRegistry.registerPath({
  method: 'post',
  path: '/:roomId/start',
  responses: { 200: { description: 'Success' } },
})
router.post('/:roomId/start', auctionActionLimiter, authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
  const prisma = (req as any).container.resolve('prisma')

  const room = await prisma.room.findUnique({ where: { id: req.params.roomId as string } })
  if (!room) {
    return res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
  }
  if (room.hostId !== req.userId) {
    return res.status(403).json({ error: { code: 'NOT_HOST', message: 'Only the host can start the auction' } })
  }
  if (room.status !== 'LOBBY') {
    return res.status(400).json({ error: { code: 'WRONG_STATE', message: `Room is ${room.status}, must be LOBBY` } })
  }

  // Load all players for this tournament and shuffle into queue
  const players = await prisma.player.findMany({
    where: { tournamentId: room.tournamentId },
  })
  const shuffled = players.map((p: any) => p.id).sort(() => Math.random() - 0.5)

  // Update room status
  await prisma.room.update({
    where: { id: room.id },
    data: { status: 'DRAFTING' },
  })

  // Initialize auction state
  const timerEndsAt = new Date(Date.now() + 15000).toISOString()
  const state = await prisma.auctionState.update({
    where: { roomId: room.id },
    data: {
      phase: 'PLAYER_LIVE',
      currentPlayerId: shuffled[0] || null,
      currentBid: 0,
      currentBidderId: null,
      timerEndsAt,
      version: 1,
    },
  })

  // Populate Redis queue
  await redis.del(`auction:${room.id}:pool`)
  await redis.del(`auction:${room.id}:unsold`)
  const poolQueue = shuffled.slice(1)
  if (poolQueue.length > 0) {
    await redis.rpush(`auction:${room.id}:pool`, ...poolQueue)
  }

  // Emit socket event
  const io = req.app.get('io')
  if (io) {
    io.to(`room:${room.id}`).emit('AUCTION_STARTED', { roomId: room.id, state })
  }

  if (timerEndsAt) {
    await scheduleAuctionTimer(room.id, timerEndsAt)
  }

  logger.info({ event: 'auction.started', roomId: room.id })
  res.json({ message: 'Auction started', state })
})

// POST /api/rooms/:roomId/auction/next-player

openapiRegistry.registerPath({
  method: 'post',
  path: '/:roomId/next-player',
  responses: { 200: { description: 'Success' } },
})
router.post('/:roomId/next-player', auctionActionLimiter, authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
  const prisma = (req as any).container.resolve('prisma')
  const room = await prisma.room.findUnique({ where: { id: req.params.roomId as string } })
  if (!room) {
    return res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
  }
  if (room.hostId !== req.userId) {
    return res.status(403).json({ error: { code: 'NOT_HOST', message: 'Only the host can advance' } })
  }

  const helpers = makeAuctionHelpers(prisma)
  const newState = await moveToNextPlayer(
    req.params.roomId as string,
    helpers.getAuctionState,
    helpers.saveAuctionState,
  )

  if (!newState) {
    return res.status(400).json({ error: { code: 'AUCTION_ERROR', message: 'Failed to move to next player' } })
  }

  const io = req.app.get('io')
  if (io) {
    io.to(`room:${room.id}`).emit('AUCTION_PHASE_CHANGE', { roomId: room.id, state: newState })
  }

  if (newState.phase === 'PLAYER_LIVE' && newState.timerEndsAt) {
    await scheduleAuctionTimer(room.id, newState.timerEndsAt)
  }

  res.json({ state: newState })
})

// POST /api/rooms/:roomId/auction/force-sold

openapiRegistry.registerPath({
  method: 'post',
  path: '/:roomId/force-sold',
  responses: { 200: { description: 'Success' } },
})
router.post('/:roomId/force-sold', auctionActionLimiter, authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
  const prisma = (req as any).container.resolve('prisma')
  const room = await prisma.room.findUnique({ where: { id: req.params.roomId as string } })
  if (!room) {
    return res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
  }
  if (room.hostId !== req.userId) {
    return res.status(403).json({ error: { code: 'NOT_HOST', message: 'Only the host can force-sell' } })
  }

  const helpers = makeAuctionHelpers(prisma)
  const state = await helpers.getAuctionState(req.params.roomId as string)
  if (!state || state.phase !== 'PLAYER_LIVE') {
    return res.status(400).json({ error: { code: 'WRONG_STATE', message: 'No player currently live' } })
  }

  // Deduct budget from buyer
  if (state.currentBidderId && state.currentPlayerId) {
    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: room.id, userId: state.currentBidderId } },
    })
    if (member) {
      await prisma.roomMember.update({
        where: { roomId_userId: { roomId: room.id, userId: state.currentBidderId } },
        data: { remainingBudget: member.remainingBudget - state.currentBid },
      })
    }

    // Create roster entry
    await prisma.roster.create({
      data: {
        roomId: room.id,
        userId: state.currentBidderId,
        playerId: state.currentPlayerId,
        soldPrice: state.currentBid,
        acquiredAt: new Date().toISOString(),
        isCaptain: false,
        isViceCaptain: false,
      },
    })
  }

  await sellCurrentPlayer(req.params.roomId as string, helpers.getAuctionState, helpers.saveAuctionState)

  const io = req.app.get('io')
  if (io) {
    io.to(`room:${room.id}`).emit('PLAYER_SOLD', {
      roomId: room.id,
      playerId: state.currentPlayerId,
      buyerId: state.currentBidderId,
      price: state.currentBid,
    })
  }

  res.json({ message: 'Player sold' })
})

// POST /api/rooms/:roomId/auction/force-unsold

openapiRegistry.registerPath({
  method: 'post',
  path: '/:roomId/force-unsold',
  responses: { 200: { description: 'Success' } },
})
router.post(
  '/:roomId/force-unsold',
  auctionActionLimiter,
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    // @ts-ignore
    const prisma = (req as any).container.resolve('prisma')
    const room = await prisma.room.findUnique({ where: { id: req.params.roomId as string } })
    if (!room) {
      return res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
    }
    if (room.hostId !== req.userId) {
      return res.status(403).json({ error: { code: 'NOT_HOST', message: 'Only the host can force-unsold' } })
    }

    const helpers = makeAuctionHelpers(prisma)
    const newState = await unsoldCurrentPlayer(
      req.params.roomId as string,
      helpers.getAuctionState,
      helpers.saveAuctionState,
    )

    if (!newState) {
      return res.status(400).json({ error: { code: 'AUCTION_ERROR', message: 'Failed to mark unsold' } })
    }

    const io = req.app.get('io')
    if (io) {
      io.to(`room:${room.id}`).emit('PLAYER_UNSOLD', { roomId: room.id })
    }

    res.json({ message: 'Player marked unsold', state: newState })
  },
)

// POST /api/rooms/:roomId/auction/re-auction

openapiRegistry.registerPath({
  method: 'post',
  path: '/:roomId/re-auction',
  responses: { 200: { description: 'Success' } },
})
router.post('/:roomId/re-auction', auctionActionLimiter, authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
  const prisma = (req as any).container.resolve('prisma')
  const room = await prisma.room.findUnique({ where: { id: req.params.roomId as string } })
  if (!room) {
    return res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
  }
  if (room.hostId !== req.userId) {
    return res.status(403).json({ error: { code: 'NOT_HOST', message: 'Only the host can start re-auction' } })
  }

  const helpers = makeAuctionHelpers(prisma)
  const state = await helpers.getAuctionState(req.params.roomId as string)
  if (!state || state.phase !== 'RE_AUCTION') {
    return res.status(400).json({ error: { code: 'WRONG_STATE', message: 'Not in re-auction phase' } })
  }

  const newState = await startReAuction(req.params.roomId as string, helpers.getAuctionState, helpers.saveAuctionState)

  if (!newState) {
    return res.status(400).json({ error: { code: 'AUCTION_ERROR', message: 'Failed to start re-auction' } })
  }

  const io = req.app.get('io')
  if (io) {
    io.to(`room:${room.id}`).emit('RE_AUCTION_STARTED', { roomId: room.id, state: newState })
  }

  if (newState.phase === 'PLAYER_LIVE' && newState.timerEndsAt) {
    await scheduleAuctionTimer(room.id, newState.timerEndsAt)
  }

  res.json({ message: 'Re-auction started', state: newState })
})

// POST /api/rooms/:roomId/auction/pause — host pauses auction

openapiRegistry.registerPath({
  method: 'post',
  path: '/:roomId/pause',
  responses: { 200: { description: 'Success' } },
})
router.post('/:roomId/pause', auctionActionLimiter, authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
  const prisma = (req as any).container.resolve('prisma')
  const room = await prisma.room.findUnique({ where: { id: req.params.roomId as string } })
  if (!room) {
    return res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
  }
  if (room.hostId !== req.userId) {
    return res.status(403).json({ error: { code: 'NOT_HOST', message: 'Only the host can pause the auction' } })
  }
  if (room.status !== 'DRAFTING') {
    return res.status(400).json({ error: { code: 'WRONG_STATE', message: 'Auction is not in DRAFTING state' } })
  }

  await prisma.room.update({
    where: { id: room.id },
    data: { status: 'PAUSED' },
  })

  const io = req.app.get('io')
  if (io) {
    io.to(`room:${room.id}`).emit('AUCTION_PAUSED', { roomId: room.id })
  }

  logger.info({ event: 'auction.paused', roomId: room.id })
  res.json({ message: 'Auction paused' })
})

// POST /api/rooms/:roomId/auction/resume — host resumes auction

openapiRegistry.registerPath({
  method: 'post',
  path: '/:roomId/resume',
  responses: { 200: { description: 'Success' } },
})
router.post('/:roomId/resume', auctionActionLimiter, authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
  const prisma = (req as any).container.resolve('prisma')
  const room = await prisma.room.findUnique({ where: { id: req.params.roomId as string } })
  if (!room) {
    return res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
  }
  if (room.hostId !== req.userId) {
    return res.status(403).json({ error: { code: 'NOT_HOST', message: 'Only the host can resume the auction' } })
  }
  if (room.status !== 'PAUSED') {
    return res.status(400).json({ error: { code: 'WRONG_STATE', message: 'Auction is not in PAUSED state' } })
  }

  await prisma.room.update({
    where: { id: room.id },
    data: { status: 'DRAFTING' },
  })

  const io = req.app.get('io')
  if (io) {
    io.to(`room:${room.id}`).emit('AUCTION_RESUMED', { roomId: room.id })
  }

  logger.info({ event: 'auction.resumed', roomId: room.id })
  res.json({ message: 'Auction resumed' })
})

// POST /api/rooms/:roomId/auction/end

openapiRegistry.registerPath({
  method: 'post',
  path: '/:roomId/end',
  responses: { 200: { description: 'Success' } },
})
router.post('/:roomId/end', auctionActionLimiter, authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
  const prisma = (req as any).container.resolve('prisma')
  const room = await prisma.room.findUnique({ where: { id: req.params.roomId as string } })
  if (!room) {
    return res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
  }
  if (room.hostId !== req.userId) {
    return res.status(403).json({ error: { code: 'NOT_HOST', message: 'Only the host can end the auction' } })
  }

  await prisma.room.update({
    where: { id: room.id },
    data: { status: 'FINISHED' },
  })

  await prisma.auctionState.update({
    where: { roomId: room.id },
    data: { phase: 'FINISHED' },
  })

  const io = req.app.get('io')
  if (io) {
    io.to(`room:${room.id}`).emit('AUCTION_FINISHED', { roomId: room.id })
  }

  logger.info({ event: 'auction.ended', roomId: room.id })
  res.json({ message: 'Auction ended' })
})

export default router
