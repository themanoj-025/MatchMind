/**
 * Scoring Engine — MatchMind
 *
 * Core business logic for prediction scoring.
 * All functions are PURE — no DB/IO dependencies.
 * Pass data in, get results out. Trivially unit-testable.
 *
 * Scoring rules:
 *   Exact score (both goals match)   → 50 + 5 base = 55 pts
 *   Correct result + same GD         → 35 + 5 base = 40 pts
 *   Correct result only              → 25 + 5 base = 30 pts
 *   BTTS bonus                       → +10
 *   Over/Under bonus                 → +10
 *   Wrong result                     → 5 base only
 *   Void                             → 0
 *
 * Tiers:
 *   BRONZE   (0–499)
 *   SILVER   (500–1,499)
 *   GOLD     (1,500–3,499)
 *   PLATINUM (3,500–6,999)
 *   DIAMOND  (7,000–11,999)
 *   LEGEND   (12,000+)
 */

import { SCORING } from '../config/constants'

// ─── Types ───────────────────────────────────────────────

export interface PredictionInput {
  id?: string
  userId?: string
  matchId?: string
  homeGoals: number
  awayGoals: number
  btts?: boolean | null
  totalGoalsOU?: string | null
  totalGoalsLine?: number | null
  firstScorerId?: string | null
}

export interface MatchResult {
  homeScore: number
  awayScore: number
}

export interface Ruleset {
  exactScore: number
  resultAndGD: number
  resultOnly: number
  base: number
  wrongResult: number
  btts: number
  overUnder: number
}

export interface ScoredPrediction {
  predictionId: string
  userId: string
  matchId: string
  homeGoals: number
  awayGoals: number
  actualHomeScore: number
  actualAwayScore: number
  pointsEarned: number
  pointsBreakdown: Record<string, number>
  wasCorrect: boolean
  correctResult: boolean
  exactScore: boolean
  bttsCorrect: boolean
  ouCorrect: boolean
}

export interface StreakResult {
  currentStreak: number
  bestStreak: number
  wasCorrect: boolean
  points: number
}

export type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'LEGEND'

export interface TierThreshold {
  tier: Tier
  minPoints: number
}

export interface LeaderboardEntry {
  userId: string
  username?: string
  displayName?: string
  avatar?: string | null
  totalPoints: number
  correctPredictions: number
  totalPredictions: number
  accuracy: number
  streakCurrent: number
  tier: Tier
  rank: number
}

// ─── Tier Configuration ──────────────────────────────────

export const TIER_THRESHOLDS: readonly TierThreshold[] = [
  { tier: 'BRONZE', minPoints: 0 },
  { tier: 'SILVER', minPoints: 500 },
  { tier: 'GOLD', minPoints: 1500 },
  { tier: 'PLATINUM', minPoints: 3500 },
  { tier: 'DIAMOND', minPoints: 7000 },
  { tier: 'LEGEND', minPoints: 12000 },
] as const

export const DEFAULT_RULESET: Ruleset = {
  exactScore: SCORING.EXACT_SCORE,
  resultAndGD: SCORING.RESULT_AND_GD,
  resultOnly: SCORING.RESULT_ONLY,
  base: SCORING.BASE,
  wrongResult: SCORING.WRONG_RESULT,
  btts: SCORING.BTTS,
  overUnder: SCORING.OVER_UNDER,
}

// ─── Helpers ─────────────────────────────────────────────

function getMatchResult(homeScore: number, awayScore: number): 'home' | 'away' | 'draw' {
  if (homeScore > awayScore) return 'home'
  if (awayScore > homeScore) return 'away'
  return 'draw'
}

function hasSameGD(homeScore: number, awayScore: number, predHome: number, predAway: number): boolean {
  return (homeScore - awayScore) === (predHome - predAway)
}

/**
 * Calculate the result of a match given predicted and actual scores.
 */
export function getPredictionResult(homeGoals: number, awayGoals: number): 'home' | 'away' | 'draw' {
  return getMatchResult(homeGoals, awayGoals)
}

// ─── Core Scoring Functions ──────────────────────────────

