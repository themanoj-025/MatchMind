/**
 * Draft Run Service — MatchMind v4 §2
 *
 * Post-draft competitive phase: takes a committed squad through matchday
 * rounds where fantasy points are compared against a benchmark. Tracks
 * wins/losses/ties, enforces 3-loss elimination, and awards cosmetic
 * reward tiers for 5-win full clears.
 *
 * Matchday resolution flow:
 *   1. Admin finalizes a fixture → `playerMatchStat` records are created
 *   2. System detects completed fixtures for the squad's tournament
 *   3. Computes fantasy points for each squad player from real match stats
 *   4. Compares total squad fantasy points against a benchmark score
 *   5. Records win/loss/tie, advances the DraftRun state
 *
 * If no fixture data exists yet, the run returns a "WAITING_FOR_MATCHDAY"
 * status — the user polls later when real matches have been played.
 */

import { DRAFT, RUN_REWARD_TIERS } from '../config/constants'
import type { DraftSession, DraftPick, SquadPlayer } from './draftService'
import logger from '../utils/logger'

// ─── Types ───────────────────────────────────────────────

export type DraftRunStatus = 'IN_PROGRESS' | 'WAITING_FOR_MATCHDAY' | 'COMPLETE'
export type RunOutcome = 'WIN' | 'LOSS' | 'TIE'

export interface DraftRunResult {
  id: string
  draftSessionId: string
  userId: string
  tournamentId: string
  currentRound: number // which matchday round (0-indexed)
  totalWins: number
  totalLosses: number
  totalTies: number
  status: DraftRunStatus
  rewards: string[] // cosmetic reward IDs earned
  rounds: DraftRunRound[] // resolved round history (sub-document)
  eliminatedAt: string | null // date when 3rd loss occurred
  clearedAt: string | null // date when 5th win occurred
  createdAt: string
  updatedAt: string
}

export interface DraftRunRound {
  roundNumber: number
  matchdayId: string | null // the fixture/matchday ID (null if no real match yet)
  matchdayName: string | null // e.g. "Matchday 1"
  outcome: RunOutcome | null // null if matchday not yet resolved
  userPoints: number
  benchmarkPoints: number
  breakdown: Record<string, number> // per-player fantasy point breakdown
}

export interface DraftRunState {
  result: DraftRunResult
  rounds: DraftRunRound[]
  squad: SquadPlayer[]
  currentRound: DraftRunRound | null
  isEliminated: boolean
  isFullClear: boolean
  nextMatchdayLabel: string | null
}

const BENCHMARK_SCORE_BASE = 45 // average fantasy points for a full squad
const BENCHMARK_VARIANCE = 15 // ± random variance

// ─── Enter Run (§2.1) ───────────────────────────────────

export async function enterRun(
  prisma: any,
  sessionId: string,
  userId: string,
): Promise<{ success: boolean; result?: DraftRunResult; error?: string }> {
  const session = (await prisma.draftSession.findUnique({ where: { id: sessionId } })) as DraftSession | null
  if (!session) {
    return { success: false, error: 'Session not found' }
  }
  if (session.userId !== userId) {
    return { success: false, error: 'Not your draft session' }
  }
  if (session.status !== 'SQUAD_COMPLETE') {
    return {
      success: false,
      error: `Session status must be SQUAD_COMPLETE to enter a run (current: ${session.status})`,
    }
  }

  // Check if a run already exists for this session
  const existingRun = (await prisma.draftRunResult.findFirst({
    where: { draftSessionId: sessionId },
  })) as DraftRunResult | null

  if (existingRun) {
    return { success: false, error: 'A Draft Run already exists for this session. Check run-status to continue.' }
  }

  // Create the Draft Run result
  const now = new Date().toISOString()
  const result = (await prisma.draftRunResult.create({
    data: {
      draftSessionId: sessionId,
      userId,
      tournamentId: session.tournamentId,
      currentRound: 0,
      totalWins: 0,
      totalLosses: 0,
      totalTies: 0,
      status: 'WAITING_FOR_MATCHDAY',
      rewards: ['participant'],
      rounds: [],
      eliminatedAt: null,
      clearedAt: null,
      createdAt: now,
      updatedAt: now,
    },
  })) as DraftRunResult

  // Update session status
  await prisma.draftSession.update({
    where: { id: sessionId },
    data: { status: 'RUN_IN_PROGRESS' },
  })

  logger.info({
    event: 'draft_run.entered',
    sessionId,
    userId,
    tournamentId: session.tournamentId,
  })

  return { success: true, result }
}

// ─── Get Run Status (§2.3) — PURE read-only ────────────

