/**
 * Repository Layer — Type Definitions
 *
 * Defines the repository interfaces that route/service code depends on.
 * A Prisma-backed implementation satisfies each interface.
 * This enables true unit testing without spinning up Postgres.
 */

// ─── Domain Types (mirrors Prisma models) ──────────────

export interface UserData {
  id: string
  username: string
  email: string
  emailVerified: boolean
  passwordHash: string | null
  displayName: string | null
  avatar: string | null
  bannerImage: string | null
  bio: string | null
  countryCode: string | null
  role: string
  tier: string
  totalPoints: number
  weeklyPoints: number
  globalRank: number | null
  predAccuracy: number
  totalPredictions: number
  correctPredictions: number
  streakCurrent: number
  streakBest: number
  isPro: boolean
  proExpiresAt: Date | null
  createdAt: Date
  updatedAt: Date
  lastActiveAt: Date | null
  tokenVersion: number
}

export interface MatchData {
  id: string
  sport: string
  competitionId: string
  homeTeamId: string
  awayTeamId: string
  homeTeamName: string
  awayTeamName: string
  homeScore: number | null
  awayScore: number | null
  status: string
  minute: number | null
  scheduledAt: Date
  finishedAt: Date | null
  competition: string
  stadium: string | null
  season: string | null
}

export interface PredictionData {
  id: string
  userId: string
  matchId: string
  homeGoals: number
  awayGoals: number
  status: string
  pointsEarned: number | null
  pointsBreakdown: Record<string, number> | null
  lockedAt: Date | null
  scoredAt: Date | null
  createdAt: Date
  btts: boolean | null
  totalGoalsOU: string | null
  totalGoalsLine: number | null
  firstScorerId: string | null
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

// ─── Repository Interfaces ─────────────────────────────

export interface IUserRepository {
  findById(id: string): Promise<UserData | null>
  findByEmail(email: string): Promise<UserData | null>
  findByUsername(username: string): Promise<UserData | null>
  findByEmailOrUsername(email: string, username: string): Promise<UserData | null>
  create(data: {
    username: string
    email: string
    passwordHash?: string | null
    displayName?: string | null
  }): Promise<UserData>
  update(id: string, data: Partial<UserData>): Promise<UserData>
  delete(id: string): Promise<void>
  findMany(opts: {
    orderBy?: Record<string, 'asc' | 'desc'>
    take?: number
    skip?: number
    select?: Record<string, boolean>
    where?: Record<string, unknown>
  }): Promise<Partial<UserData>[]>
  count(where?: Record<string, unknown>): Promise<number>
  updateMany(where: Record<string, unknown>, data: Partial<UserData>): Promise<{ count: number }>
  updateSports(userId: string, sports: string[]): Promise<void>
  updateTeams(userId: string, teamIds: string[]): Promise<void>
  followUser(followerId: string, followingId: string): Promise<unknown>
  unfollowUser(followerId: string, followingId: string): Promise<void>
  getNotifications(userId: string, take?: number): Promise<unknown[]>
  markNotificationsRead(userId: string): Promise<void>
}

export interface IReportRepository {
  count(where?: Record<string, unknown>): Promise<number>
  findMany(opts: {
    where?: Record<string, unknown>
    orderBy?: Record<string, 'asc' | 'desc'>
    take?: number
    skip?: number
  }): Promise<unknown[]>
  update(id: string, data: Record<string, unknown>): Promise<unknown>
}

export interface IAdminLogRepository {
  create(data: {
    adminId: string
    action: string
    targetId?: string | null
    targetType?: string | null
    detail?: Record<string, unknown>
  }): Promise<unknown>
  findMany(opts: {
    orderBy?: Record<string, 'asc' | 'desc'>
    take?: number
    skip?: number
  }): Promise<unknown[]>
  count(where?: Record<string, unknown>): Promise<number>
}

export interface IMatchRepository {
  findById(id: string): Promise<MatchData | null>
  findMany(opts: {
    where?: Record<string, unknown>
    orderBy?: Record<string, 'asc' | 'desc'>
    take?: number
    skip?: number
    select?: Record<string, unknown>
  }): Promise<Partial<MatchData>[]>
  update(id: string, data: Partial<MatchData>): Promise<MatchData>
  count(where?: Record<string, unknown>): Promise<number>
}

export interface IPredictionRepository {
  findById(id: string): Promise<PredictionData | null>
  findByUserAndMatch(userId: string, matchId: string): Promise<PredictionData | null>
  findMany(opts: {
    where?: Record<string, unknown>
    orderBy?: Record<string, 'asc' | 'desc'>
    take?: number
    skip?: number
  }): Promise<PredictionData[]>
  create(data: {
    userId: string
    matchId: string
    homeGoals: number
    awayGoals: number
    status?: string
    firstScorerId?: string | null
    totalGoalsOU?: string | null
    totalGoalsLine?: number | null
    btts?: boolean | null
  }): Promise<PredictionData>
  update(id: string, data: Partial<PredictionData>): Promise<PredictionData>
  updateMany(where: { matchId?: string; status?: string }, data: Partial<PredictionData>): Promise<{ count: number }>
}

export interface ILeaderboardRepository {
  getGlobalLeaderboard(take?: number): Promise<LeaderboardEntry[]>
  getWeeklyLeaderboard(take?: number): Promise<LeaderboardEntry[]>
}
