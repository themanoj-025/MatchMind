/**
 * RoomService Tests — MatchMind
 *
 * Tests RoomService:
 * - countActiveRoomsForUser: counts non-finished rooms
 * - findByInviteCode: finds room by invite code
 * - createRoomWithHostAndAuction: creates room + host member + auction state
 * - getUserRooms: returns rooms with membership
 * - getRoomDetails: returns room with members and auction state
 * - getRoomMembers: returns members with room status
 * - joinRoom: adds member to room
 * - toggleMemberReady: toggles ready state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RoomService } from './roomService'

function createMockPrisma() {
  return {
    room: {
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'room-1', name: 'Test Room' }),
      update: vi.fn().mockResolvedValue({}),
    },
    roomMember: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    auctionState: {
      create: vi.fn().mockResolvedValue({}),
    },
    fantasyPointsLedger: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    roster: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  }
}

describe('RoomService', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let service: RoomService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = createMockPrisma()
    service = new RoomService({ prisma: prisma as never })
  })

  describe('countActiveRoomsForUser', () => {
    it('returns count of active rooms', async () => {
      prisma.room.count = vi.fn().mockResolvedValue(2)

      const count = await service.countActiveRoomsForUser('user-1')

      expect(count).toBe(2)
      expect(prisma.room.count).toHaveBeenCalledWith({
        where: { hostId: 'user-1', status: { not: 'FINISHED' } },
      })
    })
  })

  describe('findByInviteCode', () => {
    it('returns room when found', async () => {
      const mockRoom = { id: 'room-1', inviteCode: 'ABC123' }
      prisma.room.findUnique = vi.fn().mockResolvedValue(mockRoom)

      const result = await service.findByInviteCode('ABC123')

      expect(result).toEqual(mockRoom)
      expect(prisma.room.findUnique).toHaveBeenCalledWith({
        where: { inviteCode: 'ABC123' },
      })
    })

    it('returns null when not found', async () => {
      prisma.room.findUnique = vi.fn().mockResolvedValue(null)

      const result = await service.findByInviteCode('INVALID')

      expect(result).toBeNull()
    })
  })

  describe('createRoomWithHostAndAuction', () => {
    it('creates room, host member, and auction state', async () => {
      const mockRoom = { id: 'room-1', name: 'Test Room' }
      prisma.room.create = vi.fn().mockResolvedValue(mockRoom)

      const result = await service.createRoomWithHostAndAuction(
        { name: 'Test Room', tournamentId: 't1', totalBudget: 1000, inviteCode: 'ABC' },
        'host-1',
      )

      expect(result).toEqual(mockRoom)
      expect(prisma.room.create).toHaveBeenCalledWith({
        data: {
          tournamentId: 't1',
          hostId: 'host-1',
          name: 'Test Room',
          inviteCode: 'ABC',
          totalBudget: 1000,
          status: 'LOBBY',
        },
      })
      expect(prisma.roomMember.create).toHaveBeenCalledWith({
        data: {
          roomId: 'room-1',
          userId: 'host-1',
          role: 'host',
          remainingBudget: 1000,
          isReady: true,
        },
      })
      expect(prisma.auctionState.create).toHaveBeenCalledWith({
        data: {
          roomId: 'room-1',
          phase: 'IDLE',
          currentPlayerId: null,
          currentBid: 0,
          currentBidderId: null,
          timerEndsAt: null,
          version: 1,
        },
      })
    })
  })

  describe('getUserRooms', () => {
    it('returns rooms with membership data', async () => {
      prisma.roomMember.findMany = vi.fn().mockResolvedValue([
        {
          room: { id: 'room-1', name: 'Room 1' },
          role: 'host',
          remainingBudget: 500,
          isReady: true,
        },
      ])

      const result = await service.getUserRooms('user-1')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'room-1',
        name: 'Room 1',
        membership: { role: 'host', remainingBudget: 500, isReady: true },
      })
    })

    it('returns empty array when no rooms', async () => {
      prisma.roomMember.findMany = vi.fn().mockResolvedValue([])

      const result = await service.getUserRooms('user-1')

      expect(result).toEqual([])
    })
  })

  describe('getRoomDetails', () => {
    it('returns room with members and auction state', async () => {
      const mockRoom = {
        id: 'room-1',
        members: [{ userId: 'user-1', user: { id: 'user-1', username: 'test' } }],
        auctionState: { phase: 'IDLE' },
      }
      prisma.room.findUnique = vi.fn().mockResolvedValue(mockRoom)

      const result = await service.getRoomDetails('room-1')

      expect(result).toEqual(mockRoom)
    })
  })

  describe('getRoomMembers', () => {
    it('returns members with room status', async () => {
      prisma.roomMember.findMany = vi.fn().mockResolvedValue([
        { userId: 'user-1', isReady: true, user: { id: 'user-1', username: 'test' } },
      ])
      prisma.room.findUnique = vi.fn().mockResolvedValue({ status: 'LOBBY', hostId: 'user-1' })

      const result = await service.getRoomMembers('room-1')

      expect(result.members).toHaveLength(1)
      expect(result.roomStatus).toBe('LOBBY')
      expect(result.allReady).toBe(true)
    })

    it('returns allReady false when not all members ready', async () => {
      prisma.roomMember.findMany = vi.fn().mockResolvedValue([
        { userId: 'user-1', isReady: true, user: {} },
        { userId: 'user-2', isReady: false, user: {} },
      ])
      prisma.room.findUnique = vi.fn().mockResolvedValue({ status: 'LOBBY', hostId: 'user-1' })

      const result = await service.getRoomMembers('room-1')

      expect(result.allReady).toBe(false)
    })
  })

  describe('joinRoom', () => {
    it('adds member to room', async () => {
      prisma.roomMember.create = vi.fn().mockResolvedValue({})

      await service.joinRoom('room-1', 'user-2', 1000)

      expect(prisma.roomMember.create).toHaveBeenCalledWith({
        data: {
          roomId: 'room-1',
          userId: 'user-2',
          role: 'member',
          remainingBudget: 1000,
          isReady: false,
        },
      })
    })
  })

  describe('toggleMemberReady', () => {
    it('toggles ready state from true to false', async () => {
      prisma.roomMember.update = vi.fn().mockResolvedValue({
        isReady: false,
        user: { id: 'user-1', username: 'test' },
      })

      const result = await service.toggleMemberReady('room-1', 'user-1', true)

      expect(prisma.roomMember.update).toHaveBeenCalledWith({
        where: { roomId_userId: { roomId: 'room-1', userId: 'user-1' } },
        data: { isReady: false },
        include: {
          user: { select: { id: true, username: true, displayName: true, avatar: true } },
        },
      })
    })

    it('toggles ready state from false to true', async () => {
      prisma.roomMember.update = vi.fn().mockResolvedValue({
        isReady: true,
        user: { id: 'user-1', username: 'test' },
      })

      await service.toggleMemberReady('room-1', 'user-1', false)

      expect(prisma.roomMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isReady: true } }),
      )
    })
  })

  describe('getRoomLeaderboardData', () => {
    it('returns null when room not found', async () => {
      prisma.room.findUnique = vi.fn().mockResolvedValue(null)

      const result = await service.getRoomLeaderboardData('nonexistent')

      expect(result).toBeNull()
    })

    it('returns ledger and rosters when room found', async () => {
      prisma.room.findUnique = vi.fn().mockResolvedValue({
        id: 'room-1',
        tournamentId: 't1',
      })
      prisma.fantasyPointsLedger.findMany = vi.fn().mockResolvedValue([
        { userId: 'user-1', totalPoints: 100 },
      ])
      prisma.roster.findMany = vi.fn().mockResolvedValue([
        { userId: 'user-1', soldPrice: 200 },
      ])

      const result = await service.getRoomLeaderboardData('room-1')

      expect(result).toMatchObject({
        tournamentId: 't1',
      })
      expect(result!.ledger).toHaveLength(1)
      expect(result!.rosters).toHaveLength(1)
    })
  })
})