export async function getRunStatus(
  prisma: any,
  sessionId: string,
  userId: string,
): Promise<{ success: boolean; state?: DraftRunState; error?: string }> {
  const session = (await prisma.draftSession.findUnique({ where: { id: sessionId } })) as DraftSession | null
  if (!session) {
    return { success: false, error: 'Session not found' }
  }
  if (session.userId !== userId) {
    return { success: false, error: 'Not your draft session' }
  }

  const result = (await prisma.draftRunResult.findFirst({
    where: { draftSessionId: sessionId },
  })) as DraftRunResult | null

  if (!result) {
    return { success: false, error: 'No Draft Run found for this session. Enter a run first.' }
  }

  // Get picks for squad info
  const picks = (await prisma.draftPick.findMany({
    where: { draftSessionId: sessionId },
  })) as DraftPick[]

  const squad: SquadPlayer[] = picks
    .filter((p) => p.pickedPlayerId != null)
    .map((p) => ({
      playerId: p.pickedPlayerId!,
      position: p.position,
      slotIndex: p.slotIndex,
      isAutoPicked: p.autoPicked,
      rarityTier: p.offeredRarities[p.offeredPlayerIds.indexOf(p.pickedPlayerId!)] || 'BRONZE',
    }))

  const isEliminated = result.totalLosses >= DRAFT.MAX_LOSSES && result.status === 'COMPLETE'
  const isFullClear = result.totalWins >= DRAFT.MAX_WINS && result.status === 'COMPLETE'

  // Build current round info from result's internal rounds array
  let currentRound: DraftRunRound | null = null
  const rounds = result.rounds || []

  if (rounds.length > 0) {
    const lastRound = rounds[rounds.length - 1]
    currentRound = {
      // @ts-ignore
      roundNumber: lastRound.roundNumber,
      // @ts-ignore
      matchdayId: lastRound.matchdayId,
      // @ts-ignore
      matchdayName: lastRound.matchdayName,
      // @ts-ignore
      outcome: lastRound.outcome,
      // @ts-ignore
      userPoints: lastRound.userPoints,
      // @ts-ignore
      benchmarkPoints: lastRound.benchmarkPoints,
      // @ts-ignore
      breakdown: lastRound.breakdown || {},
    }
  }

  // Next matchday label
  const nextMatchdayLabel =
    result.status === 'WAITING_FOR_MATCHDAY' && !isEliminated && !isFullClear
      ? `Waiting for Matchday ${result.currentRound + 1}`
      : null

  return {
    success: true,
    state: {
      result,
      rounds,
      squad,
      currentRound,
      isEliminated,
      isFullClear,
      nextMatchdayLabel,
    },
  }
}

// ─── Resolve Next Matchday (§2.2) — EXPLICIT POST ──────

export async function resolveNextMatchday(
  prisma: any,
  sessionId: string,
  userId: string,
): Promise<{
  success: boolean
  state?: DraftRunState
  round?: DraftRunRound
  error?: string
}> {
  const session = (await prisma.draftSession.findUnique({ where: { id: sessionId } })) as DraftSession | null
  if (!session) {
    return { success: false, error: 'Session not found' }
  }
  if (session.userId !== userId) {
    return { success: false, error: 'Not your draft session' }
  }

  const result = (await prisma.draftRunResult.findFirst({
    where: { draftSessionId: sessionId },
  })) as DraftRunResult | null

  if (!result) {
    return { success: false, error: 'No Draft Run found for this session. Enter a run first.' }
  }

  if (result.status === 'COMPLETE') {
    return { success: false, error: 'Draft Run is already complete.' }
  }

  // Get picks for squad info
  const picks = (await prisma.draftPick.findMany({
    where: { draftSessionId: sessionId },
  })) as DraftPick[]

  const squad: SquadPlayer[] = picks
    .filter((p) => p.pickedPlayerId != null)
    .map((p) => ({
      playerId: p.pickedPlayerId!,
      position: p.position,
      slotIndex: p.slotIndex,
      isAutoPicked: p.autoPicked,
      rarityTier: p.offeredRarities[p.offeredPlayerIds.indexOf(p.pickedPlayerId!)] || 'BRONZE',
    }))

  // Find completed fixtures that haven't been processed
  const unresolvedFixtures = await findUnresolvedFixtures(prisma, session.tournamentId, result.currentRound)

  if (unresolvedFixtures.length === 0) {
    return {
      success: false,
      error: 'No completed fixtures available to resolve. Waiting for matchday data.',
    }
  }

  // Process the next matchday round
  const outcome = await resolveNextRound(prisma, result, squad, sessionId, unresolvedFixtures[0])

  if (!outcome) {
    return {
      success: false,
      error: 'Failed to resolve matchday round. Check logs for details.',
    }
  }

  // Read the updated result from DB
  const updatedResult = (await prisma.draftRunResult.findFirst({
    where: { draftSessionId: sessionId },
  })) as DraftRunResult | null

  if (!updatedResult) {
    return { success: false, error: 'Run result lost after resolution — unexpected.' }
  }

  const resolvedRound: DraftRunRound = {
    roundNumber: outcome.roundNumber,
    matchdayId: unresolvedFixtures[0].id,
    matchdayName: unresolvedFixtures[0].name || `Matchday ${outcome.roundNumber}`,
    outcome: outcome.newWins > result.totalWins ? 'WIN' : outcome.newLosses > result.totalLosses ? 'LOSS' : 'TIE',
    userPoints: outcome.userPoints ?? 0,
    benchmarkPoints: outcome.benchmarkPoints ?? 0,
    breakdown: outcome.breakdown || {},
  }

  const isEliminated = updatedResult.totalLosses >= DRAFT.MAX_LOSSES && updatedResult.status === 'COMPLETE'
  const isFullClear = updatedResult.totalWins >= DRAFT.MAX_WINS && updatedResult.status === 'COMPLETE'

  return {
    success: true,
    round: resolvedRound,
    state: {
      result: updatedResult,
      rounds: (updatedResult.rounds || []).concat(resolvedRound),
      squad,
      currentRound: resolvedRound,
      isEliminated,
      isFullClear,
      nextMatchdayLabel:
        updatedResult.status === 'WAITING_FOR_MATCHDAY'
          ? `Waiting for Matchday ${updatedResult.currentRound + 1}`
          : null,
    },
  }
}

