import type { DraftRunResult, DraftRunRound, DraftRunState, RunOutcome } from './draftRun_types'
import type { DatabaseClient } from '../repositories'
import logger from '../utils/logger'
import { DRAFT, RUN_REWARD_TIERS } from '../config/constants'
import { BENCHMARK_SCORE_BASE, BENCHMARK_VARIANCE } from './draftRun_types'

type DraftSession = { id: string; userId: string; tournamentId: string; status: string; synergyScore?: number }
type DraftPick = { draftSessionId: string; pickedPlayerId: string | null; position: string; slotIndex: number; autoPicked: boolean; offeredRarities: string[]; offeredPlayerIds: string[] }
type SquadPlayer = { playerId: string; position: string; slotIndex: number; isAutoPicked: boolean; rarityTier: string }
type DraftRunStatus = 'WAITING_FOR_MATCHDAY' | 'COMPLETE'

function computeApproximatePoints(stats: { totalPoints?: number; goals?: number; assists?: number; minutesPlayed?: number }, position: string): number {
  if (stats.totalPoints) return stats.totalPoints
  return (stats.goals || 0) * 6 + (stats.assists || 0) * 3 + Math.floor((stats.minutesPlayed || 0) / 90)
}

async function computeSquadPoints(
  prisma: DatabaseClient,
  squad: SquadPlayer[],
  statsMap: Map<string, { playerId: string; totalPoints?: number; goals?: number; assists?: number; minutesPlayed?: number }>,
  playerMap: Map<string, { id: string; position: string | null }>,
  fixtureId: string,
): Promise<{ userSquadPoints: number; breakdown: Record<string, number> }> {
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
      where: { playerId: sp.playerId, fixtureId },
    })

    if (ledgerEntries && ledgerEntries.length > 0) {
      const points = ledgerEntries.reduce((sum: number, e) => sum + e.totalPoints, 0)
      userSquadPoints += points
      breakdown[sp.playerId] = points
    } else {
      // Fallback: compute approximate fantasy points from raw stats
      const player = playerMap.get(sp.playerId)
      const position = player?.position || sp.position
      const points = computeApproximatePoints(stats, position)
      userSquadPoints += points
      breakdown[sp.playerId] = points
    }
  }
  return { userSquadPoints, breakdown }
}

function determineRunOutcome(userSquadPoints: number, benchmarkPoints: number): RunOutcome {
  const margin = userSquadPoints - benchmarkPoints
  if (margin > 5) {
    return 'WIN'
  }
  if (margin < -5) {
    return 'LOSS'
  }
  return 'TIE'
}

function determineRunStatus(
  newWins: number,
  newLosses: number,
): { newStatus: DraftRunStatus; eliminatedAt: string | null; clearedAt: string | null } {
  if (newLosses >= DRAFT.MAX_LOSSES) {
    return { newStatus: 'COMPLETE', eliminatedAt: new Date().toISOString(), clearedAt: null }
  }
  if (newWins >= DRAFT.MAX_WINS) {
    return { newStatus: 'COMPLETE', eliminatedAt: null, clearedAt: new Date().toISOString() }
  }
  return { newStatus: 'WAITING_FOR_MATCHDAY', eliminatedAt: null, clearedAt: null }
}

async function synergyMultiplierFor(prisma: DatabaseClient, sessionId: string, currentRound: number): Promise<number> {
  const synergyScore =
    currentRound > 0
      ? (await prisma.draftSession.findUnique({ where: { id: sessionId } }))?.synergyScore ?? 0
      : 0
  return 1 + synergyScore / 100
}

async function loadFixtureContext(
  prisma: DatabaseClient,
  fixture: { id: string },
  tournamentId: string,
): Promise<{
  playerStats: Array<{ playerId: string }>
  playerMap: Map<string, { id: string; position: string | null }>
  statsMap: Map<string, { playerId: string }>
}> {
  // Get player match stats for this fixture
  const playerStats = await prisma.playerMatchStat.findMany({
    where: { fixtureId: fixture.id },
  })
  // Get all players for this tournament to look up positions
  const allPlayers = await prisma.player.findMany({
    where: { tournamentId },
  })
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]))
  const statsMap = new Map(playerStats.map((s) => [s.playerId, s]))
  return { playerStats, playerMap, statsMap }
}

function outcomeTotals(result: DraftRunResult, outcome: RunOutcome) {
  return {
    newWins: result.totalWins + (outcome === 'WIN' ? 1 : 0),
    newLosses: result.totalLosses + (outcome === 'LOSS' ? 1 : 0),
    newTies: result.totalTies + (outcome === 'TIE' ? 1 : 0),
  }
}

function logRoundResolved(
  sessionId: string,
  roundEntry: DraftRunRound,
  data: {
    outcome: RunOutcome
    userSquadPoints: number
    benchmarkPoints: number
    newWins: number
    newLosses: number
    eliminatedAt: string | null
    clearedAt: string | null
  },
): void {
  logger.info({
    event: 'draft_run.round_resolved',
    sessionId,
    roundNumber: roundEntry.roundNumber,
    outcome: data.outcome,
    userPoints: data.userSquadPoints,
    benchmarkPoints: data.benchmarkPoints,
    newWins: data.newWins,
    newLosses: data.newLosses,
    eliminated: !!data.eliminatedAt,
    cleared: !!data.clearedAt,
  })
}

