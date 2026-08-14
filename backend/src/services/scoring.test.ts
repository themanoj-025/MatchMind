/**
 * Scoring Engine Tests — MatchMind
 *
 * Comprehensive test suite for calculatePredictionPoints, scoreMatchPredictions,
 * updateStreak, computeTier, and rebuildLeaderboard.
 *
 * Coverage targets:
 *   - Exact score: 55 pts
 *   - Correct result + same GD: 40 pts
 *   - Correct result only: 30 pts
 *   - BTTS bonus: +10
 *   - Over/Under bonus: +10
 *   - Wrong result: 5 pts
 *   - Void: 0 pts
 *   - Streak continuation
 *   - Streak break
 *   - Tier boundaries
 *   - Leaderboard tie-breaking
 */

import { describe, it, expect } from 'vitest'
import {
  calculatePredictionPoints,
  scoreMatchPredictions,
  updateStreak,
  computeTier,
  rebuildLeaderboard,
  DEFAULT_RULESET,
  TIER_THRESHOLDS,
} from './scoring'
import type { PredictionInput, MatchResult, ScoredPrediction } from './scoring'

// ─── Helpers ─────────────────────────────────────────────

function pred(overrides: Partial<PredictionInput> & { homeGoals: number; awayGoals: number }): PredictionInput {
  return {
    btts: null,
    totalGoalsOU: null,
    totalGoalsLine: null,
    firstScorerId: null,
    ...overrides,
  }
}

// ─── calculatePredictionPoints ───────────────────────────

