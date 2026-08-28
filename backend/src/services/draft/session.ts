export function loadFormations(): Formation[] {
  if (_formations) {return _formations}
  try {
    const fs = require('fs')
    const path = require('path')
    const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'formations.json'), 'utf-8')
    _formations = JSON.parse(raw)
  } catch (err: unknown) {
    logger.fatal(
      { event: 'draft.formations_load_failed', err: (err as Error).message },
      'Failed to load formations.json from data directory',
    )
    throw new Error(`CRITICAL_CONFIGURATION_ERROR: Formations data missing or corrupted: ${(err as Error).message}`)
  }
  return _formations!
}
export function getFormation(id: string): Formation | undefined {
  return loadFormations().find((f) => f.id === id)
}
// ─── Rarity Roll (§1.4: weighted random from packWeight distribution) ──
export function rollRarity(): RarityTierName {
  const roll = Math.random()
  let cumulative = 0
  for (const tier of RARITY_TIERS) {
    cumulative += tier.packWeight
    if (roll <= cumulative) {return tier.tier}
  }
  return 'BRONZE'
}
// ─── Generate Choice Round (§1.4) ───────────────────────
export function generateChoiceRound(
  position: string,
  excludePlayerIds: string[],
  playersByTournament: PlayerRecord[],
): {
  offeredPlayerIds: string[]
  offeredRarities: string[]
  players: ChoiceRound['players']
} {
  const offeredPlayerIds: string[] = []
  const offeredRarities: string[] = []
  const players: ChoiceRound['players'] = []
  // Filter eligible players: must match position, not already picked
  const eligible = playersByTournament.filter(
    (p) => p.position === position && !excludePlayerIds.includes(p.id) && p.basePrice != null && p.rarityTier != null,
  )
  // If not enough eligible players, relax: allow any-position for bench flex
  let pool = eligible
  if (pool.length < DRAFT.OFFERED_PLAYERS_PER_ROUND) {
    // For bench/off-role, allow nearby positions (e.g., DEF→MID flex)
    const flexPositions = getFlexPositions(position)
    pool = playersByTournament.filter(
      (p) =>
        flexPositions.includes(p.position) &&
        !excludePlayerIds.includes(p.id) &&
        p.basePrice != null &&
        p.rarityTier != null,
    )
  }
  if (pool.length === 0) {
    // Absolute fallback: return any player not already picked
    pool = playersByTournament.filter((p) => !excludePlayerIds.includes(p.id) && p.basePrice != null)
  }
  // Pick 3 distinct players, each with independently rolled rarity
  const usedIndices = new Set<number>()
  const maxAttempts = 50 // prevent infinite loop on tiny pools
  let attempts = 0
  while (offeredPlayerIds.length < DRAFT.OFFERED_PLAYERS_PER_ROUND && attempts < maxAttempts) {
    attempts++
    // Roll rarity first, then pick a matching player (or any unoffered one)
    const picked = pickOfferedPlayer(pool, usedIndices, rollRarity())
    if (!picked) {break}
    offeredPlayerIds.push(picked.player.id)
    offeredRarities.push(picked.rarity)
    players.push({
      id: picked.player.id,
      name: picked.player.name,
      position: picked.player.position,
      club: picked.player.club,
      nationality: picked.player.nationality,
      basePrice: picked.player.basePrice,
      rarityTier: picked.player.rarityTier || 'BRONZE',
      photoUrl: picked.player.photoUrl ?? undefined,
    })
  }
  // Deduplication check (§1.11): ensure no two identical 3-player sets
  // (This is checked at a higher level in the route handler)
  return { offeredPlayerIds, offeredRarities, players }
}
/**
 * Pick an unoffered player for a choice round, preferring one of the target
 * rarity but falling back to any remaining player. Returns null when the pool
 * is exhausted. Marks the chosen index as used.
 */
