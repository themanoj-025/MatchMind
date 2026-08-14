/**
 * Leaderboard Service — MatchMind
 *
 * Leaderboard is a **derived view** from the append-only fantasyPointsLedger.
 * There is exactly one aggregation function, unit-tested, called from one place.
 * No more leaderboard mapping duplicated across five routes (fixes the audit finding).
 */

import type { FantasyPointsResult } from './fantasyPoints'

// ─── Types ───────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number
  userId: string
  totalPoints: number
  entries: number            // Number of fixtures scored
  avgPoints: number           // Average points per fixture
  rosterValue: number         // Total cost of drafted players
  change?: number             // Rank change since last update (optional)
}

export interface RoomLeaderboard {
  roomId: string
  tournamentId: string
  entries: LeaderboardEntry[]
}

// ─── Compute Room Leaderboard ────────────────────────────

export function computeRoomLeaderboard(
  ledger: FantasyPointsResult[],
  roomId: string,
  rosters?: Array<{ userId: string; soldPrice: number }>,
): LeaderboardEntry[] {
  const scores: Record<string, { totalPoints: number; entries: number }> = {}

  // Aggregate fantasy points per user from the ledger
  for (const entry of ledger) {
    if (!scores[entry.userId]) {
      scores[entry.userId] = { totalPoints: 0, entries: 0 }
    }
    // @ts-ignore
    scores[entry.userId].totalPoints += entry.totalPoints
    // @ts-ignore
    scores[entry.userId].entries++
  }

  // Build the roster value map
  const rosterValueMap: Record<string, number> = {}
  if (rosters) {
    for (const r of rosters) {
      rosterValueMap[r.userId] = (rosterValueMap[r.userId] || 0) + r.soldPrice
    }
  }

  return Object.entries(scores)
    .map(([userId, data]) => ({
      userId,
      totalPoints: data.totalPoints,
      entries: data.entries,
      avgPoints: data.entries > 0
        ? Math.round((data.totalPoints / data.entries) * 10) / 10
        : 0,
      rosterValue: rosterValueMap[userId] || 0,
    }))
    .sort((a, b) => {
      // Sort by total points descending, then by avg points descending
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      return b.avgPoints - a.avgPoints
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))
}


