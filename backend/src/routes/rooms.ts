import express from 'express'
import { authenticateToken } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { z } from 'zod'
import { isValidTournamentId, DEFAULT_ROSTER_RULES, MAX_FREE_ROOMS_PER_USER } from '../config/tournaments'
import type { AuthenticatedRequest } from '../middleware/auth'
import logger from '../utils/logger'
import { computeRoomLeaderboard } from '../services/leaderboardService'
import { createRoomLimiter, joinRoomLimiter } from '../middleware/rateLimiter'
import { idempotent } from '../middleware/idempotency'
import { openapiRegistry } from "../config/openapi";

const router = express.Router()

// ─── Zod Schemas ─────────────────────────────────────────

const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(100),
  tournamentId: z.string().refine(isValidTournamentId, { message: 'Invalid tournament ID' }),
  totalBudget: z.number().int().positive().default(500),
}).strict()

const joinRoomSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
}).strict()

// ─── Helper: Generate Invite Code ────────────────────────

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// ─── Routes ─────────────────────────────────────────────

// POST /api/rooms — create room (host, rate-limited, idempotent)

openapiRegistry.registerPath({
  method: 'post',
  path: '/',
  request: { body: { content: { 'application/json': { schema: createRoomSchema } } } },
  responses: { 200: { description: 'Success' } }
})
router.post('/', idempotent(), createRoomLimiter, authenticateToken, validate(createRoomSchema), async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const roomService = (req as any).container.resolve('roomService')
      const { name, tournamentId, totalBudget } = req.body as z.infer<typeof createRoomSchema>

      // Check free tier limit
      const activeRooms = await roomService.countActiveRoomsForUser(req.userId)
      if (activeRooms >= MAX_FREE_ROOMS_PER_USER) {
        return res.status(403).json({
          error: { code: 'ROOM_LIMIT_REACHED', message: `Free tier limited to ${MAX_FREE_ROOMS_PER_USER} active rooms. Upgrade to Pro for unlimited rooms.` },
        })
      }

      // Generate unique invite code
      let inviteCode = generateInviteCode()
      let existing = await roomService.findByInviteCode(inviteCode)
      while (existing) {
        inviteCode = generateInviteCode()
        existing = await roomService.findByInviteCode(inviteCode)
      }

      const room = await roomService.createRoomWithHostAndAuction(
        { name, tournamentId, totalBudget, inviteCode },
        req.userId
      )

      logger.info({ event: 'room.created', roomId: room.id, tournamentId, hostId: req.userId })
      res.status(201).json(room)
    })

// GET /api/rooms/mine — list user's rooms

openapiRegistry.registerPath({
  method: 'get',
  path: '/mine',
  responses: { 200: { description: 'Success' } }
})
router.get('/mine', authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const roomService = (req as any).container.resolve('roomService')
      const userRooms = await roomService.getUserRooms(req.userId)
      res.json(userRooms)
    })

// GET /api/rooms/:id — get single room with members and auction state

openapiRegistry.registerPath({
  method: 'get',
  path: '/:id',
  responses: { 200: { description: 'Success' } }
})
router.get('/:id', async (req, res) => {
  // @ts-ignore
      const roomService = (req as any).container.resolve('roomService')
      const room = await roomService.getRoomDetails(req.params.id)
      if (!room) {
        return res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
      }
      res.json(room)
    })

// GET /api/rooms/:id/members — list members with ready status

openapiRegistry.registerPath({
  method: 'get',
  path: '/:id/members',
  responses: { 200: { description: 'Success' } }
})
router.get('/:id/members', async (req, res) => {
  // @ts-ignore
      const roomService = (req as any).container.resolve('roomService')
      const data = await roomService.getRoomMembers(req.params.id)
      res.json(data)
    })

// POST /api/rooms/:id/join — join room via invite code