function pickOfferedPlayer(
  pool: PlayerRecord[],
  usedIndices: Set<number>,
  targetRarity: string,
): { player: PlayerRecord; rarity: string } | null {
  const candidates = pool.filter((_, idx) => !usedIndices.has(idx) && pool[idx]!.rarityTier === targetRarity)
  const chosen =
    candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : pool.find((_, idx) => !usedIndices.has(idx))
  if (!chosen) {
    return null
  }
  usedIndices.add(pool.indexOf(chosen))
  return { player: chosen, rarity: candidates.length > 0 ? targetRarity : chosen.rarityTier || 'BRONZE' }
}
function getFlexPositions(position: string): string[] {
  switch (position) {
    case 'GK':
      return ['GK', 'DEF']
    case 'DEF':
      return ['DEF', 'GK', 'MID']
    case 'MID':
      return ['MID', 'DEF', 'FWD']
    case 'FWD':
      return ['FWD', 'MID']
    default:
      return [position]
  }
}
// ─── Compute Synergy Score (§1.5) ───────────────────────
function clusterBonus(counts: Record<string, number>, threshold: number, perPlayer: number): number {
  let bonus = 0
  for (const count of Object.values(counts)) {
    if (count >= threshold) {
      bonus += (count - (threshold - 1)) * perPlayer
    }
  }
  return bonus
}

export function computeSynergyScore(squadPlayers: SquadPlayer[], allPlayers: PlayerRecord[]): number {
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]))
  const nationalityCounts: Record<string, number> = {}
  const clubCounts: Record<string, number> = {}
  for (const sp of squadPlayers) {
    const player = playerMap.get(sp.playerId)
    if (!player) {continue}
    if (player.nationality) {
      nationalityCounts[player.nationality] = (nationalityCounts[player.nationality] || 0) + 1
    }
    if (player.club) {
      clubCounts[player.club] = (clubCounts[player.club] || 0) + 1
    }
  }
  // Nationality: +1% per player beyond a 3-player cluster; club: +2% beyond a 2-player cluster
  let bonus = clusterBonus(nationalityCounts, DRAFT.SYNERGY_NATIONALITY_THRESHOLD, DRAFT.SYNERGY_NATIONALITY_BONUS_PER)
  bonus += clusterBonus(clubCounts, DRAFT.SYNERGY_CLUB_THRESHOLD, DRAFT.SYNERGY_CLUB_BONUS_PER)
  return Math.min(bonus, DRAFT.SYNERGY_MAX_BONUS)
}
// ─── Check Formation Fill Bonus (§1.6) ──────────────────
export function checkFormationFillBonus(picks: DraftPick[], formationSlots: FormationSlot[]): boolean {
  // Count how many positions have at least one non-bench pick
  for (const slot of formationSlots) {
    const picksInPosition = picks.filter((p) => p.position === slot.position && p.pickedPlayerId != null)
    if (picksInPosition.length < slot.count) {
      return false
    }
  }
  return true
}
// ─── Start Draft (§1.2) ─────────────────────────────────
export interface StartDraftResult {
  session: DraftSession
  nextRound: ChoiceRound | null
}
export async function startDraft(
  prisma: DatabaseClient,
  userId: string,
  tournamentId: string,
  formation: string,
  consumeTicketFn: () => Promise<{ success: boolean; remaining: number; reason?: string }>,
): Promise<{ success: boolean; session?: DraftSession; nextRound?: ChoiceRound; error?: string }> {
  // 1. Validate formation
  const formationDef = getFormation(formation)
  if (!formationDef) {
    return {
      success: false,
      error: `Invalid formation: "${formation}". Must be one of: ${loadFormations()
        .map((f) => f.id)
        .join(', ')}`,
    }
  }
  // 2. Consume ticket
  const ticketResult = await consumeTicketFn()
  if (!ticketResult.success) {
    return { success: false, error: ticketResult.reason || 'No tickets remaining' }
  }
  // 3. Create draft session
  const session = (await prisma.draftSession.create({
    data: {
      userId,
      tournamentId,
      formation,
      status: 'DRAFTING',
      synergyScore: 0,
      formationBonusApplied: false,
    },
  })) as unknown as DraftSession
  // 4. Generate the first choice round (GK first, per draft-show pacing)
  const allPlayers = await prisma.player.findMany({
    where: { tournamentId },
  })
  const firstSlot = formationDef.slots[0]!
  const firstRound = generateChoiceRound(
    firstSlot.position,
    [],
    allPlayers,
  )
  // 5. Create the first draft pick record
  const { expiresAt } = await createFirstPickRecord(prisma, session, firstSlot, firstRound)
  // 6. Load full player objects for the choice round
  const playerObjects = buildPlayerObjects(allPlayers, firstRound.offeredPlayerIds)
  logger.info({
    event: 'draft.started',
    sessionId: session.id,
    userId,
    tournamentId,
    formation,
  })
  return {
    success: true,
    session,
    nextRound: {
      slotIndex: 0,
      position: firstSlot.position,
      playerIds: firstRound.offeredPlayerIds,
      players: playerObjects,
      expiresAt: expiresAt.toISOString(),
    },
  }
}