/**
 * Calculate points for a single prediction.
 * Pure function — no side effects, no DB access.
 *
 * @param prediction - The user's prediction input
 * @param actualResult - The actual match result
 * @param ruleset - Scoring rules (defaults to DEFAULT_RULESET)
 * @returns The total points earned
 */
export function calculatePredictionPoints(
  prediction: PredictionInput,
  actualResult: MatchResult,
  ruleset: Ruleset = DEFAULT_RULESET,
): { total: number; breakdown: Record<string, number> } {
  const { homeGoals, awayGoals, btts, totalGoalsOU, totalGoalsLine } = prediction
  const { homeScore, awayScore } = actualResult
  const breakdown: Record<string, number> = {}

  // Void check: if match has no score data (e.g. postponed/cancelled)
  if (homeScore === undefined || awayScore === undefined || homeScore === null || awayScore === null) {
    return { total: 0, breakdown: { void: 0 } }
  }

  const predictedResult = getMatchResult(homeGoals, awayGoals)
  const actualResultStr = getMatchResult(homeScore, awayScore)

  // Exact score match
  if (homeGoals === homeScore && awayGoals === awayScore) {
    breakdown.exactScore = ruleset.exactScore
    breakdown.base = ruleset.base
  }
  // Correct result + same goal difference
  else if (predictedResult === actualResultStr && hasSameGD(homeScore, awayScore, homeGoals, awayGoals)) {
    breakdown.resultAndGD = ruleset.resultAndGD
    breakdown.base = ruleset.base
  }
  // Correct result only
  else if (predictedResult === actualResultStr) {
    breakdown.resultOnly = ruleset.resultOnly
    breakdown.base = ruleset.base
  }
  // Wrong result
  else {
    breakdown.base = ruleset.base
  }

  // BTTS (Both Teams To Score) bonus
  if (btts === true) {
    const bothScored = homeScore > 0 && awayScore > 0
    if (bothScored) {
      breakdown.btts = ruleset.btts
    }
  } else if (btts === false) {
    const neitherScored = homeScore === 0 && awayScore === 0
    if (neitherScored) {
      breakdown.btts = ruleset.btts
    }
  }

  // Over/Under bonus
  if (totalGoalsOU && totalGoalsLine != null) {
    const totalGoals = homeScore + awayScore
    if ((totalGoalsOU === 'OVER' && totalGoals > totalGoalsLine) ||
        (totalGoalsOU === 'UNDER' && totalGoals < totalGoalsLine)) {
      breakdown.overUnder = ruleset.overUnder
    }
    // Note: exact line match (totalGoals === totalGoalsLine) results in a push — no bonus awarded
  }

  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0)
  return { total, breakdown }
}

/**
 * Score all predictions for a match.
 *
 * @param matchId - The match ID
 * @param predictions - Array of prediction inputs
 * @param actualResult - The actual match result
 * @param ruleset - Scoring rules
 * @returns Array of scored predictions
 */
export function scoreMatchPredictions(
  matchId: string,
  predictions: PredictionInput[],
  actualResult: MatchResult,
  ruleset: Ruleset = DEFAULT_RULESET,
): ScoredPrediction[] {
  return predictions.map((prediction) => {
    const { total, breakdown } = calculatePredictionPoints(prediction, actualResult, ruleset)

    const predictedResult = getMatchResult(prediction.homeGoals, prediction.awayGoals)
    const actualResultStr = getMatchResult(actualResult.homeScore, actualResult.awayScore)

    const correctResult = predictedResult === actualResultStr
    const exactScore = prediction.homeGoals === actualResult.homeScore &&
      prediction.awayGoals === actualResult.awayScore

    const bothScored = actualResult.homeScore > 0 && actualResult.awayScore > 0
    const bttsCorrect = prediction.btts === true
      ? bothScored
      : prediction.btts === false
        ? !bothScored
        : false

    const totalGoals = actualResult.homeScore + actualResult.awayScore
    const totalGoalsLine = prediction.totalGoalsLine ?? 2.5
    const actualOU = totalGoals > totalGoalsLine ? 'OVER' : 'UNDER'
    const ouCorrect = prediction.totalGoalsOU === actualOU

    const wasCorrect = correctResult || exactScore

    return {
      predictionId: prediction.id || '',
      userId: prediction.userId || '',
      matchId,
      homeGoals: prediction.homeGoals,
      awayGoals: prediction.awayGoals,
      actualHomeScore: actualResult.homeScore,
      actualAwayScore: actualResult.awayScore,
      pointsEarned: total,
      pointsBreakdown: breakdown,
      wasCorrect,
      correctResult,
      exactScore,
      bttsCorrect,
      ouCorrect,
    }
  })
}

