/**
 * Fantasy Points Engine — MatchMind
 *
 * Computes fantasy points from real player match statistics.
 * Triggered by finalizeFixture workflow.
 *
 * Captain ×2, Vice-Captain ×1.5 (with auto-fallback).
 * Leaderboard is a derived view from the append-only fantasyPointsLedger.
 */

import logger from '../utils/logger'

// ─── Types ───────────────────────────────────────────────

export interface PlayerMatchStats {
  id?: string
  playerId: string
  fixtureId: string
  minutesPlayed: number
  goals: number
  assists: number
  cleanSheet: boolean
  saves: number
  penaltiesSaved: number
  yellowCards: number
  redCards: number
  penaltiesMissed: number
  ownGoals: number
  goalsConceded: number
}

export interface RosterEntry {
  id: string
  roomId: string
  userId: string
  playerId: string
  soldPrice: number
  isCaptain: boolean
  isViceCaptain: boolean
}

export interface FantasyPointsResult {
  playerId: string
  userId: string
  roomId: string
  fixtureId: string
  basePoints: number
  captainMultiplier: number
  totalPoints: number
  breakdown: Record<string, number>
}

// ─── Scoring Table (football-specific) ───────────────────

const SCORING_RULES = {
  MINUTES_60_PLUS: 2,
  MINUTES_LESS_THAN_60: 1,
  GOAL_FWD: 4,
  GOAL_MID: 5,
  GOAL_DEF_GK: 6,
  ASSIST: 3,
  CLEAN_SHEET_DEF_GK: 4,
  CLEAN_SHEET_MID: 1,
  SAVE_POINTS_EVERY_3: 1,
  PENALTY_SAVE: 5,
  YELLOW_CARD: -1,
  RED_CARD: -3,
  PENALTY_MISS: -2,
  OWN_GOAL: -2,
  GOALS_CONCEDED_PER_2: -1,
  CAPTAIN_MULTIPLIER: 2,
  VICE_CAPTAIN_MULTIPLIER: 1.5,
} as const

// ─── Calculate Points for a Single Player ────────────────

export function calculatePlayerPoints(
  stats: PlayerMatchStats,
  position: string,
  isCaptain: boolean,
  isViceCaptain: boolean,
  captainPlayed: boolean, // Whether the actual captain played (for VC fallback)
): FantasyPointsResult['breakdown'] {
  const breakdown: Record<string, number> = {}

  // Minutes played
  if (stats.minutesPlayed >= 60) {
    breakdown.minutes = SCORING_RULES.MINUTES_60_PLUS
  } else if (stats.minutesPlayed > 0) {
    breakdown.minutes = SCORING_RULES.MINUTES_LESS_THAN_60
  }

  // Goals (position-dependent)
  const goalPoints =
    position === 'FWD'
      ? SCORING_RULES.GOAL_FWD
      : position === 'MID'
        ? SCORING_RULES.GOAL_MID
        : SCORING_RULES.GOAL_DEF_GK // DEF or GK

  if (stats.goals > 0) {
    breakdown.goals = stats.goals * goalPoints
  }

  // Assists
  if (stats.assists > 0) {
    breakdown.assists = stats.assists * SCORING_RULES.ASSIST
  }

  // Clean sheet (DEF/GK: +4, MID: +1, only if played 60+ minutes)
  if (stats.cleanSheet && stats.minutesPlayed >= 60) {
    if (position === 'DEF' || position === 'GK') {
      breakdown.cleanSheet = SCORING_RULES.CLEAN_SHEET_DEF_GK
    } else if (position === 'MID') {
      breakdown.cleanSheet = SCORING_RULES.CLEAN_SHEET_MID
    }
  }

  // Saves (GK only)
  if (stats.saves >= 3) {
    breakdown.saves = Math.floor(stats.saves / 3) * SCORING_RULES.SAVE_POINTS_EVERY_3
  }

  // Penalty save (GK)
  if (stats.penaltiesSaved > 0) {
    breakdown.penaltySave = stats.penaltiesSaved * SCORING_RULES.PENALTY_SAVE
  }

  // Yellow card
  if (stats.yellowCards > 0) {
    breakdown.yellowCards = stats.yellowCards * SCORING_RULES.YELLOW_CARD
  }

  // Red card
  if (stats.redCards > 0) {
    breakdown.redCards = stats.redCards * SCORING_RULES.RED_CARD
  }

  // Penalty miss
  if (stats.penaltiesMissed > 0) {
    breakdown.penaltyMiss = stats.penaltiesMissed * SCORING_RULES.PENALTY_MISS
  }

  // Own goal
  if (stats.ownGoals > 0) {
    breakdown.ownGoal = stats.ownGoals * SCORING_RULES.OWN_GOAL
  }

  // Goals conceded (DEF/GK only, only if played)
  if ((position === 'DEF' || position === 'GK') && stats.minutesPlayed > 0 && stats.goalsConceded >= 2) {
    breakdown.goalsConceded =
      Math.floor(stats.goalsConceded / 2) * SCORING_RULES.GOALS_CONCEDED_PER_2
  }

  return breakdown
}