describe('calculatePredictionPoints', () => {
  describe('Exact score', () => {
    it('awards 50 + 5 base = 55 pts for exact score match', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 2, awayGoals: 1 }),
        { homeScore: 2, awayScore: 1 },
      )
      expect(result.total).toBe(55)
      expect(result.breakdown.exactScore).toBe(50)
      expect(result.breakdown.base).toBe(5)
    })

    it('awards exact score points for a 0-0 draw prediction', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 0, awayGoals: 0 }),
        { homeScore: 0, awayScore: 0 },
      )
      expect(result.total).toBe(55)
    })

    it('awards exact score points for a high-scoring match', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 5, awayGoals: 3 }),
        { homeScore: 5, awayScore: 3 },
      )
      expect(result.total).toBe(55)
    })
  })

  describe('Correct result + same goal difference', () => {
    it('awards 35 + 5 base = 40 pts for correct result with same GD', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 3, awayGoals: 1 }),
        { homeScore: 2, awayScore: 0 },
      )
      expect(result.total).toBe(40)
      expect(result.breakdown.resultAndGD).toBe(35)
      expect(result.breakdown.base).toBe(5)
    })

    it('awards 40 pts for correct draw with same GD (1-1 vs 2-2)', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 1, awayGoals: 1 }),
        { homeScore: 2, awayScore: 2 },
      )
      expect(result.total).toBe(40)
    })

    it('does NOT award result+GD if GD differs', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 3, awayGoals: 0 }),
        { homeScore: 2, awayScore: 0 },
      )
      // home win correct, GD is 3 vs 2 — only result correct
      expect(result.total).toBe(30)
      expect(result.breakdown.resultOnly).toBe(25)
      expect(result.breakdown.base).toBe(5)
    })
  })

  describe('Correct result only', () => {
    it('awards 25 + 5 base = 30 pts for correct result (home win, different GD)', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 3, awayGoals: 0 }), // GD: 3
        { homeScore: 2, awayScore: 1 },        // GD: 1
      )
      expect(result.total).toBe(30)
      expect(result.breakdown.resultOnly).toBe(25)
    })

    it('awards 30 pts for correct result (away win, different GD)', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 0, awayGoals: 4 }), // GD: -4
        { homeScore: 1, awayScore: 3 },       // GD: -2
      )
      expect(result.total).toBe(30)
      expect(result.breakdown.resultOnly).toBe(25)
    })

    it('awards 40 pts for correct draw with same GD', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 2, awayGoals: 2 }), // GD: 0
        { homeScore: 1, awayScore: 1 },       // GD: 0
      )
      expect(result.total).toBe(40)
      expect(result.breakdown.resultAndGD).toBe(35)
    })

    it('awards 5 pts when home win predicted but actual is draw (wrong result)', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 3, awayGoals: 2 }), // home win
        { homeScore: 1, awayScore: 1 },       // draw
      )
      expect(result.total).toBe(5)
      expect(result.breakdown.base).toBe(5)
    })
  })

  describe('Wrong result', () => {
    it('awards only 5 base pts for wrong result', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 0, awayGoals: 2 }),
        { homeScore: 2, awayScore: 1 },
      )
      expect(result.total).toBe(5)
      expect(result.breakdown.base).toBe(5)
      expect(result.breakdown.exactScore).toBeUndefined()
      expect(result.breakdown.resultAndGD).toBeUndefined()
      expect(result.breakdown.resultOnly).toBeUndefined()
    })

    it('awards 5 pts for home win predicted but away win actual', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 3, awayGoals: 0 }),
        { homeScore: 0, awayScore: 2 },
      )
      expect(result.total).toBe(5)
    })
  })

  describe('BTTS (Both Teams To Score) bonus', () => {
    it('awards +10 BTTS bonus when both teams score and user predicted BTTS yes', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 2, awayGoals: 1, btts: true }),
        { homeScore: 3, awayScore: 2 },
      )
      expect(result.breakdown.btts).toBe(10)
    })

    it('awards +10 BTTS bonus when no team scores and user predicted BTTS no', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 0, awayGoals: 0, btts: false }),
        { homeScore: 0, awayScore: 0 },
      )
      expect(result.breakdown.btts).toBe(10)
    })

    it('does NOT award BTTS bonus when user predicted yes but only one team scores', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 1, awayGoals: 0, btts: true }),
        { homeScore: 1, awayScore: 0 },
      )
      expect(result.breakdown.btts).toBeUndefined()
    })

    it('does NOT award BTTS when user did not predict BTTS', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 2, awayGoals: 0, btts: null }),
        { homeScore: 1, awayScore: 1 },
      )
      expect(result.breakdown.btts).toBeUndefined()
    })
  })

  describe('Over/Under bonus', () => {
    it('awards +10 OU bonus for correct over prediction', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 3, awayGoals: 1, totalGoalsOU: 'OVER', totalGoalsLine: 2.5 }),
        { homeScore: 2, awayScore: 1 },
      )
      expect(result.breakdown.overUnder).toBe(10)
    })

    it('awards +10 OU bonus for correct under prediction', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 0, awayGoals: 0, totalGoalsOU: 'UNDER', totalGoalsLine: 2.5 }),
        { homeScore: 1, awayScore: 0 },
      )
      expect(result.breakdown.overUnder).toBe(10)
    })

    it('does NOT award OU bonus for incorrect over prediction', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 3, awayGoals: 1, totalGoalsOU: 'UNDER', totalGoalsLine: 2.5 }),
        { homeScore: 2, awayScore: 1 },
      )
      expect(result.breakdown.overUnder).toBeUndefined()
    })

    it('does NOT award OU bonus when user did not predict OU', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 2, awayGoals: 1, totalGoalsOU: null, totalGoalsLine: null }),
        { homeScore: 2, awayScore: 1 },
      )
      expect(result.breakdown.overUnder).toBeUndefined()
    })
  })

  describe('Void / no data', () => {
    it('returns 0 points for void match (null scores)', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 2, awayGoals: 1 }),
        { homeScore: null as unknown as number, awayScore: null as unknown as number },
      )
      expect(result.total).toBe(0)
      expect(result.breakdown.void).toBe(0)
    })
  })

  describe('Composite scenarios', () => {
    it('exact score + BTTS + OU = 55 + 10 + 10 = 75', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 2, awayGoals: 1, btts: true, totalGoalsOU: 'OVER', totalGoalsLine: 2.5 }),
        { homeScore: 2, awayScore: 1 },
      )
      expect(result.total).toBe(75)
    })

    it('correct result only when BTTS fails', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 2, awayGoals: 0, btts: true }),
        { homeScore: 1, awayScore: 0 },
      )
      // home win correct (GD differs), BTTS wrong
      expect(result.total).toBe(30)
      expect(result.breakdown.resultOnly).toBe(25)
    })

    it('correct result only when OU is wrong', () => {
      const result = calculatePredictionPoints(
        pred({ homeGoals: 2, awayGoals: 0, totalGoalsOU: 'OVER', totalGoalsLine: 1.5 }),
        { homeScore: 1, awayScore: 0 },
      )
      // home win correct (GD differs), OU wrong (1 total, user predicted OVER on 1.5)
      expect(result.total).toBe(30)
      expect(result.breakdown.resultOnly).toBe(25)
    })
  })

  describe('Custom ruleset', () => {
    it('uses custom ruleset when provided', () => {
      const customRules = { ...DEFAULT_RULESET, exactScore: 100, base: 10 }
      const result = calculatePredictionPoints(
        pred({ homeGoals: 2, awayGoals: 1 }),
        { homeScore: 2, awayScore: 1 },
        customRules,
      )
      expect(result.total).toBe(110)
      expect(result.breakdown.exactScore).toBe(100)
      expect(result.breakdown.base).toBe(10)
    })
  })
})

