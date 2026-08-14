/**
 * Fantasy Points Tests — MatchMind
 *
 * Tests the fantasy football scoring engine:
 * - All scoring rules from §10.2 (minutes, goals by position, assists, clean sheets, saves, cards, etc.)
 * - Captain ×2 / Vice-Captain ×1.5 with VC auto-fallback
 * - computeFantasyPoints integration with roster + stats
 * - computeLeaderboard aggregation
 * - computeRoomLeaderboard from leaderboardService
 */

import { describe, it, expect, vi } from 'vitest'
import {
  calculatePlayerPoints,
  applyCaptainMultiplier,
  FantasyPointsResult,
  PlayerMatchStats,
} from './fantasyPoints'

import { computeRoomLeaderboard } from './leaderboardService'

// ─── Test Helpers ────────────────────────────────────────

function makeStats(overrides: Partial<PlayerMatchStats> = {}): PlayerMatchStats {
  return {
    playerId: 'player-1',
    fixtureId: 'fixture-1',
    minutesPlayed: 90,
    goals: 0,
    assists: 0,
    cleanSheet: false,
    saves: 0,
    penaltiesSaved: 0,
    yellowCards: 0,
    redCards: 0,
    penaltiesMissed: 0,
    ownGoals: 0,
    goalsConceded: 0,
    ...overrides,
  }
}

// ─── Scoring Rules (§10.2) ──────────────────────────────

describe('calculatePlayerPoints() — Scoring Rules', () => {
  it('awards +2 for playing 60+ minutes', () => {
    const result = calculatePlayerPoints(makeStats({ minutesPlayed: 90 }), 'MID', false, false, false)
    expect(result.minutes).toBe(2)
  })

  it('awards +1 for playing less than 60 minutes', () => {
    const result = calculatePlayerPoints(makeStats({ minutesPlayed: 30 }), 'MID', false, false, false)
    expect(result.minutes).toBe(1)
  })

  it('awards 0 minutes points for not playing', () => {
    const result = calculatePlayerPoints(makeStats({ minutesPlayed: 0 }), 'MID', false, false, false)
    expect(result.minutes).toBeUndefined()
  })

  it('awards +4 per goal for FWD', () => {
    const result = calculatePlayerPoints(makeStats({ goals: 2 }), 'FWD', false, false, false)
    expect(result.goals).toBe(8) // 2 × 4
  })

  it('awards +5 per goal for MID', () => {
    const result = calculatePlayerPoints(makeStats({ goals: 1 }), 'MID', false, false, false)
    expect(result.goals).toBe(5)
  })

  it('awards +6 per goal for DEF', () => {
    const result = calculatePlayerPoints(makeStats({ goals: 1 }), 'DEF', false, false, false)
    expect(result.goals).toBe(6)
  })

  it('awards +6 per goal for GK', () => {
    const result = calculatePlayerPoints(makeStats({ goals: 1 }), 'GK', false, false, false)
    expect(result.goals).toBe(6)
  })

  it('awards +3 per assist', () => {
    const result = calculatePlayerPoints(makeStats({ assists: 2 }), 'MID', false, false, false)
    expect(result.assists).toBe(6) // 2 × 3
  })

  it('awards +4 clean sheet for DEF/GK (played 60+)', () => {
    const result = calculatePlayerPoints(
      makeStats({ cleanSheet: true, minutesPlayed: 90 }),
      'DEF', false, false, false,
    )
    expect(result.cleanSheet).toBe(4)
  })

  it('awards +1 clean sheet for MID (played 60+)', () => {
    const result = calculatePlayerPoints(
      makeStats({ cleanSheet: true, minutesPlayed: 90 }),
      'MID', false, false, false,
    )
    expect(result.cleanSheet).toBe(1)
  })

  it('no clean sheet points if played less than 60', () => {
    const result = calculatePlayerPoints(
      makeStats({ cleanSheet: true, minutesPlayed: 30 }),
      'DEF', false, false, false,
    )
    expect(result.cleanSheet).toBeUndefined()
  })

  it('awards +1 per 3 saves (GK)', () => {
    const result = calculatePlayerPoints(makeStats({ saves: 6 }), 'GK', false, false, false)
    expect(result.saves).toBe(2) // floor(6/3) × 1
  })

  it('awards +5 per penalty save (GK)', () => {
    const result = calculatePlayerPoints(makeStats({ penaltiesSaved: 2 }), 'GK', false, false, false)
    expect(result.penaltySave).toBe(10) // 2 × 5
  })

  it('deducts -1 per yellow card', () => {
    const result = calculatePlayerPoints(makeStats({ yellowCards: 1 }), 'MID', false, false, false)
    expect(result.yellowCards).toBe(-1)
  })

  it('deducts -3 per red card', () => {
    const result = calculatePlayerPoints(makeStats({ redCards: 1 }), 'MID', false, false, false)
    expect(result.redCards).toBe(-3)
  })

  it('deducts -2 per penalty miss', () => {
    const result = calculatePlayerPoints(makeStats({ penaltiesMissed: 1 }), 'FWD', false, false, false)
    expect(result.penaltyMiss).toBe(-2)
  })

  it('deducts -2 per own goal', () => {
    const result = calculatePlayerPoints(makeStats({ ownGoals: 1 }), 'DEF', false, false, false)
    expect(result.ownGoal).toBe(-2)
  })

  it('deducts -1 per 2 goals conceded (DEF/GK only)', () => {
    const result = calculatePlayerPoints(makeStats({ goalsConceded: 4 }), 'DEF', false, false, false)
    expect(result.goalsConceded).toBe(-2) // floor(4/2) × -1
  })

  it('no goals conceded deduction for MID', () => {
    const result = calculatePlayerPoints(makeStats({ goalsConceded: 4 }), 'MID', false, false, false)
    expect(result.goalsConceded).toBeUndefined()
  })

  it('no goals conceded deduction if not played', () => {
    const result = calculatePlayerPoints(
      makeStats({ goalsConceded: 4, minutesPlayed: 0 }),
      'DEF', false, false, false,
    )
    expect(result.goalsConceded).toBeUndefined()
  })

  it('aggregates multiple stats correctly', () => {
    // Forward: 90min(2) + 1 goal(4) + 2 assists(6) + 1 yellow(-1) = 11
    const result = calculatePlayerPoints(
      makeStats({ minutesPlayed: 90, goals: 1, assists: 2, yellowCards: 1 }),
      'FWD', false, false, false,
    )
    const total = Object.values(result).reduce((s, v) => s + v, 0)
    expect(total).toBe(11)
  })
})