// ─── Apply Captain/VC Multiplier ─────────────────────────

export function applyCaptainMultiplier(
  basePoints: number,
  isCaptain: boolean,
  isViceCaptain: boolean,
  captainPlayed: boolean,
): number {
  if (isCaptain) {
    return basePoints * SCORING_RULES.CAPTAIN_MULTIPLIER
  }
  if (isViceCaptain && !captainPlayed) {
    // VC multiplier only activates if captain didn't play
    return basePoints * SCORING_RULES.VICE_CAPTAIN_MULTIPLIER
  }
  return basePoints
}

// ─── Compute Fantasy Points for a Fixture ────────────────

export async function computeFantasyPoints(
  fixtureId: string,
  playerStats: Record<string, { stats: PlayerMatchStats; position: string }>,
  rosters: RosterEntry[],
  getPlayerStats: (fixtureId: string, playerId: string) => Promise<PlayerMatchStats | null>,
  saveLedger: (entry: FantasyPointsResult) => Promise<void>,
): Promise<FantasyPointsResult[]> {
  const results: FantasyPointsResult[] = []

  // Determine which captain actually played
  const captainEntry = rosters.find((r) => r.isCaptain)
  const captainPlayed = captainEntry
    // @ts-ignore
    ? playerStats[captainEntry.playerId]?.stats.minutesPlayed > 0
    : false

  for (const roster of rosters) {
    const stats = playerStats[roster.playerId]?.stats
    const position = playerStats[roster.playerId]?.position || 'MID'

    if (!stats) continue

    const breakdown = calculatePlayerPoints(
      stats,
      position,
      roster.isCaptain,
      roster.isViceCaptain,
      captainPlayed,
    )

    const basePoints = Object.values(breakdown).reduce((sum, val) => sum + val, 0)
    const totalPoints = applyCaptainMultiplier(
      basePoints,
      roster.isCaptain,
      roster.isViceCaptain,
      captainPlayed,
    )

    const result: FantasyPointsResult = {
      playerId: roster.playerId,
      userId: roster.userId,
      roomId: roster.roomId,
      fixtureId,
      basePoints,
      captainMultiplier:
        roster.isCaptain ? SCORING_RULES.CAPTAIN_MULTIPLIER
        : (roster.isViceCaptain && !captainPlayed) ? SCORING_RULES.VICE_CAPTAIN_MULTIPLIER
        : 1,
      totalPoints,
      breakdown,
    }

    await saveLedger(result)
    results.push(result)
  }

  logger.info({
    event: 'fantasy.points_computed',
    fixtureId,
    entries: results.length,
    totalPoints: results.reduce((s, r) => s + r.totalPoints, 0),
  })

  return results
}

// ─── Compute Leaderboard (derived view) ──────────────────

export function computeLeaderboard(
  ledger: FantasyPointsResult[],
): Array<{ userId: string; totalPoints: number; entries: number }> {
  const scores: Record<string, { totalPoints: number; entries: number }> = {}

  for (const entry of ledger) {
    if (!scores[entry.userId]) {
      scores[entry.userId] = { totalPoints: 0, entries: 0 }
    }
    // @ts-ignore
    scores[entry.userId].totalPoints += entry.totalPoints
    // @ts-ignore
    scores[entry.userId].entries++
  }

  return Object.entries(scores)
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.totalPoints - a.totalPoints)
}