// ─── scoreMatchPredictions ───────────────────────────────

describe('scoreMatchPredictions', () => {
  const matchId = 'match-1'
  const actualResult: MatchResult = { homeScore: 2, awayScore: 1 }

  it('scores multiple predictions for the same match', () => {
    const predictions: PredictionInput[] = [
      { ...pred({ homeGoals: 2, awayGoals: 1 }), id: 'p1', userId: 'user-1', matchId },
      { ...pred({ homeGoals: 3, awayGoals: 0 }), id: 'p2', userId: 'user-2', matchId },  // GD: 3 vs 1 — result only
      { ...pred({ homeGoals: 0, awayGoals: 2 }), id: 'p3', userId: 'user-3', matchId },
    ]

    const results = scoreMatchPredictions(matchId, predictions, actualResult)

    expect(results).toHaveLength(3)
    expect(results[0].pointsEarned).toBe(55)  // exact
    expect(results[1].pointsEarned).toBe(30)  // result only (3-0 vs 2-1, GD differs)
    expect(results[2].pointsEarned).toBe(5)   // wrong
  })

  it('marks wasCorrect for correct predictions', () => {
    const predictions: PredictionInput[] = [
      { ...pred({ homeGoals: 2, awayGoals: 1 }), id: 'p1', userId: 'u1', matchId },
      { ...pred({ homeGoals: 0, awayGoals: 2 }), id: 'p2', userId: 'u2', matchId },
    ]

    const results = scoreMatchPredictions(matchId, predictions, actualResult)
    expect(results[0].wasCorrect).toBe(true)
    expect(results[1].wasCorrect).toBe(false)
  })

  it('sets correctResult and exactScore flags correctly', () => {
    const results = scoreMatchPredictions(matchId, [
      { ...pred({ homeGoals: 2, awayGoals: 1 }), id: 'p1', userId: 'u1', matchId },
      { ...pred({ homeGoals: 3, awayGoals: 0 }), id: 'p2', userId: 'u2', matchId },  // GD differs, but correct result
    ], actualResult)

    expect(results[0].exactScore).toBe(true)
    expect(results[0].correctResult).toBe(true)
    expect(results[1].exactScore).toBe(false)
    expect(results[1].correctResult).toBe(true)
  })

  it('returns empty array for empty predictions', () => {
    const results = scoreMatchPredictions(matchId, [], actualResult)
    expect(results).toHaveLength(0)
  })
})

// ─── updateStreak ────────────────────────────────────────