// ─── Captain/VC Multipliers ────────────────────────────

describe('applyCaptainMultiplier()', () => {
  it('doubles points for captain', () => {
    expect(applyCaptainMultiplier(10, true, false, true)).toBe(20)
  })

  it('applies ×1.5 for vice-captain when captain did not play', () => {
    expect(applyCaptainMultiplier(10, false, true, false)).toBe(15)
  })

  it('does NOT apply VC multiplier when captain played', () => {
    expect(applyCaptainMultiplier(10, false, true, true)).toBe(10)
  })

  it('applies no multiplier for regular players', () => {
    expect(applyCaptainMultiplier(10, false, false, false)).toBe(10)
    expect(applyCaptainMultiplier(10, false, false, true)).toBe(10)
  })

  it('captain multiplier takes priority over VC', () => {
    // If someone is both captain and VC (edge case), captain ×2 applies
    expect(applyCaptainMultiplier(10, true, true, true)).toBe(20)
  })
})

// ─── computeFantasyPoints Integration ────────────────────

describe('computeFantasyPoints() Integration', () => {
  it('computes points for all roster entries with stats', async () => {
    const { computeFantasyPoints } = await import('./fantasyPoints')

    const playerStats = {
      'p1': { stats: makeStats({ playerId: 'p1', minutesPlayed: 90, goals: 1 }), position: 'FWD' },
      'p2': { stats: makeStats({ playerId: 'p2', minutesPlayed: 90, cleanSheet: true }), position: 'DEF' },
    }

    const rosters = [
      { id: 'r1', roomId: 'room-1', userId: 'u1', playerId: 'p1', soldPrice: 30, isCaptain: true, isViceCaptain: false },
      { id: 'r2', roomId: 'room-1', userId: 'u1', playerId: 'p2', soldPrice: 25, isCaptain: false, isViceCaptain: false },
    ]

    const saveLedger = vi.fn().mockResolvedValue(undefined)

    const results = await computeFantasyPoints(
      'fixture-1',
      playerStats,
      rosters,
      async () => null,
      saveLedger,
    )

    expect(results).toHaveLength(2)
    // p1 (FWD): 2(min) + 4(goal) = 6 → ×2 captain = 12
    expect(results[0].playerId).toBe('p1')
    expect(results[0].basePoints).toBe(6)
    expect(results[0].totalPoints).toBe(12)
    expect(results[0].captainMultiplier).toBe(2)

    // p2 (DEF): 2(min) + 4(cleanSheet) = 6
    expect(results[1].playerId).toBe('p2')
    expect(results[1].basePoints).toBe(6)
    expect(results[1].totalPoints).toBe(6)
    expect(results[1].captainMultiplier).toBe(1)

    expect(saveLedger).toHaveBeenCalledTimes(2)
  })

  it('vc multiplier activates when captain did not play', async () => {
    const { computeFantasyPoints } = await import('./fantasyPoints')

    const playerStats = {
      'p1': { stats: makeStats({ playerId: 'p1', minutesPlayed: 0 }), position: 'MID' }, // captain didn't play
      'p2': { stats: makeStats({ playerId: 'p2', minutesPlayed: 90, assists: 2 }), position: 'MID' }, // VC played
    }

    const rosters = [
      { id: 'r1', roomId: 'room-1', userId: 'u1', playerId: 'p1', soldPrice: 30, isCaptain: true, isViceCaptain: false },
      { id: 'r2', roomId: 'room-1', userId: 'u1', playerId: 'p2', soldPrice: 25, isCaptain: false, isViceCaptain: true },
    ]

    const results = await computeFantasyPoints(
      'fixture-1',
      playerStats,
      rosters,
      async () => null,
      vi.fn().mockResolvedValue(undefined),
    )

    expect(results).toHaveLength(2)
    // p1: captain but didn't play → no minutes points → basePoints = 0
    expect(results[0].basePoints).toBe(0)
    expect(results[0].totalPoints).toBe(0)

    // p2 (VC, captain didn't play): 2(min) + 6(assists) = 8 → ×1.5 = 12
    expect(results[1].basePoints).toBe(8)
    expect(results[1].totalPoints).toBe(12)
    expect(results[1].captainMultiplier).toBe(1.5)
  })

  it('skips roster entries without stats', async () => {
    const { computeFantasyPoints } = await import('./fantasyPoints')

    const results = await computeFantasyPoints(
      'fixture-1',
      {}, // no stats
      [{ id: 'r1', roomId: 'room-1', userId: 'u1', playerId: 'p1', soldPrice: 30, isCaptain: false, isViceCaptain: false }],
      async () => null,
      vi.fn().mockResolvedValue(undefined),
    )

    expect(results).toHaveLength(0)
  })
})

