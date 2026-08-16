import express from 'express'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth'
import { openapiRegistry } from '../config/openapi'
import type { ExtendedPrismaClient } from '../lib/prisma'

const router = express.Router()

/**
 * Apply captain/vice-captain flags to a roster. Resets the existing flags on
 * every roster entry first, then sets the target player's flag.
 */
async function applyCaptainRoles(
  prisma: ExtendedPrismaClient,
  roster: { id: string; playerId: string }[],
  playerId: string,
  isViceCaptain: boolean,
): Promise<void> {
  if (isViceCaptain) {
    for (const entry of roster) {
      await prisma.roster.update({ where: { id: entry.id }, data: { isViceCaptain: false } })
    }
    const entry = roster.find((r) => r.playerId === playerId)
    if (entry) {
      await prisma.roster.update({ where: { id: entry.id }, data: { isViceCaptain: true } })
    }
    return
  }
  // Captain — clear both flags on everyone, then set the new captain
  for (const entry of roster) {
    await prisma.roster.update({ where: { id: entry.id }, data: { isCaptain: false, isViceCaptain: false } })
  }
  const entry = roster.find((r) => r.playerId === playerId)
  if (entry) {
    await prisma.roster.update({ where: { id: entry.id }, data: { isCaptain: true } })
  }
}

// GET /api/rooms/:roomId/franchises/:userId — view roster (read-only for other users)

openapiRegistry.registerPath({
  method: 'get',
  path: '/:roomId/franchises/:userId',
  responses: { 200: { description: 'Success' } },
})
router.get('/:roomId/franchises/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const prisma = req.container.cradle.prisma
  const roomId = req.params.roomId as string
  const userId = req.params.userId as string

  const roster = await prisma.roster.findMany({
    where: { roomId, userId },
    include: { player: { select: { id: true, name: true, position: true, club: true, nationality: true } } },
    orderBy: [{ isCaptain: 'desc' }, { isViceCaptain: 'desc' }, { player: { name: 'asc' } }],
  })

  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  })

  res.json({
    userId,
    roster,
    remainingBudget: member?.remainingBudget ?? 0,
    rosterSize: roster.length,
  })
})

// PATCH /api/rooms/:roomId/franchises/me/captain — set captain and vice-captain (current user)

openapiRegistry.registerPath({
  method: 'patch',
  path: '/:roomId/franchises/me/captain',
  responses: { 200: { description: 'Success' } },
})
router.patch('/:roomId/franchises/me/captain', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const prisma = req.container.cradle.prisma
  const roomId = req.params.roomId as string
  const { playerId, isViceCaptain } = req.body as { playerId?: string; isViceCaptain?: boolean }

  if (!playerId) {
    return res.status(400).json({ error: { code: 'MISSING_PLAYER_ID', message: 'playerId is required' } })
  }

  // Verify the room is in DRAFTING or FINISHED state
  const room = await prisma.room.findUnique({ where: { id: roomId } })
  if (!room) {
    return res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
  }
  if (room.status === 'LOBBY' || room.status === 'PAUSED') {
    return res
      .status(400)
      .json({ error: { code: 'ROOM_NOT_ACTIVE', message: 'Cannot set captain while room is in lobby or paused' } })
  }

  // Verify the player is in user's roster
  const roster = await prisma.roster.findMany({
    where: { roomId, userId: req.userId },
  })
  const rosterPlayerIds = new Set(roster.map((r) => r.playerId))
  if (!rosterPlayerIds.has(playerId)) {
    return res.status(400).json({ error: { code: 'PLAYER_NOT_IN_ROSTER', message: 'Player must be in your roster' } })
  }

  await applyCaptainRoles(prisma, roster, playerId, isViceCaptain === true)

  // Return updated roster
  const updated = await prisma.roster.findMany({
    where: { roomId, userId: req.userId },
    include: { player: { select: { id: true, name: true, position: true } } },
  })

  return res.json(updated)
})

export default router