// ─── Find Unresolved Fixtures ────────────────────────────

async function findUnresolvedFixtures(prisma: any, tournamentId: string, processedRoundCount: number): Promise<any[]> {
  // Find FINISHED fixtures for this tournament that haven't been resolved yet
  const fixtures = await prisma.fixture.findMany({
    where: { tournamentId, status: 'FINISHED' },
    orderBy: { scheduledAt: 'asc' },
    take: 10,
  })

  // Skip fixtures already processed (past the current round)
  return fixtures.slice(processedRoundCount)
}

// ─── Resolve Next Round ─────────────────────────────────

async function resolveNextRound(
  prisma: any,
  result: DraftRunResult,
  squad: SquadPlayer[],
  sessionId: string,
  fixture: any,
): Promise<{
  roundNumber: number
  newWins: number
  newLosses: number
  newTies: number
  newStatus: DraftRunStatus
  eliminatedAt: string | null
  clearedAt: string | null
  rewards: string[]
  userPoints: number
  benchmarkPoints: number
  breakdown: Record<string, number>
} | null> {
  try {
    // Get player match stats for this fixture
    const playerStats = await prisma.playerMatchStat.findMany({
      where: { fixtureId: fixture.id },
    })

    if (!playerStats || playerStats.length === 0) {
      logger.warn({
        event: 'draft_run.no_stats',
        fixtureId: fixture.id,
        sessionId,
      })
      return null
    }

    // Get all players for this tournament to look up positions
    const allPlayers = await prisma.player.findMany({
      where: { tournamentId: result.tournamentId },
    })
    const playerMap = new Map(allPlayers.map((p: any) => [p.id, p]))

    // Compute fantasy points for each squad player using real match stats
    const statsMap = new Map(playerStats.map((s: any) => [s.playerId, s]))

    // Also fetch fantasy points from the ledger if available
    let userSquadPoints = 0
    const breakdown: Record<string, number> = {}

    for (const sp of squad) {
      const stats = statsMap.get(sp.playerId)
      if (!stats) {
        // Player didn't play (no stats) — 0 points
        breakdown[sp.playerId] = 0
        continue
      }

      // Use the existing fantasy points engine if ledger entries exist
      const ledgerEntries = await prisma.fantasyPointsLedger.findMany({
        where: { playerId: sp.playerId, fixtureId: fixture.id },
      })

      if (ledgerEntries && ledgerEntries.length > 0) {
        const points = ledgerEntries.reduce((sum: number, e: any) => sum + e.totalPoints, 0)
        userSquadPoints += points
        breakdown[sp.playerId] = points
      } else {
        // Fallback: compute approximate fantasy points from raw stats
        const player = playerMap.get(sp.playerId) as any | undefined
        const position = player?.position || sp.position
        const points = computeApproximatePoints(stats, position)
        userSquadPoints += points
        breakdown[sp.playerId] = points
      }
    }

    // Apply synergy bonus as percentage boost
    const synergyScore =
      result.currentRound > 0
        ? ((await prisma.draftSession.findUnique({ where: { id: sessionId } }))?.synergyScore ?? 0)
        : 0
    const synergyMultiplier = 1 + synergyScore / 100
    userSquadPoints = Math.round(userSquadPoints * synergyMultiplier)

    // Generate benchmark score: base + variance
    const benchmarkPoints = BENCHMARK_SCORE_BASE + Math.round((Math.random() * 2 - 1) * BENCHMARK_VARIANCE)

    // Determine outcome
    const margin = userSquadPoints - benchmarkPoints
    let outcome: RunOutcome
    if (margin > 5) {
      outcome = 'WIN'
    } else if (margin < -5) {
      outcome = 'LOSS'
    } else {
      outcome = 'TIE'
    }

    const newWins = result.totalWins + (outcome === 'WIN' ? 1 : 0)
    const newLosses = result.totalLosses + (outcome === 'LOSS' ? 1 : 0)
    const newTies = result.totalTies + (outcome === 'TIE' ? 1 : 0)

    // Check elimination / full clear
    let newStatus: DraftRunStatus = 'WAITING_FOR_MATCHDAY'
    let eliminatedAt: string | null = null
    let clearedAt: string | null = null

    if (newLosses >= DRAFT.MAX_LOSSES) {
      newStatus = 'COMPLETE'
      eliminatedAt = new Date().toISOString()
    } else if (newWins >= DRAFT.MAX_WINS) {
      newStatus = 'COMPLETE'
      clearedAt = new Date().toISOString()
    }

    // Compute rewards earned
    const earnedRewards = RUN_REWARD_TIERS.filter((t) => newWins >= t.minWins && result.totalWins < t.minWins).map(
      (t) => t.id,
    )

    // Save round to DB as sub-document within the result
    const roundNumber = result.currentRound + 1
    const roundEntry = {
      roundNumber,
      matchdayId: fixture.id,
      matchdayName: fixture.name || `Matchday ${roundNumber}`,
      outcome,
      userPoints: userSquadPoints,
      benchmarkPoints,
      breakdown,
    }

    const existingRounds = result.rounds || []
    const updatedRounds = [...existingRounds, roundEntry]

    // Update the DraftRunResult (include rounds as sub-document)
    await prisma.draftRunResult.update({
      where: { id: result.id },
      data: {
        currentRound: roundNumber,
        totalWins: newWins,
        totalLosses: newLosses,
        totalTies: newTies,
        status: newStatus,
        rewards: [...new Set([...result.rewards, ...earnedRewards])],
        rounds: updatedRounds,
        eliminatedAt,
        clearedAt,
        updatedAt: new Date().toISOString(),
      },
    })

    // If run is complete, update session status
    if (newStatus === 'COMPLETE') {
      await prisma.draftSession.update({
        where: { id: sessionId },
        data: { status: 'RUN_COMPLETE' },
      })
    }

    logger.info({
      event: 'draft_run.round_resolved',
      sessionId,
      roundNumber,
      outcome,
      userPoints: userSquadPoints,
      benchmarkPoints,
      newWins,
      newLosses,
      eliminated: !!eliminatedAt,
      cleared: !!clearedAt,
    })

    return {
      roundNumber,
      newWins,
      newLosses,
      newTies,
      newStatus,
      eliminatedAt,
      clearedAt,
      rewards: earnedRewards,
      userPoints: userSquadPoints,
      benchmarkPoints,
      breakdown,
    }
  } catch (err: any) {
    logger.error({
      event: 'draft_run.resolve_error',
      sessionId,
      fixtureId: fixture?.id,
      error: (err as Error).message,
    })
    return null
  }
}