function buildRoundEntry(
  fixture: { id: string },
  roundNumber: number,
  outcome: RunOutcome,
  points: { userPoints: number; benchmarkPoints: number; breakdown: Record<string, number> },
): DraftRunRound {
  return {
    roundNumber,
    matchdayId: fixture.id,
    matchdayName: `Matchday ${roundNumber}`,
    outcome,
    userPoints: points.userPoints,
    benchmarkPoints: points.benchmarkPoints,
    breakdown: points.breakdown,
  }
}

interface RoundOutcome {
  roundEntry: DraftRunRound
  newWins: number
  newLosses: number
  newTies: number
  newStatus: DraftRunStatus
  earnedRewards: string[]
  eliminatedAt: string | null
  clearedAt: string | null
}

async function persistRoundOutcome(
  prisma: DatabaseClient,
  result: DraftRunResult,
  sessionId: string,
  outcome: RoundOutcome,
): Promise<void> {
  const updatedRounds = [...(result.rounds || []), outcome.roundEntry]
  await prisma.draftRunResult.update({
    where: { id: result.id },
    data: {
      currentRound: outcome.roundEntry.roundNumber,
      totalWins: outcome.newWins,
      totalLosses: outcome.newLosses,
      totalTies: outcome.newTies,
      status: outcome.newStatus,
      rewards: [...new Set([...result.rewards, ...outcome.earnedRewards])],
      rounds: updatedRounds,
      eliminatedAt: outcome.eliminatedAt,
      clearedAt: outcome.clearedAt,
      updatedAt: new Date().toISOString(),
    },
  })
  // If run is complete, update session status
  await completeSessionIfDone(prisma, sessionId, outcome.newStatus)
}

function rewardsEarnedFor(newWins: number, previousWins: number): string[] {
  return RUN_REWARD_TIERS.filter((t) => newWins >= t.minWins && previousWins < t.minWins).map((t) => t.id)
}

async function completeSessionIfDone(prisma: DatabaseClient, sessionId: string, newStatus: DraftRunStatus): Promise<void> {
  // If run is complete, update session status
  if (newStatus !== 'COMPLETE') {
    return
  }
  await prisma.draftSession.update({
    where: { id: sessionId },
    data: { status: 'RUN_COMPLETE' },
  })
}

// ─── Resolve Next Round ─────────────────────────────────

interface ResolveNextRoundResult {
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
}

async function resolveNextRound(
  prisma: DatabaseClient,
  result: DraftRunResult,
  squad: SquadPlayer[],
  sessionId: string,
  fixture: { id: string; tournamentId: string },
): Promise<ResolveNextRoundResult | null> {
  try {
    // Get player match stats + player map for this fixture
    const { playerStats, playerMap, statsMap } = await loadFixtureContext(prisma, fixture, result.tournamentId)

    if (!playerStats || playerStats.length === 0) {
      logger.warn({
        event: 'draft_run.no_stats',
        fixtureId: fixture.id,
        sessionId,
      })
      return null
    }

    // Compute fantasy points for each squad player using real match stats
    const { userSquadPoints: rawSquadPoints, breakdown } = await computeSquadPoints(
      prisma,
      squad,
      statsMap,
      playerMap,
      fixture.id,
    )

    // Apply synergy bonus as percentage boost
    const synergyMultiplier = await synergyMultiplierFor(prisma, sessionId, result.currentRound)
    const userSquadPoints = Math.round(rawSquadPoints * synergyMultiplier)

    // Generate benchmark score: base + variance
    const benchmarkPoints = BENCHMARK_SCORE_BASE + Math.round((Math.random() * 2 - 1) * BENCHMARK_VARIANCE)

    // Determine outcome
    const outcome = determineRunOutcome(userSquadPoints, benchmarkPoints)
    const { newWins, newLosses, newTies } = outcomeTotals(result, outcome)

    // Check elimination / full clear
    const { newStatus, eliminatedAt, clearedAt } = determineRunStatus(newWins, newLosses)

    // Compute rewards earned
    const earnedRewards = rewardsEarnedFor(newWins, result.totalWins)

    // Save round to DB as sub-document within the result
    const roundEntry = buildRoundEntry(fixture, result.currentRound + 1, outcome, {
      userPoints: userSquadPoints,
      benchmarkPoints,
      breakdown,
    })

    // Update the DraftRunResult (include rounds as sub-document) and, if complete, the session
    await persistRoundOutcome(prisma, result, sessionId, {
      roundEntry,
      newWins,
      newLosses,
      newTies,
      newStatus,
      earnedRewards,
      eliminatedAt,
      clearedAt,
    })

    logRoundResolved(sessionId, roundEntry, {
      outcome,
      userSquadPoints,
      benchmarkPoints,
      newWins,
      newLosses,
      eliminatedAt,
      clearedAt,
    })

    return {
      roundNumber: roundEntry.roundNumber,
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
  } catch (err: unknown) {
    logger.error({
      event: 'draft_run.resolve_error',
      sessionId,
      fixtureId: fixture?.id,
      error: (err as Error).message,
    })
    return null
  }
}
