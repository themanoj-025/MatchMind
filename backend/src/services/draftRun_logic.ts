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