// ─── Leaderboard Aggregation ────────────────────────────

describe('computeRoomLeaderboard()', () => {
  it('aggregates points per user from the ledger', () => {
    const entries = computeRoomLeaderboard(
      [
        { userId: 'u1', totalPoints: 10, playerId: 'p1', roomId: 'r1', fixtureId: 'f1', basePoints: 8, captainMultiplier: 1, breakdown: {} },
        { userId: 'u1', totalPoints: 15, playerId: 'p2', roomId: 'r1', fixtureId: 'f1', basePoints: 10, captainMultiplier: 1.5, breakdown: {} },
        { userId: 'u2', totalPoints: 12, playerId: 'p3', roomId: 'r1', fixtureId: 'f1', basePoints: 12, captainMultiplier: 1, breakdown: {} },
      ],
      'r1',
    )

    expect(entries).toHaveLength(2)
    // u1: 10 + 15 = 25, u2: 12 → u1 ranked 1st
    expect(entries[0].userId).toBe('u1')
    expect(entries[0].totalPoints).toBe(25)
    expect(entries[0].entries).toBe(2)
    expect(entries[0].rank).toBe(1)

    expect(entries[1].userId).toBe('u2')
    expect(entries[1].totalPoints).toBe(12)
    expect(entries[1].entries).toBe(1)
    expect(entries[1].rank).toBe(2)
  })

  it('calculates roster value when provided', () => {
    const entries = computeRoomLeaderboard(
      [
        { userId: 'u1', totalPoints: 10, playerId: 'p1', roomId: 'r1', fixtureId: 'f1', basePoints: 8, captainMultiplier: 1, breakdown: {} },
        { userId: 'u1', totalPoints: 5, playerId: 'p2', roomId: 'r1', fixtureId: 'f1', basePoints: 5, captainMultiplier: 1, breakdown: {} },
      ],
      'r1',
      [
        { userId: 'u1', soldPrice: 30 },
        { userId: 'u1', soldPrice: 25 },
      ],
    )

    expect(entries[0].rosterValue).toBe(55)
    expect(entries[0].avgPoints).toBe(7.5) // 15 / 2
  })

  it('returns empty array for empty ledger', () => {
    const entries = computeRoomLeaderboard([], 'r1')
    expect(entries).toHaveLength(0)
  })
})
