/**
 * Leaderboard Mapper — MatchMind
 *
 * Centralizes the user-to-leaderboard-entry transformation that was
 * duplicated 5x across routes/leaderboard.js.
 */

export interface LeaderboardUser {
  id: string
  username: string
  displayName: string | null
  avatar: string | null
  totalPoints: number
  weeklyPoints?: number
  predAccuracy: number
  streakCurrent: number
  tier: string
  countryCode?: string | null
  [key: string]: any
}

export interface LeaderboardEntry {
  id: string
  username: string
  name: string
  avatar: string | null
  points: number
  accuracy: number
  streak: number
  tier: string
  rank: number
  countryCode?: string
  totalPoints?: number
}

export interface LeaderboardMapperOpts {
  pointField?: string
}

export function toLeaderboardEntry(user: LeaderboardUser, rank: number, opts: LeaderboardMapperOpts = {}): LeaderboardEntry {
  const pointField = opts.pointField || 'totalPoints'
  return {
    id: user.id,
    username: user.username,
    name: user.displayName || user.username,
    avatar: user.avatar,
    points: user[pointField] ?? 0,
    accuracy: user.predAccuracy ?? 0,
    streak: user.streakCurrent ?? 0,
    tier: user.tier,
    rank,
    ...(user.countryCode ? { countryCode: user.countryCode } : {}),
    ...(user.totalPoints !== undefined && pointField !== 'totalPoints'
      ? { totalPoints: user.totalPoints }
      : {}),
  }
}