async function createFirstPickRecord(
  prisma: DatabaseClient,
  session: DraftSession,
  firstSlot: FormationSlot,
  firstRound: { offeredPlayerIds: string[]; offeredRarities: string[] },
): Promise<{ expiresAt: Date }> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + DRAFT.PICK_TIMER_SECONDS * 1000)
  await prisma.draftPick.create({
    data: {
      draftSessionId: session.id,
      slotIndex: 0,
      position: firstSlot.position,
      offeredPlayerIds: firstRound.offeredPlayerIds,
      offeredRarities: firstRound.offeredRarities,
      pickedPlayerId: null,
      autoPicked: false,
      pickedAt: null,
    },
  })
  return { expiresAt }
}
// ─── Helpers ────────────────────────────────────────────
function findNextSlot(picks: DraftPick[], totalSlots: number): number | null {
  for (let i = 0; i < totalSlots; i++) {
    const pick = picks.find((p) => p.slotIndex === i)
    if (!pick || (pick.pickedPlayerId == null && !pick.autoPicked)) {
      return i
    }
  }
  return null
}

function positionForSlot(formationDef: Formation, nextSlot: number, picks: DraftPick[]): string {
  let accumulatedSlots = 0
  for (const slot of formationDef.slots) {
    if (nextSlot < accumulatedSlots + slot.count) {
      return slot.position
    }
    accumulatedSlots += slot.count
  }
  // Bench slots (after all formation slots): flex position based on remaining needs
  const formationPositions = formationDef.slots.flatMap((s) => Array(s.count).fill(s.position))
  const usedInPosition = picks.filter((p) => p.pickedPlayerId != null).map((p) => p.position)
  const positionNeeds: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  for (const pos of formationPositions) {
    positionNeeds[pos] = (positionNeeds[pos] || 0) + 1
  }
  for (const pos of usedInPosition) {
    if (positionNeeds[pos]) {positionNeeds[pos]--}
  }
  return Object.entries(positionNeeds).sort((a, b) => b[1] - a[1])[0]?.[0] || 'MID'
}

function buildPlayerObjects(allPlayers: PlayerRecord[], offeredPlayerIds: string[]): ChoiceRound['players'] {
  return offeredPlayerIds
    .map((pid) => {
      const p = allPlayers.find((ap) => ap.id === pid)
      return p
        ? {
            id: p.id,
            name: p.name,
            position: p.position,
            club: p.club,
            nationality: p.nationality,
            basePrice: p.basePrice,
            rarityTier: p.rarityTier || 'BRONZE',
            photoUrl: p.photoUrl,
          }
        : null
    })
    .filter(Boolean) as ChoiceRound['players']
}

function isDuplicateOffer(picks: DraftPick[], round: { offeredPlayerIds: string[] }): boolean {
  const previousPicks = picks.filter((p) => p.offeredPlayerIds.length === 3)
  return previousPicks.some(
    (p) =>
      p.offeredPlayerIds.every((id) => round.offeredPlayerIds.includes(id)) &&
      round.offeredPlayerIds.every((id) => p.offeredPlayerIds.includes(id)),
  )
}

function rerollDuplicateOffer(
  round: { offeredPlayerIds: string[]; offeredRarities: string[]; players: ChoiceRound['players'] },
  allPlayers: PlayerRecord[],
  excludePlayerIds: string[],
  slotPosition: string,
): void {
  // Re-roll by swapping the last offered player
  const replacement = allPlayers.find(
    (p) =>
      !round.offeredPlayerIds.includes(p.id) && !excludePlayerIds.includes(p.id) && p.position === slotPosition,
  )
  if (!replacement) {return}
  round.offeredPlayerIds[2] = replacement.id
  round.offeredRarities[2] = replacement.rarityTier || 'BRONZE'
  round.players[2] = {
    id: replacement.id,
    name: replacement.name,
    position: replacement.position,
    club: replacement.club,
    nationality: replacement.nationality,
    basePrice: replacement.basePrice,
    rarityTier: replacement.rarityTier || 'BRONZE',
    photoUrl: replacement.photoUrl ?? undefined,
  }
}

