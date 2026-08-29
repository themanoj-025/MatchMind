/**
 * Tests for draftScoring.ts — fantasy point computation.
 *
 * Pure functions, no external dependencies — fast unit tests.
 */
import { describe, it, expect } from 'vitest'
import { computeApproximatePoints, type ApproxStats } from './draftScoring'

describe('computeApproximatePoints', () => {
  // ── Minutes played ──────────────────────────────────────────────────────
  describe('minutes played', () => {
    it('returns 0 for 0 minutes', () => {
      expect(computeApproximatePoints({ minutesPlayed: 0 }, 'FWD')).toBe(0)
    })

    it('returns 1 for 1-59 minutes', () => {
      expect(computeApproximatePoints({ minutesPlayed: 30 }, 'FWD')).toBe(1)
      expect(computeApproximatePoints({ minutesPlayed: 59 }, 'FWD')).toBe(1)
    })

    it('returns 2 for 60+ minutes', () => {
      expect(computeApproximatePoints({ minutesPlayed: 60 }, 'FWD')).toBe(2)
      expect(computeApproximatePoints({ minutesPlayed: 90 }, 'FWD')).toBe(2)
    })
  })

  // ── Goal points by position ─────────────────────────────────────────────
  describe('goal points by position', () => {
    it('FWD gets 4 points per goal', () => {
      const stats: ApproxStats = { minutesPlayed: 90, goals: 1 }
      expect(computeApproximatePoints(stats, 'FWD')).toBe(6) // 2 + 4
    })

    it('MID gets 5 points per goal', () => {
      const stats: ApproxStats = { minutesPlayed: 90, goals: 1 }
      expect(computeApproximatePoints(stats, 'MID')).toBe(7) // 2 + 5
    })

    it('DEF gets 6 points per goal', () => {
      const stats: ApproxStats = { minutesPlayed: 90, goals: 1 }
      expect(computeApproximatePoints(stats, 'DEF')).toBe(8) // 2 + 6
    })

    it('GK gets 6 points per goal', () => {
      const stats: ApproxStats = { minutesPlayed: 90, goals: 1 }
      expect(computeApproximatePoints(stats, 'GK')).toBe(8) // 2 + 6
    })

    it('multiple goals accumulate', () => {
      const stats: ApproxStats = { minutesPlayed: 90, goals: 3 }
      expect(computeApproximatePoints(stats, 'FWD')).toBe(14) // 2 + 12
    })
  })

  // ── Assists ─────────────────────────────────────────────────────────────
  describe('assists', () => {
    it('awards 3 points per assist', () => {
      const stats: ApproxStats = { minutesPlayed: 90, assists: 2 }
      expect(computeApproximatePoints(stats, 'MID')).toBe(8) // 2 + 6
    })
  })

  // ── Defensive adjustments ───────────────────────────────────────────────
  describe('defensive adjustments', () => {
    it('DEF/GK gets clean sheet bonus (4 pts) at 60+ min', () => {
      const stats: ApproxStats = { minutesPlayed: 90, cleanSheet: true }
      expect(computeApproximatePoints(stats, 'DEF')).toBe(6) // 2 + 4
      expect(computeApproximatePoints(stats, 'GK')).toBe(6)
    })

    it('MID/FWD gets smaller clean sheet bonus (1 pt)', () => {
      const stats: ApproxStats = { minutesPlayed: 90, cleanSheet: true }
      expect(computeApproximatePoints(stats, 'MID')).toBe(3) // 2 + 1
      expect(computeApproximatePoints(stats, 'FWD')).toBe(3)
    })

    it('no clean sheet bonus under 60 minutes', () => {
      const stats: ApproxStats = { minutesPlayed: 45, cleanSheet: true }
      expect(computeApproximatePoints(stats, 'DEF')).toBe(1)
    })

    it('saves bonus: floor(saves/3) when saves >= 3', () => {
      const stats: ApproxStats = { minutesPlayed: 90, saves: 6 }
      expect(computeApproximatePoints(stats, 'GK')).toBe(4) // 2 + 2
    })

    it('no saves bonus when saves < 3', () => {
      const stats: ApproxStats = { minutesPlayed: 90, saves: 2 }
      expect(computeApproximatePoints(stats, 'GK')).toBe(2)
    })

    it('penalties saved: 5 pts each', () => {
      const stats: ApproxStats = { minutesPlayed: 90, penaltiesSaved: 1 }
      expect(computeApproximatePoints(stats, 'GK')).toBe(7) // 2 + 5
    })

    it('goals conceded penalty for DEF/GK when >= 2', () => {
      const stats: ApproxStats = { minutesPlayed: 90, goalsConceded: 4 }
      expect(computeApproximatePoints(stats, 'DEF')).toBe(0) // 2 - 2
      expect(computeApproximatePoints(stats, 'GK')).toBe(0)
    })

    it('no goals conceded penalty when < 2', () => {
      const stats: ApproxStats = { minutesPlayed: 90, goalsConceded: 1 }
      expect(computeApproximatePoints(stats, 'DEF')).toBe(2)
    })
  })

  // ── Discipline penalties ────────────────────────────────────────────────
  describe('discipline penalties', () => {
    it('yellow card: -1 point', () => {
      const stats: ApproxStats = { minutesPlayed: 90, yellowCards: 1 }
      expect(computeApproximatePoints(stats, 'MID')).toBe(1) // 2 - 1
    })

    it('red card: -3 points (floored at 0)', () => {
      const stats: ApproxStats = { minutesPlayed: 90, redCards: 1 }
      // 2 - 3 = -1, but score is floored at 0
      expect(computeApproximatePoints(stats, 'MID')).toBe(0)
    })

    it('penalty missed: -2 points', () => {
      const stats: ApproxStats = { minutesPlayed: 90, penaltiesMissed: 1 }
      expect(computeApproximatePoints(stats, 'FWD')).toBe(0) // 2 - 2
    })

    it('own goal: -2 points', () => {
      const stats: ApproxStats = { minutesPlayed: 90, ownGoals: 1 }
      expect(computeApproximatePoints(stats, 'DEF')).toBe(0) // 2 - 2
    })
  })

  // ── Floor at 0 ──────────────────────────────────────────────────────────
  describe('score floor', () => {
    it('never goes below 0', () => {
      const stats: ApproxStats = {
        minutesPlayed: 90,
        redCards: 2,
        penaltiesMissed: 2,
        ownGoals: 2,
      }
      expect(computeApproximatePoints(stats, 'FWD')).toBe(0)
    })
  })

  // ── Complex scenarios ───────────────────────────────────────────────────
  describe('complex scenarios', () => {
    it('full 90-min FWD with goal + assist + yellow', () => {
      const stats: ApproxStats = {
        minutesPlayed: 90,
        goals: 1,
        assists: 1,
        yellowCards: 1,
      }
      // 2 + 4 (goal) + 3 (assist) - 1 (yellow) = 8
      expect(computeApproximatePoints(stats, 'FWD')).toBe(8)
    })

    it('GK with clean sheet + 5 saves + penalty saved', () => {
      const stats: ApproxStats = {
        minutesPlayed: 90,
        cleanSheet: true,
        saves: 5,
        penaltiesSaved: 1,
      }
      // 2 + 4 (CS) + 1 (saves) + 5 (pen saved) = 12
      expect(computeApproximatePoints(stats, 'GK')).toBe(12)
    })

    it('DEF with goal + clean sheet + yellow card', () => {
      const stats: ApproxStats = {
        minutesPlayed: 90,
        goals: 1,
        cleanSheet: true,
        yellowCards: 1,
      }
      // 2 + 6 (goal) + 4 (CS) - 1 (yellow) = 11
      expect(computeApproximatePoints(stats, 'DEF')).toBe(11)
    })
  })
})
