export async function getNextRound(
  prisma: DatabaseClient,
  sessionId: string,
  userId: string,
): Promise<{ round: ChoiceRound | null; session: DraftSession | null; complete: boolean; error?: string }> {
  const loaded = await loadRoundContext(prisma, sessionId, userId)
  if (!loaded.ok) {
    return loaded.result
  }
  const { session, picks, nextSlot, slotPosition, allPlayers, excludePlayerIds, pickRecord } = loaded.ctx
  if (pickRecord && pickRecord.pickedPlayerId == null && !pickRecord.autoPicked) {
    // This round was already generated — check if timer expired
    const roundCreatedAt = pickRecord.pickedAt ? new Date(pickRecord.pickedAt).getTime() : Date.now()
    const expiresAtTime = roundCreatedAt + DRAFT.PICK_TIMER_SECONDS * 1000
    return resolveExistingRound({ prisma, session, allPlayers }, pickRecord, nextSlot, expiresAtTime)
  }
  // Generate new round
  const round = generateChoiceRound(slotPosition, excludePlayerIds, allPlayers)
  // Deduplication check (§1.11): ensure no identical 3-player set was already offered
  if (isDuplicateOffer(picks, round)) {
    rerollDuplicateOffer(round, allPlayers, excludePlayerIds, slotPosition)
  }
  // Create or update the pick record
  const now = new Date()
  const expiresAt = new Date(now.getTime() + DRAFT.PICK_TIMER_SECONDS * 1000)
  await persistOfferedRound({ prisma, sessionId, nextSlot, slotPosition }, pickRecord, round, now)
  return {
    round: {
      slotIndex: nextSlot,
      position: slotPosition,
      playerIds: round.offeredPlayerIds,
      players: round.players,
      expiresAt: expiresAt.toISOString(),
    },
    session,
    complete: false,
  }
}

interface PersistOfferedRoundContext {
  prisma: DatabaseClient
  sessionId: string
  nextSlot: number
  slotPosition: string
}

async function persistOfferedRound(
  ctx: PersistOfferedRoundContext,
  pickRecord: DraftPick | undefined,
  round: { offeredPlayerIds: string[]; offeredRarities: string[] },
  now: Date,
): Promise<void> {
  const { prisma, sessionId, nextSlot, slotPosition } = ctx
  if (pickRecord) {
    await prisma.draftPick.update({
      where: { id: pickRecord.id },
      data: {
        offeredPlayerIds: round.offeredPlayerIds,
        offeredRarities: round.offeredRarities,
        pickedAt: now.toISOString(),
      },
    })
  } else {
    await prisma.draftPick.create({
      data: {
        draftSessionId: sessionId,
        slotIndex: nextSlot,
        position: slotPosition,
        offeredPlayerIds: round.offeredPlayerIds,
        offeredRarities: round.offeredRarities,
        pickedPlayerId: null,
        autoPicked: false,
        pickedAt: now.toISOString(),
      },
    })
  }
}
// ─── Post-pick progression: filled-check + next round ──
async function afterPick(
  prisma: DatabaseClient,
  session: DraftSession,
  sessionId: string,
  userId: string,
): Promise<{
  success: boolean
  nextRound?: ChoiceRound | null
  session?: DraftSession
  complete?: boolean
  error?: string
}> {
  const formationDef = getFormation(session.formation)
  if (!formationDef) {return { success: false, error: 'Invalid formation' }}
  const totalSlots = formationDef.slots.reduce((sum, s) => sum + s.count, 0) + formationDef.benchSlots
  const updatedPicks = (await prisma.draftPick.findMany({
    where: { draftSessionId: sessionId },
  })) as DraftPick[]
  const filledSlots = updatedPicks.filter((p) => p.pickedPlayerId != null).length
  const allFilled = filledSlots >= totalSlots
  if (allFilled) {
    // Don't auto-commit — user must manually commit
    return { success: true, nextRound: null, session: session ?? undefined, complete: true }
  }
  // Return next round
  const nextResult = await getNextRound(prisma, sessionId, userId)
  return {
    success: true,
    nextRound: nextResult.round,
    session: nextResult.session ?? undefined,
    complete: nextResult.complete,
  }
}

