/**
 * MatchService Tests — MatchMind
 *
 * Tests MatchService:
 * - getMatches: returns fixtures ordered by scheduledAt
 * - getMatchById: returns fixture or null
 * - getFixtures: filters by tournamentId
 * - getFixtureDetails: includes player match stats
 * - createFixture: creates a new fixture
 * - enterPlayerStats: creates player match stat entries
 * - finalizeFixture: marks finished, computes fantasy points
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MatchService } from './matchService'

function createMockPrisma() {
  return {
    fixture: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'fixture-1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    playerMatchStat: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'stat-1', ...data }),
      ),
      findMany: vi.fn().mockResolvedValue([]),
    },
    room: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    player: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    roster: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    fantasyPointsLedger: {
      create: vi.fn().mockResolvedValue({}),
    },
    adminLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  }
}

describe('MatchService', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let service: MatchService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = createMockPrisma()
    service = new MatchService({ prisma: prisma as never })
  })

  describe('getMatches', () => {
    it('returns fixtures ordered by scheduledAt', async () => {
      const mockFixtures = [
        { id: 'f1', scheduledAt: new Date('2026-01-01') },
        { id: 'f2', scheduledAt: new Date('2026-01-02') },
      ]
      prisma.fixture.findMany = vi.fn().mockResolvedValue(mockFixtures)

      const result = await service.getMatches()

      expect(result).toEqual(mockFixtures)
      expect(prisma.fixture.findMany).toHaveBeenCalledWith({
        orderBy: { scheduledAt: 'asc' },
        take: 50,
      })
    })

    it('respects custom take limit', async () => {
      await service.getMatches(10)

      expect(prisma.fixture.findMany).toHaveBeenCalledWith({
        orderBy: { scheduledAt: 'asc' },
        take: 10,
      })
    })
  })

  describe('getMatchById', () => {
    it('returns fixture when found', async () => {
      const mockFixture = { id: 'fixture-1', sport: 'cricket' }
      prisma.fixture.findUnique = vi.fn().mockResolvedValue(mockFixture)

      const result = await service.getMatchById('fixture-1')

      expect(result).toEqual(mockFixture)
      expect(prisma.fixture.findUnique).toHaveBeenCalledWith({
        where: { id: 'fixture-1' },
      })
    })

    it('returns null when not found', async () => {
      prisma.fixture.findUnique = vi.fn().mockResolvedValue(null)

      const result = await service.getMatchById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('getFixtures', () => {
    it('returns all fixtures when no tournamentId', async () => {
      await service.getFixtures()

      expect(prisma.fixture.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { scheduledAt: 'asc' },
        take: 100,
      })
    })

    it('filters by tournamentId when provided', async () => {
      await service.getFixtures('tournament-1')

      expect(prisma.fixture.findMany).toHaveBeenCalledWith({
        where: { tournamentId: 'tournament-1' },
        orderBy: { scheduledAt: 'asc' },
        take: 100,
      })
    })
  })

  describe('getFixtureDetails', () => {
    it('returns fixture with player match stats', async () => {
      const mockDetails = {
        id: 'fixture-1',
        playerMatchStats: [
          { playerId: 'p1', player: { id: 'p1', name: 'Player 1', position: 'BATTER' } },
        ],
      }
      prisma.fixture.findUnique = vi.fn().mockResolvedValue(mockDetails)

      const result = await service.getFixtureDetails('fixture-1')

      expect(result).toEqual(mockDetails)
      expect(prisma.fixture.findUnique).toHaveBeenCalledWith({
        where: { id: 'fixture-1' },
        include: {
          playerMatchStats: {
            include: { player: { select: { id: true, name: true, position: true } } },
          },
        },
      })
    })
  })

  describe('createFixture', () => {
    it('creates and returns a new fixture', async () => {
      const fixtureData = {
        sport: 'cricket',
        tournamentId: 't1',
        homeTeamId: 'ht1',
        awayTeamId: 'at1',
        homeTeamName: 'Team A',
        awayTeamName: 'Team B',
        scheduledAt: new Date(),
      }
      prisma.fixture.create = vi.fn().mockResolvedValue({ id: 'new-fixture', ...fixtureData })

      const result = await service.createFixture(fixtureData as never)

      expect(result.id).toBe('new-fixture')
      expect(prisma.fixture.create).toHaveBeenCalledWith({ data: fixtureData })
    })
  })

  describe('enterPlayerStats', () => {
    it('creates player match stat entries', async () => {
      const stats = [
        { playerId: 'p1', runs: 50, wickets: 0 },
        { playerId: 'p2', runs: 30, wickets: 2 },
      ]

      const result = await service.enterPlayerStats('fixture-1', stats as never)

      expect(result).toHaveLength(2)
      expect(prisma.playerMatchStat.create).toHaveBeenCalledTimes(2)
    })
  })

  describe('finalizeFixture', () => {
    it('marks fixture as FINISHED and processes rooms', async () => {
      prisma.fixture.findUnique = vi.fn()
        .mockResolvedValueOnce({ id: 'fixture-1', tournamentId: 't1' })
        .mockResolvedValueOnce({ id: 'fixture-1', tournamentId: 't1' })
      prisma.playerMatchStat.findMany = vi.fn().mockResolvedValue([])
      prisma.room.findMany = vi.fn().mockResolvedValue([])
      prisma.player.findMany = vi.fn().mockResolvedValue([])
      prisma.roster.findMany = vi.fn().mockResolvedValue([])

      const result = await service.finalizeFixture('fixture-1', 'admin-1')

      expect(prisma.fixture.update).toHaveBeenCalledWith({
        where: { id: 'fixture-1' },
        data: { status: 'FINISHED' },
      })
      expect(result).toMatchObject({ roomsProcessed: 0, fantasyEntries: 0 })
    })

    it('throws when fixture not found', async () => {
      prisma.fixture.findUnique = vi.fn().mockResolvedValue(null)

      await expect(
        service.finalizeFixture('nonexistent', 'admin-1'),
      ).rejects.toThrow('Fixture not found')
    })
  })
})