/**
 * Update a user's streak based on whether their prediction was correct.
 *
 * @param wasCorrect - Whether the prediction was correct
 * @param currentStreak - The user's current streak before this prediction
 * @param bestStreak - The user's best streak before this prediction
 * @returns Updated streak values
 */
export function updateStreak(
  wasCorrect: boolean,
  currentStreak: number,
  bestStreak: number = currentStreak,
): StreakResult {
  if (wasCorrect) {
    const newStreak = currentStreak + 1
    return {
      currentStreak: newStreak,
      bestStreak: Math.max(bestStreak, newStreak),
      wasCorrect: true,
      points: newStreak >= 5 ? 10 : newStreak >= 3 ? 5 : 0, // Streak bonus points
    }
  }

  return {
    currentStreak: 0,
    bestStreak,
    wasCorrect: false,
    points: 0,
  }
}

/**
 * Compute a user's tier based on their total points and streak.
 *
 * @param totalPoints - The user's total points
 * @param _currentStreak - The user's current streak (reserved for future streak-based tier bonuses)
 * @returns The user's tier
 */
export function computeTier(totalPoints: number, _currentStreak?: number): Tier {
  // Iterate from highest to lowest to find the matching tier
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    // @ts-ignore
    if (totalPoints >= TIER_THRESHOLDS[i].minPoints) {
      // @ts-ignore
      return TIER_THRESHOLDS[i].tier
    }
  }
  return 'BRONZE'
}

/**
 * Rebuild a leaderboard from scored predictions.
 *
 * @param scoredPredictions - Array of scored predictions
 * @param userMap - Optional map of userId to user info (username, displayName, avatar)
 * @returns Sorted and ranked leaderboard entries
 */
export function rebuildLeaderboard(
  scoredPredictions: ScoredPrediction[],
  userMap?: Record<string, { username?: string; displayName?: string; avatar?: string | null }>,
): LeaderboardEntry[] {
  const userStats: Record<string, {
    totalPoints: number
    correctPredictions: number
    totalPredictions: number
    streakCurrent: number
  }> = {}

  for (const sp of scoredPredictions) {
    if (!userStats[sp.userId]) {
      userStats[sp.userId] = {
        totalPoints: 0,
        correctPredictions: 0,
        totalPredictions: 0,
        streakCurrent: 0,
      }
    }

    const stats = userStats[sp.userId]
    // @ts-ignore
    stats.totalPoints += sp.pointsEarned
    // @ts-ignore
    stats.totalPredictions++

    if (sp.wasCorrect) {
      // @ts-ignore
      stats.correctPredictions++
      // @ts-ignore
      stats.streakCurrent++
    } else {
      // @ts-ignore
      stats.streakCurrent = 0
    }
  }

  const entries: Omit<LeaderboardEntry, 'rank'>[] = Object.entries(userStats)
    .map(([userId, stats]) => ({
      userId,
      username: userMap?.[userId]?.username,
      displayName: userMap?.[userId]?.displayName,
      avatar: userMap?.[userId]?.avatar ?? null,
      totalPoints: stats.totalPoints,
      correctPredictions: stats.correctPredictions,
      totalPredictions: stats.totalPredictions,
      accuracy: stats.totalPredictions > 0
        ? Math.round((stats.correctPredictions / stats.totalPredictions) * 1000) / 10
        : 0,
      streakCurrent: stats.streakCurrent,
      tier: computeTier(stats.totalPoints),
    }))
    .sort((a, b) => {
      // Sort by total points descending, then accuracy descending, then streak descending
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy
      return b.streakCurrent - a.streakCurrent
    })

  return entries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }))
}