// ─── Process Pick (§1.4) ────────────────────────────────
export async function processPick(
  prisma: DatabaseClient,
  sessionId: string,
  userId: string,
  slotIndex: number,
  pickedPlayerId: string,
): Promise<{
  success: boolean
  nextRound?: ChoiceRound | null
  session?: DraftSession
  complete?: boolean
  error?: string
}> {
  const session = (await prisma.draftSession.findUnique({ where: { id: sessionId } })) as DraftSession | null
  if (!session) {return { success: false, error: 'Session not found' }}
  if (session.userId !== userId) {return { success: false, error: 'Not your draft session' }}
  if (session.status !== 'DRAFTING') {return { success: false, error: 'Session is not in DRAFTING status' }}
  // Find the pick record
  const picks = (await prisma.draftPick.findMany({
    where: { draftSessionId: sessionId },
  })) as DraftPick[]
  const pick = picks.find((p) => p.slotIndex === slotIndex)
  if (!pick) {return { success: false, error: `No round exists for slot ${slotIndex}` }}
  if (pick.pickedPlayerId != null) {return { success: false, error: 'This slot has already been picked' }}
  // Validate the picked player was offered
  if (!pick.offeredPlayerIds.includes(pickedPlayerId)) {
    return { success: false, error: 'Player was not offered in this round' }
  }
  // Check if the pick timer has expired (anti-cheat: always server-authoritative)
  if (pick.pickedAt) {
    const roundCreatedAt = new Date(pick.pickedAt).getTime()
    const expiresAt = roundCreatedAt + DRAFT.PICK_TIMER_SECONDS * 1000
    if (Date.now() >= expiresAt) {
      // Timer expired — auto-pick highest rarity
      const highestRarityIdx = findHighestRarityIndex(pick.offeredRarities)
      const autoPickPlayerId = pick.offeredPlayerIds[highestRarityIdx]
      await prisma.draftPick.update({
        where: { id: pick.id },
        data: {
          pickedPlayerId: autoPickPlayerId,
          autoPicked: true,
          pickedAt: new Date().toISOString(),
        },
      })
      logger.info({
        event: 'draft.auto_pick_timeout',
        sessionId,
        slotIndex,
        autoPickPlayerId,
        reason: 'Timer expired before user picked',
      })
      return afterPick(prisma, session, sessionId, userId)
    }
  }
  // Update the pick record
  await prisma.draftPick.update({
    where: { id: pick.id },
    data: {
      pickedPlayerId,
      autoPicked: false,
      pickedAt: new Date().toISOString(),
    },
  })
  logger.info({
    event: 'draft.pick_made',
    sessionId,
    slotIndex,
    pickedPlayerId,
    userId,
    autoPicked: false,
  })
  return afterPick(prisma, session, sessionId, userId)
}
// ─── Commit Squad (§1.2 step 5) ─────────────────────────
export async function commitSquad(
  prisma: DatabaseClient,
  sessionId: string,
  userId: string,
): Promise<{
  success: boolean
  session?: DraftSession
  synergyScore?: number
  formationBonus?: number
  squad?: SquadPlayer[]
  error?: string
}> {
  const session = (await prisma.draftSession.findUnique({ where: { id: sessionId } })) as DraftSession | null
  if (!session) {return { success: false, error: 'Session not found' }}
  if (session.userId !== userId) {return { success: false, error: 'Not your draft session' }}
  if (session.status !== 'DRAFTING') {return { success: false, error: 'Session is not in DRAFTING status' }}
  const formationDef = getFormation(session.formation)
  if (!formationDef) {return { success: false, error: 'Invalid formation' }}
  // Get all picks
  const picks = (await prisma.draftPick.findMany({
    where: { draftSessionId: sessionId },
  })) as DraftPick[]
  // Ensure all formation slots are filled
  const formationFilled = checkFormationFillBonus(picks, formationDef.slots)
  if (!formationFilled) {
    return {
      success: false,
      error: 'Not all formation slots are filled. Complete all required positions before committing.',
    }
  }
  // Build squad player list
  const squadPlayers: SquadPlayer[] = picks
    .filter((p) => p.pickedPlayerId != null)
    .map((p) => ({
      playerId: p.pickedPlayerId!,
      position: p.position,
      slotIndex: p.slotIndex,
      isAutoPicked: p.autoPicked,
      rarityTier: p.offeredRarities[p.offeredPlayerIds.indexOf(p.pickedPlayerId!)] || 'BRONZE',
    }))
  // Get all players for synergy computation
  const allPlayers = await prisma.player.findMany({
    where: { tournamentId: session.tournamentId },
  })
  // Compute synergy
  const synergyScore = computeSynergyScore(squadPlayers, allPlayers)
  // Compute formation fill bonus
  const formationBonus = formationFilled ? DRAFT.FORMATION_FILL_BONUS : 0
  // Update session
  await prisma.draftSession.update({
    where: { id: sessionId },
    data: {
      status: 'SQUAD_COMPLETE',
      synergyScore,
      formationBonusApplied: formationBonus > 0,
      completedAt: new Date().toISOString(),
    },
  })
  logger.info({
    event: 'draft.squad_committed',
    sessionId,
    userId,
    synergyScore,
    formationBonus,
    playerCount: squadPlayers.length,
  })
  return {
    success: true,
    session: {
      ...session,
      status: 'SQUAD_COMPLETE',
      synergyScore,
      formationBonusApplied: formationBonus > 0,
      completedAt: new Date().toISOString(),
    },
    synergyScore,
    formationBonus,
    squad: squadPlayers,
  }
}
// ─── Get Session State ──────────────────────────────────
export async function getSessionState(
  prisma: DatabaseClient,
  sessionId: string,
  userId: string,
): Promise<{ session: DraftSession | null; picks: DraftPick[]; squad: SquadPlayer[]; error?: string }> {
  const session = (await prisma.draftSession.findUnique({ where: { id: sessionId } })) as DraftSession | null
  if (!session) {return { session: null, picks: [], squad: [], error: 'Session not found' }}
  if (session.userId !== userId) {return { session: null, picks: [], squad: [], error: 'Not your draft session' }}
  const picks = (await prisma.draftPick.findMany({
    where: { draftSessionId: sessionId },
    orderBy: { slotIndex: 'asc' },
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
  return { session, picks, squad, error: undefined }
}
// ─── List User's Draft Sessions ─────────────────────────
export async function listUserDrafts(prisma: DatabaseClient, userId: string): Promise<DraftSession[]> {
  const sessions = await prisma.draftSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return sessions as unknown as DraftSession[]
}
// ─── Helpers ─────────────────────────────────────────────
function findHighestRarityIndex(rarities: string[]): number {
  const tierOrder: Record<string, number> = { ICON: 0, GOLD: 1, SILVER: 2, BRONZE: 3 }
  let bestIdx = 0
  let bestScore = tierOrder[rarities[0]!] ?? 99
  for (let i = 1; i < rarities.length; i++) {
    const score = tierOrder[rarities[i]!] ?? 99
    if (score < bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  return bestIdx
}