interface ExistingRoundContext {
  prisma: DatabaseClient
  session: DraftSession
  allPlayers: PlayerRecord[]
}

async function resolveExistingRound(
  ctx: ExistingRoundContext,
  pickRecord: DraftPick,
  nextSlot: number,
  expiresAtTime: number,
): Promise<{ round: ChoiceRound | null; session: DraftSession | null; complete: boolean; error?: string }> {
  const { prisma, session } = ctx
  if (Date.now() >= expiresAtTime) {
    // Auto-pick: choose the highest-rarity offered player
    const highestRarityIdx = findHighestRarityIndex(pickRecord.offeredRarities)
    const autoPickPlayerId = pickRecord.offeredPlayerIds[highestRarityIdx]
    await prisma.draftPick.update({
      where: { id: pickRecord.id },
      data: {
        pickedPlayerId: autoPickPlayerId,
        autoPicked: true,
        pickedAt: new Date().toISOString(),
      },
    })
    // Return next round
    return getNextRound(prisma, session.id, session.userId)
  }
  // Timer still running — return existing round
  const existingPlayers = buildPlayerObjects(ctx.allPlayers, pickRecord.offeredPlayerIds)
  const newExpiresAt = new Date(expiresAtTime).toISOString()
  return {
    round: {
      slotIndex: nextSlot,
      position: pickRecord.position,
      playerIds: pickRecord.offeredPlayerIds,
      players: existingPlayers,
      expiresAt: newExpiresAt,
    },
    session,
    complete: false,
  }
}

interface RoundContext {
  session: DraftSession
  picks: DraftPick[]
  nextSlot: number
  slotPosition: string
  allPlayers: PlayerRecord[]
  excludePlayerIds: string[]
  pickRecord: DraftPick | undefined
}

type RoundContextResult =
  | { ok: true; ctx: RoundContext }
  | { ok: false; result: { round: null; session: DraftSession | null; complete: boolean; error?: string } }

/**
 * Load the session and derive the next unfilled slot, or return the
 * terminal/error result when the draft cannot continue.
 */
async function loadRoundContext(
  prisma: DatabaseClient,
  sessionId: string,
  userId: string,
): Promise<RoundContextResult> {
  const session = (await prisma.draftSession.findUnique({ where: { id: sessionId } })) as DraftSession | null
  if (!session) {
    return { ok: false, result: { round: null, session: null, complete: false, error: 'Session not found' } }
  }
  if (session.userId !== userId) {
    return { ok: false, result: { round: null, session: null, complete: false, error: 'Not your draft session' } }
  }
  if (session.status !== 'DRAFTING') {
    return { ok: false, result: { round: null, session, complete: session.status === 'SQUAD_COMPLETE', error: undefined } }
  }
  const formationDef = getFormation(session.formation)
  if (!formationDef) {
    return { ok: false, result: { round: null, session, complete: false, error: 'Invalid formation' } }
  }
  // Get all picks for this session
  const picks = (await prisma.draftPick.findMany({
    where: { draftSessionId: sessionId },
    orderBy: { slotIndex: 'asc' },
  })) as DraftPick[]
  // Find the first unfilled slot
  const totalSlots = formationDef.slots.reduce((sum, s) => sum + s.count, 0) + formationDef.benchSlots
  const nextSlot = findNextSlot(picks, totalSlots)
  if (nextSlot === null) {
    // All slots filled — session is squad complete (but not yet committed)
    return { ok: false, result: { round: null, session, complete: true, error: undefined } }
  }
  // Determine position for this slot
  const slotPosition = positionForSlot(formationDef, nextSlot, picks)
  // Get all players for this tournament
  const allPlayers = (await prisma.player.findMany({
    where: { tournamentId: session.tournamentId },
  })) as PlayerRecord[]
  // Build exclusion list (already picked in this session)
  const excludePlayerIds = picks.filter((p) => p.pickedPlayerId != null).map((p) => p.pickedPlayerId!)
  // Check if a pick record already exists for this slot (was started but not completed)
  const pickRecord = picks.find((p) => p.slotIndex === nextSlot)
  return {
    ok: true,
    ctx: { session, picks, nextSlot, slotPosition, allPlayers, excludePlayerIds, pickRecord },
  }
}

// ─── Get Next Choice Round ──────────────────────────────
