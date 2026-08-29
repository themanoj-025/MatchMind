/**
 * Draft Scoring — fantasy point computation for draft run resolution.
 *
 * Pure functions that compute approximate fantasy points from match stats.
 * Extracted from draftRunService.ts for single-responsibility.
 */

export interface ApproxStats {
  goals?: number
  assists?: number
  minutesPlayed?: number
  cleanSheet?: boolean
  saves?: number
  penaltiesSaved?: number
  yellowCards?: number
  redCards?: number
  penaltiesMissed?: number
  ownGoals?: number
  goalsConceded?: number
}

function defensiveCleanSheetAdjustment(stats: ApproxStats, minutesPlayed: number, position: string): number {
  if (!stats.cleanSheet || minutesPlayed < 60) return 0
  return position === 'DEF' || position === 'GK' ? 4 : 1
}

function goalsConcededAdjustment(stats: ApproxStats, minutesPlayed: number, position: string): number {
  if ((position === 'DEF' || position === 'GK') && minutesPlayed > 0 && (stats.goalsConceded ?? 0) >= 2) {
    return Math.floor((stats.goalsConceded ?? 0) / 2)
  }
  return 0
}

function addDefensiveAdjustments(points: number, stats: ApproxStats, position: string, minutesPlayed: number): number {
  let p = points
  p += defensiveCleanSheetAdjustment(stats, minutesPlayed, position)
  if ((stats.saves ?? 0) >= 3) {
    p += Math.floor((stats.saves ?? 0) / 3)
  }
  p += (stats.penaltiesSaved || 0) * 5
  p -= goalsConcededAdjustment(stats, minutesPlayed, position)
  return p
}

function subtractDisciplinePenalties(points: number, stats: ApproxStats): number {
  let p = points
  p -= (stats.yellowCards || 0) * 1
  p -= (stats.redCards || 0) * 3
  p -= (stats.penaltiesMissed || 0) * 2
  p -= (stats.ownGoals || 0) * 2
  return p
}

/** Compute approximate fantasy points from match stats (§2.3 fallback). */
export function computeApproximatePoints(stats: ApproxStats, position: string): number {
  const minutesPlayed = stats.minutesPlayed ?? 0
  let points = minutesPlayed >= 60 ? 2 : minutesPlayed > 0 ? 1 : 0
  const goalPoints = position === 'FWD' ? 4 : position === 'MID' ? 5 : 6
  points += (stats.goals || 0) * goalPoints
  points += (stats.assists || 0) * 3
  points = addDefensiveAdjustments(points, stats, position, minutesPlayed)
  points = subtractDisciplinePenalties(points, stats)
  return Math.max(points, 0)
}
