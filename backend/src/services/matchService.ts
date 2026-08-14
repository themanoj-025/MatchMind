import { DatabaseClient } from '../repositories'
import { computeFantasyPoints } from './fantasyPoints'
import logger from '../utils/logger'

export class MatchService {
  private prisma: DatabaseClient

  constructor({ prisma }: { prisma: DatabaseClient }) {
    this.prisma = prisma
  }

  async getMatches(take: number = 50): Promise<any[]> {
    return this.prisma.fixture.findMany({
      orderBy: { scheduledAt: 'asc' },
      take,
    })
  }

  async getMatchById(id: string): Promise<any | null> {
    return this.prisma.fixture.findUnique({ where: { id } })
  }

  async getFixtures(tournamentId?: string): Promise<any[]> {
    const where: Record<string, any> = {}
    if (tournamentId) {
      where.tournamentId = tournamentId
    }

    return this.prisma.fixture.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      take: 100,
    })
  }

  async getFixtureDetails(id: string): Promise<any | null> {
    return this.prisma.fixture.findUnique({
      where: { id },
      include: {
        playerMatchStats: {
          include: { player: { select: { id: true, name: true, position: true } } },
        },
      },
    })
  }

  async createFixture(data: any): Promise<any> {
    return this.prisma.fixture.create({ data })
  }

  async enterPlayerStats(fixtureId: string, playerStats: any[]): Promise<any[]> {
    const created = []
    for (const stat of playerStats) {
      const entry = await this.prisma.playerMatchStat.create({
        data: { fixtureId, ...stat },
      })
      created.push(entry)
    }
    return created
  }

  async finalizeFixture(
    fixtureId: string,
    adminId: string,
    io?: any,
  ): Promise<{ roomsProcessed: number; fantasyEntries: number }> {
    // Mark fixture as FINISHED
    await this.prisma.fixture.update({
      where: { id: fixtureId },
      data: { status: 'FINISHED' },
    })

    // Get all player match stats for this fixture
    const stats = await this.prisma.playerMatchStat.findMany({
      where: { fixtureId },
    })

    // Get all rooms for this fixture's tournament
    const fixture = await this.prisma.fixture.findUnique({ where: { id: fixtureId } })
    if (!fixture) {
      throw new Error('Fixture not found')
    }

    const rooms = await this.prisma.room.findMany({
      where: { tournamentId: fixture.tournamentId },
    })

    // Batch-load all players referenced in stats
    const playerIds = [...new Set(stats.map((s: any) => s.playerId))]
    const allPlayers = await this.prisma.player.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, position: true, name: true },
    })
    const playerMap = new Map<string, { id: string; position: string; name: string }>(
      allPlayers.map((p: any) => [p.id, p]),
    )

    // Batch-load all rosters for all rooms
    const roomIds = rooms.map((r: any) => r.id)
    const allRosters = await this.prisma.roster.findMany({
      where: { roomId: { in: roomIds } },
    })
    const rostersByRoom = new Map<string, any[]>()
    for (const roster of allRosters) {
      const existing = rostersByRoom.get(roster.roomId) || []
      existing.push(roster)
      rostersByRoom.set(roster.roomId, existing)
    }

    // Build player stats map
    const playerStatsMap: Record<string, any> = {}
    for (const stat of stats) {
      const player = playerMap.get(stat.playerId)
      if (player) {
        playerStatsMap[stat.playerId] = { stats: stat, position: player.position }
      }
    }

    let totalEntries = 0
    for (const room of rooms) {
      const rosters = rostersByRoom.get(room.id) || []
      if (rosters.length === 0) {
        continue
      }

      const results = await computeFantasyPoints(
        fixtureId,
        playerStatsMap,
        rosters,
        async () => null,
        async (entry) => {
          await this.prisma.fantasyPointsLedger.create({ data: entry })
          totalEntries++
        },
      )

      // Emit socket events for real-time updates
      if (io) {
        for (const result of results) {
          io.to(`room:${room.id}`).emit('FANTASY_POINTS_UPDATE', {
            roomId: room.id,
            userId: result.userId,
            delta: result.totalPoints,
            playerId: result.playerId,
            fixtureId,
            breakdown: result.breakdown,
          })
        }
      }
    }

    // Log admin action
    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'FIXTURE_FINALIZED',
        targetId: fixtureId,
        targetType: 'fixture',
        detail: { rooms: rooms.length, fantasyEntries: totalEntries },
      },
    })

    return { roomsProcessed: rooms.length, fantasyEntries: totalEntries }
  }
}