openapiRegistry.registerPath({
  method: 'post',
  path: '/:id/join',
  request: { body: { content: { 'application/json': { schema: joinRoomSchema } } } },
  responses: { 200: { description: 'Success' } }
})
router.post('/:id/join', joinRoomLimiter, authenticateToken, validate(joinRoomSchema), async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const roomService = (req as any).container.resolve('roomService')
      const roomId = req.params.id as string
      const { inviteCode } = req.body as z.infer<typeof joinRoomSchema>

      const room = await roomService.getRoomById(roomId)
      if (!room) {
        return res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
      }
      if (room.inviteCode !== inviteCode) {
        return res.status(403).json({ error: { code: 'INVALID_INVITE_CODE', message: 'Invalid invite code' } })
      }
      if (room.status !== 'LOBBY') {
        return res.status(400).json({ error: { code: 'ROOM_NOT_LOBBY', message: 'Room is no longer accepting members' } })
      }

      // Check if already a member
      const existing = await roomService.getMember(roomId, req.userId)
      if (existing) {
        return res.status(409).json({ error: { code: 'ALREADY_MEMBER', message: 'Already a member of this room' } })
      }

      const member = await roomService.joinRoom(roomId, req.userId, room.totalBudget)

      // Emit join event
      const io = req.app.get('io')
      if (io) {
        const fullMember = await roomService.getFullMember(roomId, req.userId)
        io.to(`room:${room.id}`).emit('MEMBER_JOINED', { roomId: room.id, member: fullMember })
      }

      logger.info({ event: 'room.joined', roomId: room.id, userId: req.userId })
      res.status(201).json(member)
    })

// PATCH /api/rooms/:id/ready — toggle ready status in lobby

openapiRegistry.registerPath({
  method: 'patch',
  path: '/:id/ready',
  responses: { 200: { description: 'Success' } }
})
router.patch('/:id/ready', authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const roomService = (req as any).container.resolve('roomService')
      const roomId = req.params.id as string

      const member = await roomService.getMember(roomId, req.userId)
      if (!member) {
        return res.status(404).json({ error: { code: 'NOT_MEMBER', message: 'You are not a member of this room' } })
      }

      const room = await roomService.getRoomById(roomId)
      if (!room || room.status !== 'LOBBY') {
        return res.status(400).json({ error: { code: 'ROOM_NOT_LOBBY', message: 'Room is not in lobby state' } })
      }

      const updated = await roomService.toggleMemberReady(roomId, req.userId, member.isReady)

      // Emit ready status change to room
      const io = req.app.get('io')
      if (io) {
        io.to(`room:${roomId}`).emit('MEMBER_READY_CHANGED', {
          roomId,
          userId: req.userId,
          isReady: updated.isReady,
          member: updated,
        })
      }

      res.json({ isReady: updated.isReady, member: updated })
    })

// POST /api/rooms/:id/regenerate-invite — host regenerates invite code

openapiRegistry.registerPath({
  method: 'post',
  path: '/:id/regenerate-invite',
  responses: { 200: { description: 'Success' } }
})
router.post('/:id/regenerate-invite', authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const roomService = (req as any).container.resolve('roomService')
      const roomId = req.params.id as string

      const room = await roomService.getRoomById(roomId)
      if (!room) {
        return res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
      }
      if (room.hostId !== req.userId) {
        return res.status(403).json({ error: { code: 'NOT_HOST', message: 'Only the host can regenerate the invite code' } })
      }

      // Generate unique invite code
      let inviteCode = generateInviteCode()
      let existing = await roomService.findByInviteCode(inviteCode)
      while (existing) {
        inviteCode = generateInviteCode()
        existing = await roomService.findByInviteCode(inviteCode)
      }

      await roomService.updateInviteCode(room.id, inviteCode)

      logger.info({ event: 'room.invite_regenerated', roomId: room.id })
      res.json({ inviteCode })
    })

// GET /api/rooms/:id/leaderboard — per-room fantasy leaderboard (derived view)

openapiRegistry.registerPath({
  method: 'get',
  path: '/:id/leaderboard',
  responses: { 200: { description: 'Success' } }
})
router.get('/:id/leaderboard', async (req, res) => {
  // @ts-ignore
      const roomService = (req as any).container.resolve('roomService')
      const roomId = req.params.id as string

      const data = await roomService.getRoomLeaderboardData(roomId)
      if (!data) {
        return res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
      }

      // Compute the leaderboard as a derived view
      const entries = computeRoomLeaderboard(data.ledger, roomId, data.rosters)

      res.json({
        roomId,
        tournamentId: data.tournamentId,
        entries,
        totalFixtures: data.ledger.length > 0
          ? new Set(data.ledger.map((l: any) => l.fixtureId)).size
          : 0,
      })
    })

export default router
