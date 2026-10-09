import { DatabaseClient } from '../repositories'
import { MAX_FREE_ROOMS_PER_USER } from '../config/tournaments'
import { computeRoomLeaderboard } from './leaderboardService'

export class RoomService {
  private prisma: DatabaseClient

  constructor({ prisma }: { prisma: DatabaseClient }) {
    this.prisma = prisma
  }

  async countActiveRoomsForUser(userId: string): Promise<number> {
    return this.prisma.room.count({
      where: { hostId: userId, status: { not: 'FINISHED' } },
    })
  }

  async findByInviteCode(inviteCode: string) {
    return this.prisma.room.findUnique({ where: { inviteCode } })
  }

  async createRoomWithHostAndAuction(
    data: { name: string; tournamentId: string; totalBudget: number; inviteCode: string },
    hostId: string,
  ) {
    const room = await this.prisma.room.create({
      data: {
        tournamentId: data.tournamentId,
        hostId,
        name: data.name,
        inviteCode: data.inviteCode,
        totalBudget: data.totalBudget,
        status: 'LOBBY',
      },
    })

    await this.prisma.roomMember.create({
      data: {
        roomId: room.id,
        userId: hostId,
        role: 'host',
        remainingBudget: data.totalBudget,
        isReady: true,
      },
    })

    await this.prisma.auctionState.create({
      data: {
        roomId: room.id,
        phase: 'IDLE',
        currentPlayerId: null,
        currentBid: 0,
        currentBidderId: null,
        timerEndsAt: null,
        version: 1,
      },
    })

    return room
  }

  async getUserRooms(userId: string) {
    const memberships = await this.prisma.roomMember.findMany({
      where: { userId },
      include: { room: true },
      orderBy: { room: { createdAt: 'desc' } },
    })
    return memberships.map((m) => ({
      ...m.room,
      membership: { role: m.role, remainingBudget: m.remainingBudget, isReady: m.isReady },
    }))
  }

  async getRoomDetails(roomId: string) {
    return this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
        },
        auctionState: true,
      },
    })
  }

  async getRoomMembers(roomId: string) {
    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true, tier: true } },
      },
      orderBy: { role: 'desc' },
    })
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { status: true, hostId: true },
    })

    return {
      members,
      roomStatus: room?.status || 'unknown',
      allReady: members.length > 0 && members.every((m) => m.isReady),
    }
  }

  async getRoomById(roomId: string) {
    return this.prisma.room.findUnique({ where: { id: roomId } })
  }

  async getMember(roomId: string, userId: string) {
    return this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    })
  }

  async joinRoom(roomId: string, userId: string, totalBudget: number) {
    return this.prisma.roomMember.create({
      data: {
        roomId,
        userId,
        role: 'member',
        remainingBudget: totalBudget,
        isReady: false,
      },
    })
  }

  async getFullMember(roomId: string, userId: string) {
    return this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
    })
  }

  async toggleMemberReady(roomId: string, userId: string, isCurrentlyReady: boolean) {
    return this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { isReady: !isCurrentlyReady },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
      },
    })
  }

  async updateInviteCode(roomId: string, inviteCode: string): Promise<void> {
    await this.prisma.room.update({
      where: { id: roomId },
      data: { inviteCode },
    })
  }

  async getRoomLeaderboardData(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, tournamentId: true },
    })
    if (!room) {
      return null
    }

    const ledger = await this.prisma.fantasyPointsLedger.findMany({
      where: { roomId },
    })

    const rosters = await this.prisma.roster.findMany({
      where: { roomId },
      select: { userId: true, soldPrice: true },
    })

    return { ledger, rosters, tournamentId: room.tournamentId }
  }
}