// ─── Approximate Fantasy Points (fallback) ──────────────

function computeApproximatePoints(stats: any, position: string): number {
  let points = 0

  // Minutes
  if (stats.minutesPlayed >= 60) {
    points += 2
  } else if (stats.minutesPlayed > 0) {
    points += 1
  }

  // Goals by position
  const goalPoints = position === 'FWD' ? 4 : position === 'MID' ? 5 : 6
  points += (stats.goals || 0) * goalPoints

  // Assists
  points += (stats.assists || 0) * 3

  // Clean sheet (DEF/GK only, played 60+)
  if (stats.cleanSheet && stats.minutesPlayed >= 60) {
    points += position === 'DEF' || position === 'GK' ? 4 : 1
  }

  // Saves (GK)
  if (stats.saves >= 3) {
    points += Math.floor(stats.saves / 3)
  }

  // Penalty saves
  points += (stats.penaltiesSaved || 0) * 5

  // Yellow/red cards
  points -= (stats.yellowCards || 0) * 1
  points -= (stats.redCards || 0) * 3

  // Penalty miss / own goal
  points -= (stats.penaltiesMissed || 0) * 2
  points -= (stats.ownGoals || 0) * 2

  // Goals conceded (DEF/GK)
  if ((position === 'DEF' || position === 'GK') && stats.minutesPlayed > 0 && stats.goalsConceded >= 2) {
    points -= Math.floor(stats.goalsConceded / 2)
  }

  return Math.max(points, 0)
}
