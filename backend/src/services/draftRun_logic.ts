/** Draft run async logic and helper functions. */

import type { DraftRunResult, DraftRunRound, DraftRunState, RunOutcome } from './draftRun_types'
export async function enterRun(
  prisma: DatabaseClient,
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
  })) as unknown as DraftRunResult | null

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
  })) as unknown as DraftRunResult

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
  prisma: DatabaseClient,
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

  const squad = buildSquadFromPicks(picks)

  const isEliminated = result.totalLosses >= DRAFT.MAX_LOSSES && result.status === 'COMPLETE'
  const isFullClear = result.totalWins >= DRAFT.MAX_WINS && result.status === 'COMPLETE'

  // Build current round info from result's internal rounds array
  const rounds = result.rounds || []
  const currentRound = buildCurrentRound(rounds)

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
  prisma: DatabaseClient,
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

  const squad = buildSquadFromPicks(picks)

  // Find completed fixtures that haven't been processed
  const unresolvedFixtures = await findUnresolvedFixtures(prisma, session.tournamentId, result.currentRound)

  if (unresolvedFixtures.length === 0) {
    return {
      success: false,
      error: 'No completed fixtures available to resolve. Waiting for matchday data.',
    }
  }

  // Process the next matchday round
  const nextFixture = unresolvedFixtures[0]
  if (!nextFixture) {
    return {
      success: false,
      error: 'No completed fixtures available to resolve. Waiting for matchday data.',
    }
  }
  const outcome = await resolveNextRound(prisma, result, squad, sessionId, nextFixture)

  if (!outcome) {
    return {
      success: false,
      error: 'Failed to resolve matchday round. Check logs for details.',
    }
  }

  // Read the updated result from DB
  const updatedResult = (await prisma.draftRunResult.findFirst({
    where: { draftSessionId: sessionId },
  })) as unknown as DraftRunResult | null

  if (!updatedResult) {
    return { success: false, error: 'Run result lost after resolution — unexpected.' }
  }

  const resolvedRound = buildResolvedRound(outcome, result, nextFixture)

  return {
    success: true,
    round: resolvedRound,
    state: buildResolvedState(updatedResult, resolvedRound, squad),
  }
}

// ─── Find Unresolved Fixtures ────────────────────────────

function buildResolvedRound(
  outcome: { roundNumber: number; newWins: number; newLosses: number; userPoints?: number; benchmarkPoints?: number; breakdown?: Record<string, number> },
  result: DraftRunResult,
  nextFixture: { id: string },
): DraftRunRound {
  return {
    roundNumber: outcome.roundNumber,
    matchdayId: nextFixture.id,
    matchdayName: `Matchday ${outcome.roundNumber}`,
    outcome: outcome.newWins > result.totalWins ? 'WIN' : outcome.newLosses > result.totalLosses ? 'LOSS' : 'TIE',
    userPoints: outcome.userPoints ?? 0,
    benchmarkPoints: outcome.benchmarkPoints ?? 0,
    breakdown: outcome.breakdown || {},
  }
}

function buildResolvedState(updatedResult: DraftRunResult, resolvedRound: DraftRunRound, squad: SquadPlayer[]): DraftRunState {
  const isEliminated = updatedResult.totalLosses >= DRAFT.MAX_LOSSES && updatedResult.status === 'COMPLETE'
  const isFullClear = updatedResult.totalWins >= DRAFT.MAX_WINS && updatedResult.status === 'COMPLETE'
  return {
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
  }
}

function buildSquadFromPicks(picks: DraftPick[]): SquadPlayer[] {
  return picks
    .filter((p) => p.pickedPlayerId != null)
    .map((p) => ({
      playerId: p.pickedPlayerId!,
      position: p.position,
      slotIndex: p.slotIndex,
      isAutoPicked: p.autoPicked,
      rarityTier: p.offeredRarities[p.offeredPlayerIds.indexOf(p.pickedPlayerId!)] || 'BRONZE',
    }))
}

function buildCurrentRound(rounds: DraftRunRound[]): DraftRunRound | null {
  if (rounds.length === 0) {
    return null
  }
  const lastRound = rounds[rounds.length - 1]!
  return {
    roundNumber: lastRound.roundNumber,
    matchdayId: lastRound.matchdayId,
    matchdayName: lastRound.matchdayName,
    outcome: lastRound.outcome,
    userPoints: lastRound.userPoints,
    benchmarkPoints: lastRound.benchmarkPoints,
    breakdown: lastRound.breakdown || {},
  }
}

async function findUnresolvedFixtures(prisma: DatabaseClient, tournamentId: string, processedRoundCount: number) {
  // Find FINISHED fixtures for this tournament that haven't been resolved yet
  const fixtures = await prisma.fixture.findMany({
    where: { tournamentId, status: 'FINISHED' },
    orderBy: { scheduledAt: 'asc' },
    take: 10,
  })

  // Skip fixtures already processed (past the current round)
  return fixtures.slice(processedRoundCount)
}

// ─── Squad Points & Outcome Helpers ─────────────────────

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
