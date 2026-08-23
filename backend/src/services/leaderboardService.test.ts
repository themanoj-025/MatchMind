/**
 * Leaderboard Service Tests — MatchMind
 *
 * Tests computeRoomLeaderboard (pure function):
 * - Empty ledger → empty array
 * - Single user, single fixture → correct rank/points
 * - Multiple users → sorted by totalPoints desc
 * - Tiebreaker by avgPoints
 * - Roster value aggregation
 * - Average points calculation
 */

import { describe, it, expect } from 'vitest'
import { computeRoomLeaderboard, type LeaderboardEntry } from './leaderboardService'
import type { FantasyPointsResult } from './fantasyPoints'

function makeLedgerEntry(overrides: Partial<Pick<FantasyPointsResult, 'userId' | 'totalPoints'>> = {}) {
  return {
    userId: overrides.userId ?? 'user-1',
    totalPoints: overrides.totalPoints ?? 30,
  }
}

describe('computeRoomLeaderboard', () => {
  it('returns empty array for empty ledger', () => {
    const result = computeRoomLeaderboard([], 'room-1')
    expect(result).toEqual([])
  })

  it('computes leaderboard for single user with single fixture', () => {
    const ledger = [makeLedgerEntry({ userId: 'user-1', totalPoints: 55 })]
    const result = computeRoomLeaderboard(ledger, 'room-1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      rank: 1,
      userId: 'user-1',
      totalPoints: 55,
      entries: 1,
      avgPoints: 55,
      rosterValue: 0,
    })
  })

  it('sorts multiple users by totalPoints descending', () => {
    const ledger = [
      makeLedgerEntry({ userId: 'user-1', totalPoints: 30 }),
      makeLedgerEntry({ userId: 'user-2', totalPoints: 55 }),
      makeLedgerEntry({ userId: 'user-3', totalPoints: 40 }),
    ]
    const result = computeRoomLeaderboard(ledger, 'room-1')

    expect(result[0].userId).toBe('user-2')
    expect(result[0].rank).toBe(1)
    expect(result[1].userId).toBe('user-3')
    expect(result[1].rank).toBe(2)
    expect(result[2].userId).toBe('user-1')
    expect(result[2].rank).toBe(3)
  })

  it('uses avgPoints as tiebreaker when totalPoints are equal', () => {
    const ledger = [
      makeLedgerEntry({ userId: 'user-1', totalPoints: 55 }),
      makeLedgerEntry({ userId: 'user-2', totalPoints: 55 }),
      makeLedgerEntry({ userId: 'user-1', totalPoints: 0 }), // user-1 avg: 27.5
    ]
    const result = computeRoomLeaderboard(ledger, 'room-1')

    // user-2: 55/1 = 55 avg, user-1: 55/2 = 27.5 avg
    expect(result[0].userId).toBe('user-2')
    expect(result[0].avgPoints).toBe(55)
    expect(result[1].userId).toBe('user-1')
    expect(result[1].avgPoints).toBe(27.5)
  })

  it('aggregates roster value from rosters parameter', () => {
    const ledger = [
      makeLedgerEntry({ userId: 'user-1', totalPoints: 30 }),
      makeLedgerEntry({ userId: 'user-2', totalPoints: 55 }),
    ]
    const rosters = [
      { userId: 'user-1', soldPrice: 200 },
      { userId: 'user-1', soldPrice: 150 },
      { userId: 'user-2', soldPrice: 300 },
    ]
    const result = computeRoomLeaderboard(ledger, 'room-1', rosters)

    expect(result.find((e) => e.userId === 'user-1')!.rosterValue).toBe(350)
    expect(result.find((e) => e.userId === 'user-2')!.rosterValue).toBe(300)
  })

  it('computes average points correctly', () => {
    const ledger = [
      makeLedgerEntry({ userId: 'user-1', totalPoints: 30 }),
      makeLedgerEntry({ userId: 'user-1', totalPoints: 50 }),
      makeLedgerEntry({ userId: 'user-1', totalPoints: 20 }),
    ]
    const result = computeRoomLeaderboard(ledger, 'room-1')

    expect(result[0].totalPoints).toBe(100)
    expect(result[0].entries).toBe(3)
    expect(result[0].avgPoints).toBe(33.3) // 100/3 = 33.33... rounded to 1 decimal
  })

  it('handles multiple fixtures per user', () => {
    const ledger = [
      makeLedgerEntry({ userId: 'user-1', totalPoints: 30 }),
      makeLedgerEntry({ userId: 'user-1', totalPoints: 40 }),
      makeLedgerEntry({ userId: 'user-2', totalPoints: 55 }),
    ]
    const result = computeRoomLeaderboard(ledger, 'room-1')

    // user-1: 70 total, user-2: 55 total
    expect(result[0].userId).toBe('user-1')
    expect(result[0].entries).toBe(2)
    expect(result[0].totalPoints).toBe(70)
    expect(result[1].userId).toBe('user-2')
    expect(result[1].entries).toBe(1)
  })
})