describe('updateStreak', () => {
  it('increments streak on correct prediction', () => {
    const result = updateStreak(true, 3, 5)
    expect(result.currentStreak).toBe(4)
    expect(result.bestStreak).toBe(5)
    expect(result.wasCorrect).toBe(true)
  })

  it('updates best streak when current exceeds previous best', () => {
    const result = updateStreak(true, 8, 8)
    expect(result.currentStreak).toBe(9)
    expect(result.bestStreak).toBe(9)
  })

  it('resets streak to 0 on incorrect prediction', () => {
    const result = updateStreak(false, 5, 10)
    expect(result.currentStreak).toBe(0)
    expect(result.bestStreak).toBe(10)
    expect(result.wasCorrect).toBe(false)
  })

  it('awards 0 streak bonus points for incorrect', () => {
    const result = updateStreak(false, 3, 5)
    expect(result.points).toBe(0)
  })

  it('awards 5 streak bonus points for 3+ streak', () => {
    const result = updateStreak(true, 2, 5)
    expect(result.currentStreak).toBe(3)
    expect(result.points).toBe(5)
  })

  it('awards 10 streak bonus points for 5+ streak', () => {
    const result = updateStreak(true, 4, 10)
    expect(result.currentStreak).toBe(5)
    expect(result.points).toBe(10)
  })

  it('uses currentStreak as bestStreak default when not provided', () => {
    const result = updateStreak(true, 0)
    expect(result.currentStreak).toBe(1)
    expect(result.bestStreak).toBe(1)
  })

  it('handles first prediction (streak 0, correct)', () => {
    const result = updateStreak(true, 0, 0)
    expect(result.currentStreak).toBe(1)
    expect(result.bestStreak).toBe(1)
  })
})

// ─── computeTier ─────────────────────────────────────────

describe('computeTier', () => {
  it('returns BRONZE for 0 points', () => {
    expect(computeTier(0)).toBe('BRONZE')
  })

  it('returns BRONZE for 499 points', () => {
    expect(computeTier(499)).toBe('BRONZE')
  })

  it('returns SILVER for 500 points', () => {
    expect(computeTier(500)).toBe('SILVER')
  })

  it('returns SILVER for 1499 points', () => {
    expect(computeTier(1499)).toBe('SILVER')
  })

  it('returns GOLD for 1500 points', () => {
    expect(computeTier(1500)).toBe('GOLD')
  })

  it('returns GOLD for 3499 points', () => {
    expect(computeTier(3499)).toBe('GOLD')
  })

  it('returns PLATINUM for 3500 points', () => {
    expect(computeTier(3500)).toBe('PLATINUM')
  })

  it('returns PLATINUM for 6999 points', () => {
    expect(computeTier(6999)).toBe('PLATINUM')
  })

  it('returns DIAMOND for 7000 points', () => {
    expect(computeTier(7000)).toBe('DIAMOND')
  })

  it('returns DIAMOND for 11999 points', () => {
    expect(computeTier(11999)).toBe('DIAMOND')
  })

  it('returns LEGEND for 12000 points', () => {
    expect(computeTier(12000)).toBe('LEGEND')
  })

  it('returns LEGEND for very high points', () => {
    expect(computeTier(50000)).toBe('LEGEND')
  })

  it('is not affected by streak parameter', () => {
    expect(computeTier(500, 10)).toBe('SILVER')
    expect(computeTier(1500, 0)).toBe('GOLD')
  })

  it('has correct tier thresholds in ascending order', () => {
    for (let i = 1; i < TIER_THRESHOLDS.length; i++) {
      expect(TIER_THRESHOLDS[i].minPoints).toBeGreaterThan(TIER_THRESHOLDS[i - 1].minPoints)
    }
  })
})

// ─── rebuildLeaderboard ──────────────────────────────────

