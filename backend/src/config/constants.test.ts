import { describe, it, expect } from 'vitest'
import {
  SCORING,
  PAGINATION,
  RATE_LIMIT,
  BULLMQ,
  MATCH,
  CHAT,
  DRAFT,
  RARITY_TIERS,
  RUN_REWARD_TIERS,
} from './constants'

describe('SCORING constants', () => {
  it('has correct base and exact score values', () => {
    expect(SCORING.BASE).toBe(5)
    expect(SCORING.EXACT_SCORE).toBe(50)
    expect(SCORING.RESULT_AND_GD).toBe(35)
    expect(SCORING.RESULT_ONLY).toBe(25)
    expect(SCORING.WRONG_RESULT).toBe(0)
    expect(SCORING.BTTS).toBe(10)
    expect(SCORING.OVER_UNDER).toBe(10)
  })
})

describe('PAGINATION constants', () => {
  it('has sane defaults', () => {
    expect(PAGINATION.DEFAULT_PAGE).toBe(1)
    expect(PAGINATION.DEFAULT_LIMIT).toBe(20)
    expect(PAGINATION.MAX_LIMIT).toBe(100)
  })
})

describe('RATE_LIMIT constants', () => {
  it('auth window is 15 minutes', () => {
    expect(RATE_LIMIT.AUTH_WINDOW_MS).toBe(15 * 60 * 1000)
    expect(RATE_LIMIT.AUTH_MAX).toBe(5)
  })

  it('password reset window is 1 hour', () => {
    expect(RATE_LIMIT.PASSWORD_RESET_WINDOW_MS).toBe(60 * 60 * 1000)
    expect(RATE_LIMIT.PASSWORD_RESET_MAX).toBe(3)
  })

  it('prediction window is 1 minute', () => {
    expect(RATE_LIMIT.PREDICTION_WINDOW_MS).toBe(60 * 1000)
    expect(RATE_LIMIT.PREDICTION_MAX).toBe(30)
  })

  it('global window is 1 minute', () => {
    expect(RATE_LIMIT.GLOBAL_WINDOW_MS).toBe(60 * 1000)
    expect(RATE_LIMIT.GLOBAL_MAX).toBe(100)
  })
})

describe('BULLMQ constants', () => {
  it('has retry configuration', () => {
    expect(BULLMQ.SCORE_ATTEMPTS).toBeGreaterThan(0)
    expect(BULLMQ.SCORE_BACKOFF_DELAY).toBeGreaterThan(0)
    expect(BULLMQ.RESET_ATTEMPTS).toBeGreaterThan(0)
  })
})

describe('MATCH constants', () => {
  it('has lock statuses and finished minute', () => {
    expect(MATCH.LOCK_STATUSES).toContain('PENDING')
    expect(MATCH.LOCK_STATUSES).toContain('LOCKED')
    expect(MATCH.FINISHED_MINUTE).toBe(90)
  })
})

describe('CHAT constants', () => {
  it('has max text length', () => {
    expect(CHAT.MAX_TEXT_LENGTH).toBe(500)
  })
})

describe('DRAFT constants', () => {
  it('has timer and roster config', () => {
    expect(DRAFT.PICK_TIMER_SECONDS).toBe(20)
    expect(DRAFT.OFFERED_PLAYERS_PER_ROUND).toBe(3)
    expect(DRAFT.BENCH_SLOTS).toBe(7)
  })

  it('has synergy thresholds', () => {
    expect(DRAFT.SYNERGY_NATIONALITY_THRESHOLD).toBe(3)
    expect(DRAFT.SYNERGY_CLUB_THRESHOLD).toBe(2)
    expect(DRAFT.SYNERGY_MAX_BONUS).toBe(15)
  })
})

describe('RARITY_TIERS', () => {
  it('has 4 tiers in order', () => {
    expect(RARITY_TIERS).toHaveLength(4)
    expect(RARITY_TIERS.map((t) => t.tier)).toEqual(['BRONZE', 'SILVER', 'GOLD', 'ICON'])
  })

  it('pack weights sum to 1.0', () => {
    const totalWeight = RARITY_TIERS.reduce((sum, t) => sum + t.packWeight, 0)
    expect(totalWeight).toBeCloseTo(1.0, 5)
  })

  it('maxPercentile ends at 100', () => {
    expect(RARITY_TIERS[RARITY_TIERS.length - 1]!.maxPercentile).toBe(100)
  })

  it('each tier has a badgeColor', () => {
    for (const tier of RARITY_TIERS) {
      expect(tier.badgeColor).toBeTruthy()
    }
  })
})

describe('RUN_REWARD_TIERS', () => {
  it('has 6 tiers', () => {
    expect(RUN_REWARD_TIERS).toHaveLength(6)
  })

  it('minWins are non-decreasing', () => {
    const minWins = RUN_REWARD_TIERS.map((t) => t.minWins)
    for (let i = 1; i < minWins.length; i++) {
      expect(minWins[i]!).toBeGreaterThanOrEqual(minWins[i - 1]!)
    }
  })

  it('last tier is 5 wins (full clear)', () => {
    expect(RUN_REWARD_TIERS[RUN_REWARD_TIERS.length - 1]!.minWins).toBe(5)
  })

  it('each tier has id, name, description', () => {
    for (const tier of RUN_REWARD_TIERS) {
      expect(tier.id).toBeTruthy()
      expect(tier.name).toBeTruthy()
      expect(tier.description).toBeTruthy()
    }
  })
})