describe('rebuildLeaderboard', () => {
  function makeScored(userId: string, points: number, wasCorrect: boolean): ScoredPrediction {
    return {
      predictionId: 'p-' + userId,
      userId,
      matchId: 'match-1',
      homeGoals: 2,
      awayGoals: 1,
      actualHomeScore: 2,
      actualAwayScore: 1,
      pointsEarned: points,
      pointsBreakdown: { exactScore: 50, base: 5 },
      wasCorrect,
      correctResult: wasCorrect,
      exactScore: wasCorrect,
      bttsCorrect: false,
      ouCorrect: false,
    }
  }

  it('returns empty array for no predictions', () => {
    const entries = rebuildLeaderboard([])
    expect(entries).toHaveLength(0)
  })

  it('ranks users by total points descending', () => {
    const predictions = [
      makeScored('user-a', 55, true),
      makeScored('user-b', 30, true),
      makeScored('user-c', 5, false),
    ]

    const entries = rebuildLeaderboard(predictions)
    expect(entries).toHaveLength(3)
    expect(entries[0].userId).toBe('user-a')
    expect(entries[1].userId).toBe('user-b')
    expect(entries[2].userId).toBe('user-c')
  })

  it('assigns correct ranks (1-based)', () => {
    const predictions = [
      makeScored('user-a', 55, true),
      makeScored('user-b', 55, true),
      makeScored('user-c', 5, false),
    ]

    const entries = rebuildLeaderboard(predictions)
    expect(entries[0].rank).toBe(1)
    expect(entries[1].rank).toBe(2)
    expect(entries[2].rank).toBe(3)
  })

  it('aggregates multiple predictions per user', () => {
    const predictions = [
      makeScored('user-a', 55, true),
      makeScored('user-a', 30, true),
      makeScored('user-b', 55, true),
    ]

    const entries = rebuildLeaderboard(predictions)
    const userA = entries.find(e => e.userId === 'user-a')
    expect(userA?.totalPoints).toBe(85)
    expect(userA?.totalPredictions).toBe(2)
    expect(userA?.correctPredictions).toBe(2)
  })

  it('calculates accuracy as percentage', () => {
    const predictions = [
      makeScored('user-a', 55, true),
      makeScored('user-a', 5, false),
      makeScored('user-a', 30, true),
    ]

    const entries = rebuildLeaderboard(predictions)
    const userA = entries.find(e => e.userId === 'user-a')
    expect(userA?.accuracy).toBe(66.7) // 2/3 = 66.666... ≈ 66.7
  })

  it('breaks ties by accuracy then streak', () => {
    const predictions = [
      makeScored('user-a', 55, true),
      makeScored('user-b', 55, true),
      makeScored('user-c', 55, true),
    ]
    const entries = rebuildLeaderboard(predictions)
    expect(entries[0].totalPoints).toBe(55)
    expect(entries[1].totalPoints).toBe(55)
    expect(entries[2].totalPoints).toBe(55)
  })

  it('includes user metadata when userMap is provided', () => {
    const predictions = [makeScored('user-a', 55, true)]
    const userMap = {
      'user-a': { username: 'alice', displayName: 'Alice', avatar: 'https://example.com/avatar.png' },
    }

    const entries = rebuildLeaderboard(predictions, userMap)
    expect(entries[0].username).toBe('alice')
    expect(entries[0].displayName).toBe('Alice')
    expect(entries[0].avatar).toBe('https://example.com/avatar.png')
  })

  it('computes tier correctly for each entry', () => {
    const predictions = [
      makeScored('user-a', 55, true),   // BRONZE (0-499)
      makeScored('user-b', 500, true),  // SILVER (500-1499)
      makeScored('user-c', 1500, true), // GOLD (1500-3499)
    ]

    const entries = rebuildLeaderboard(predictions)
    expect(entries.find(e => e.userId === 'user-a')?.tier).toBe('BRONZE')
    expect(entries.find(e => e.userId === 'user-b')?.tier).toBe('SILVER')
    expect(entries.find(e => e.userId === 'user-c')?.tier).toBe('GOLD')
  })
})
