/**
 * Draft Service — MatchMind v4 §1
 *
 * Core business logic for the Draft Mode:
 * - Start a draft (consume ticket, create session)
 * - Generate choice rounds (weighted rarity pack opening, §1.4)
 * - Process picks with auto-pick on timeout (§1.4)
 * - Compute synergy score from nationality/club clustering (§1.5)
 * - Compute formation fill bonus (§1.6)
 * - Commit squad to surface for Draft Run (Phase C)
 *
 * All state is persisted through the JSON database (prisma adapter).
 * No WebSocket dependency — REST + polling/React Query is sufficient for Draft Mode.
 */

import { DRAFT, RARITY_TIERS } from '../config/constants'
import type { RarityTierName } from '../config/constants'
import logger from '../utils/logger'

// ─── Types ───────────────────────────────────────────────

export interface FormationSlot {
  position: 'GK' | 'DEF' | 'MID' | 'FWD'
  count: number
}

export interface Formation {
  id: string
  name: string
  slots: FormationSlot[]
  benchSlots: number
}

export type DraftSessionStatus =
  | 'DRAFTING'
  | 'SQUAD_COMPLETE'
  | 'RUN_IN_PROGRESS'
  | 'RUN_COMPLETE'
  | 'ABANDONED'

export interface DraftSession {
  id: string
  userId: string
  tournamentId: string
  formation: string
  status: DraftSessionStatus
  ticketConsumedId: string
  createdAt: string
  synergyScore: number
  formationBonusApplied: boolean
  completedAt?: string
}

export interface DraftPick {
  id?: string
  draftSessionId: string
  slotIndex: number
  position: string
  offeredPlayerIds: string[]
  offeredRarities: string[]
  pickedPlayerId: string | null
  autoPicked: boolean
  pickedAt: string | null
}

export interface ChoiceRound {
  slotIndex: number
  position: string
  playerIds: string[]
  players: Array<{
    id: string
    name: string
    position: string
    club: string
    nationality: string
    basePrice: number
    rarityTier: string
    photoUrl?: string
  }>
  expiresAt: string
}

export interface SquadPlayer {
  playerId: string
  position: string
  slotIndex: number
  isAutoPicked: boolean
  rarityTier: string
}

// ─── Load Formations ────────────────────────────────────

let _formations: Formation[] | null = null

export function loadFormations(): Formation[] {
  if (_formations) return _formations
  try {
    const fs = require('fs')
    const path = require('path')
    const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'formations.json'), 'utf-8')
    _formations = JSON.parse(raw)
  } catch (err: any) {
    logger.fatal({ event: 'draft.formations_load_failed', err: (err as Error).message }, 'Failed to load formations.json from data directory')
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
    if (roll <= cumulative) return tier.tier
  }
  return 'BRONZE'
}

// ─── Generate Choice Round (§1.4) ───────────────────────

export function generateChoiceRound(
  position: string,
  excludePlayerIds: string[],
  playersByTournament: any[],
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
    (p) =>
      p.position === position &&
      !excludePlayerIds.includes(p.id) &&
      p.basePrice != null &&
      p.rarityTier != null,
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
    pool = playersByTournament.filter(
      (p) => !excludePlayerIds.includes(p.id) && p.basePrice != null,
    )
  }

  // Pick 3 distinct players, each with independently rolled rarity
  const usedIndices = new Set<number>()
  const maxAttempts = 50 // prevent infinite loop on tiny pools
  let attempts = 0

  while (offeredPlayerIds.length < DRAFT.OFFERED_PLAYERS_PER_ROUND && attempts < maxAttempts) {
    attempts++

    // Roll rarity first
    const targetRarity = rollRarity()

    // Find a player of that rarity from the pool who hasn't been offered
    const candidates = pool.filter(
      (_, idx) => !usedIndices.has(idx) && pool[idx].rarityTier === targetRarity,
    )

    if (candidates.length === 0) {
      // Rarity not available — fall back to any eligible player
      const anyCandidate = pool.find((_, idx) => !usedIndices.has(idx))
      if (!anyCandidate) break
      const idx = pool.indexOf(anyCandidate)
      usedIndices.add(idx)
      offeredPlayerIds.push(anyCandidate.id)
      offeredRarities.push(anyCandidate.rarityTier || 'BRONZE')
      players.push({
        id: anyCandidate.id,
        name: anyCandidate.name,
        position: anyCandidate.position,
        club: anyCandidate.club,
        nationality: anyCandidate.nationality,
        basePrice: anyCandidate.basePrice,
        rarityTier: anyCandidate.rarityTier || 'BRONZE',
        photoUrl: anyCandidate.photoUrl,
      })
    } else {
      const chosen = candidates[Math.floor(Math.random() * candidates.length)]
      const idx = pool.indexOf(chosen)
      usedIndices.add(idx)
      offeredPlayerIds.push(chosen.id)
      offeredRarities.push(targetRarity)
      players.push({
        id: chosen.id,
        name: chosen.name,
        position: chosen.position,
        club: chosen.club,
        nationality: chosen.nationality,
        basePrice: chosen.basePrice,
        rarityTier: chosen.rarityTier || 'BRONZE',
        photoUrl: chosen.photoUrl,
      })
    }
  }

  // Deduplication check (§1.11): ensure no two identical 3-player sets
  // (This is checked at a higher level in the route handler)

  return { offeredPlayerIds, offeredRarities, players }
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

export function computeSynergyScore(squadPlayers: SquadPlayer[], allPlayers: any[]): number {
  const playerMap = new Map(allPlayers.map((p: any) => [p.id, p]))

  const nationalityCounts: Record<string, number> = {}
  const clubCounts: Record<string, number> = {}

  for (const sp of squadPlayers) {
    const player = playerMap.get(sp.playerId)
    if (!player) continue
    if (player.nationality) {
      nationalityCounts[player.nationality] = (nationalityCounts[player.nationality] || 0) + 1
    }
    if (player.club) {
      clubCounts[player.club] = (clubCounts[player.club] || 0) + 1
    }
  }

  let bonus = 0

  // Nationality: +1% per player beyond a 3-player cluster
  for (const count of Object.values(nationalityCounts)) {
    if (count >= DRAFT.SYNERGY_NATIONALITY_THRESHOLD) {
      bonus += (count - (DRAFT.SYNERGY_NATIONALITY_THRESHOLD - 1)) * DRAFT.SYNERGY_NATIONALITY_BONUS_PER
    }
  }

  // Club: +2% per player beyond a 2-player cluster
  for (const count of Object.values(clubCounts)) {
    if (count >= DRAFT.SYNERGY_CLUB_THRESHOLD) {
      bonus += (count - (DRAFT.SYNERGY_CLUB_THRESHOLD - 1)) * DRAFT.SYNERGY_CLUB_BONUS_PER
    }
  }

  return Math.min(bonus, DRAFT.SYNERGY_MAX_BONUS)
}

// ─── Check Formation Fill Bonus (§1.6) ──────────────────

export function checkFormationFillBonus(
  picks: DraftPick[],
  formationSlots: FormationSlot[],
): boolean {
  // Count how many positions have at least one non-bench pick
  for (const slot of formationSlots) {
    const picksInPosition = picks.filter(
      (p) => p.position === slot.position && p.pickedPlayerId != null,
    )
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
  prisma: any,
  userId: string,
  tournamentId: string,
  formation: string,
  consumeTicketFn: () => Promise<{ success: boolean; remaining: number; reason?: string }>,
): Promise<{ success: boolean; session?: DraftSession; nextRound?: ChoiceRound; error?: string }> {
  // 1. Validate formation
  const formationDef = getFormation(formation)
  if (!formationDef) {
    return { success: false, error: `Invalid formation: "${formation}". Must be one of: ${loadFormations().map((f) => f.id).join(', ')}` }
  }

  // 2. Consume ticket
  const ticketResult = await consumeTicketFn()
  if (!ticketResult.success) {
    return { success: false, error: ticketResult.reason || 'No tickets remaining' }
  }

  // 3. Create draft session
  const session = await prisma.draftSession.create({
    data: {
      userId,
      tournamentId,
      formation,
      status: 'DRAFTING',
      createdAt: new Date().toISOString(),
      synergyScore: 0,
      formationBonusApplied: false,
    },
  }) as DraftSession

  // 4. Generate the first choice round (GK first, per draft-show pacing)
  const allPlayers = await prisma.player.findMany({
    where: { tournamentId },
  })

  const firstSlot = formationDef.slots[0]
  const firstRound = generateChoiceRound(
    // @ts-ignore
    firstSlot.position,
    [],
    allPlayers,
  )

  // 5. Create the first draft pick record
  const now = new Date()
  const expiresAt = new Date(now.getTime() + DRAFT.PICK_TIMER_SECONDS * 1000)

  const pickRecord = await prisma.draftPick.create({
    data: {
      draftSessionId: session.id,
      slotIndex: 0,
      // @ts-ignore
      position: firstSlot.position,
      offeredPlayerIds: firstRound.offeredPlayerIds,
      offeredRarities: firstRound.offeredRarities,
      pickedPlayerId: null,
      autoPicked: false,
      pickedAt: null,
    },
  }) as DraftPick

  // 6. Load full player objects for the choice round
  const playerObjects = firstRound.offeredPlayerIds.map((pid) => {
    const p = allPlayers.find((ap: any) => ap.id === pid)
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
  }).filter(Boolean)

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
      // @ts-ignore
      position: firstSlot.position,
      playerIds: firstRound.offeredPlayerIds,
      players: playerObjects as ChoiceRound['players'],
      expiresAt: expiresAt.toISOString(),
    },
  }
}

// ─── Get Next Choice Round ──────────────────────────────

export async function getNextRound(
  prisma: any,
  sessionId: string,
  userId: string,
): Promise<{ round: ChoiceRound | null; session: DraftSession | null; complete: boolean; error?: string }> {
  const session = await prisma.draftSession.findUnique({ where: { id: sessionId } }) as DraftSession | null
  if (!session) return { round: null, session: null, complete: false, error: 'Session not found' }
  if (session.userId !== userId) return { round: null, session: null, complete: false, error: 'Not your draft session' }
  if (session.status !== 'DRAFTING') return { round: null, session, complete: session.status === 'SQUAD_COMPLETE', error: undefined }

  const formationDef = getFormation(session.formation)
  if (!formationDef) return { round: null, session, complete: false, error: 'Invalid formation' }

  // Get all picks for this session
  const picks = await prisma.draftPick.findMany({
    where: { draftSessionId: sessionId },
    orderBy: { slotIndex: 'asc' },
  }) as DraftPick[]

  // Find the first unfilled slot
  const totalSlots = formationDef.slots.reduce((sum, s) => sum + s.count, 0) + formationDef.benchSlots

  let nextSlot: number | null = null
  for (let i = 0; i < totalSlots; i++) {
    const pick = picks.find((p) => p.slotIndex === i)
    if (!pick || (pick.pickedPlayerId == null && !pick.autoPicked)) {
      nextSlot = i
      break
    }
  }

  if (nextSlot === null) {
    // All slots filled — session is squad complete (but not yet committed)
    return { round: null, session, complete: true, error: undefined }
  }

  // Determine position for this slot
  let slotPosition = 'MID' // default
  let accumulatedSlots = 0
  for (const slot of formationDef.slots) {
    if (nextSlot < accumulatedSlots + slot.count) {
      slotPosition = slot.position
      break
    }
    accumulatedSlots += slot.count
  }
  // Bench slots (after all formation slots)
  if (nextSlot >= accumulatedSlots) {
    // Bench slots: flex position based on remaining formation positions
    const formationPositions = formationDef.slots.flatMap((s) =>
      Array(s.count).fill(s.position),
    )
    const usedInPosition = picks
      .filter((p) => p.pickedPlayerId != null)
      .map((p) => p.position)
    // Suggest a position with the most remaining need
    const positionNeeds: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
    for (const pos of formationPositions) {
      positionNeeds[pos] = (positionNeeds[pos] || 0) + 1
    }
    for (const pos of usedInPosition) {
      if (positionNeeds[pos]) positionNeeds[pos]--
    }
    slotPosition = Object.entries(positionNeeds).sort((a, b) => b[1] - a[1])[0]?.[0] || 'MID'
  }

  // Get all players for this tournament
  const allPlayers = await prisma.player.findMany({
    where: { tournamentId: session.tournamentId },
  })

  // Build exclusion list (already picked in this session)
  const excludePlayerIds = picks
    .filter((p) => p.pickedPlayerId != null)
    .map((p) => p.pickedPlayerId!)

  // Check if a pick record already exists for this slot (was started but not completed)
  let pickRecord = picks.find((p) => p.slotIndex === nextSlot)

  if (pickRecord && pickRecord.pickedPlayerId == null && !pickRecord.autoPicked) {
    // This round was already generated — check if timer expired
    const roundCreatedAt = pickRecord.pickedAt ? new Date(pickRecord.pickedAt).getTime() : Date.now()
    const expiresAtTime = roundCreatedAt + DRAFT.PICK_TIMER_SECONDS * 1000

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
      return getNextRound(prisma, sessionId, userId)
    }

    // Timer still running — return existing round
    const allPlayersForExisting = await prisma.player.findMany({
      where: { tournamentId: session.tournamentId },
    })

    const existingPlayers = pickRecord.offeredPlayerIds.map((pid) => {
      const p = allPlayersForExisting.find((ap: any) => ap.id === pid)
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
    }).filter(Boolean)

    const newExpiresAt = new Date(expiresAtTime).toISOString()

    return {
      round: {
        slotIndex: nextSlot,
        position: pickRecord.position,
        playerIds: pickRecord.offeredPlayerIds,
        players: existingPlayers as ChoiceRound['players'],
        expiresAt: newExpiresAt,
      },
      session,
      complete: false,
    }
  }

  // Generate new round
  const round = generateChoiceRound(slotPosition, excludePlayerIds, allPlayers)

  // Deduplication check (§1.11): ensure no identical 3-player set was already offered
  const previousPicks = picks.filter((p) => p.offeredPlayerIds.length === 3)
  const isDuplicate = previousPicks.some((p) =>
    p.offeredPlayerIds.every((id) => round.offeredPlayerIds.includes(id)) &&
    round.offeredPlayerIds.every((id) => p.offeredPlayerIds.includes(id)),
  )

  if (isDuplicate) {
    // Re-roll by swapping last offered player
    const replacement = allPlayers.find(
      (p: any) => !round.offeredPlayerIds.includes(p.id) && !excludePlayerIds.includes(p.id) && p.position === slotPosition,
    )
    if (replacement) {
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
        photoUrl: replacement.photoUrl,
      }
    }
  }

  // Create or update the pick record
  const now = new Date()
  const expiresAt = new Date(now.getTime() + DRAFT.PICK_TIMER_SECONDS * 1000)

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

// ─── Process Pick (§1.4) ────────────────────────────────

export async function processPick(
  prisma: any,
  sessionId: string,
  userId: string,
  slotIndex: number,
  pickedPlayerId: string,
): Promise<{ success: boolean; nextRound?: ChoiceRound | null; session?: DraftSession; complete?: boolean; error?: string }> {
  const session = await prisma.draftSession.findUnique({ where: { id: sessionId } }) as DraftSession | null
  if (!session) return { success: false, error: 'Session not found' }
  if (session.userId !== userId) return { success: false, error: 'Not your draft session' }
  if (session.status !== 'DRAFTING') return { success: false, error: 'Session is not in DRAFTING status' }

  // Find the pick record
  const picks = await prisma.draftPick.findMany({
    where: { draftSessionId: sessionId },
  }) as DraftPick[]

  const pick = picks.find((p) => p.slotIndex === slotIndex)
  if (!pick) return { success: false, error: `No round exists for slot ${slotIndex}` }
  if (pick.pickedPlayerId != null) return { success: false, error: 'This slot has already been picked' }

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

      // Check if all slots are now filled
      const formationDef = getFormation(session.formation)
      if (!formationDef) return { success: false, error: 'Invalid formation' }

      const totalSlots = formationDef.slots.reduce((sum, s) => sum + s.count, 0) + formationDef.benchSlots
      const updatedPicks = await prisma.draftPick.findMany({
        where: { draftSessionId: sessionId },
      }) as DraftPick[]

      const filledSlots = updatedPicks.filter((p) => p.pickedPlayerId != null).length
      const allFilled = filledSlots >= totalSlots

      if (allFilled) {
        return { success: true, nextRound: null, session: session ?? undefined, complete: true }
      }

      const nextResult = await getNextRound(prisma, sessionId, userId)
      return {
        success: true,
        nextRound: nextResult.round,
        session: nextResult.session ?? undefined,
        complete: nextResult.complete,
      }
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

  // Check if all slots are now filled
  const formationDef = getFormation(session.formation)
  if (!formationDef) return { success: false, error: 'Invalid formation' }

  const totalSlots = formationDef.slots.reduce((sum, s) => sum + s.count, 0) + formationDef.benchSlots
  const updatedPicks = await prisma.draftPick.findMany({
    where: { draftSessionId: sessionId },
  }) as DraftPick[]

  const filledSlots = updatedPicks.filter((p) => p.pickedPlayerId != null).length
  const allFilled = filledSlots >= totalSlots

  if (allFilled) {
    // Don't auto-commit — user must manually commit
    return {
      success: true,
      nextRound: null,
      session: session ?? undefined,
      complete: true,
    }
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

// ─── Commit Squad (§1.2 step 5) ─────────────────────────

export async function commitSquad(
  prisma: any,
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
  const session = await prisma.draftSession.findUnique({ where: { id: sessionId } }) as DraftSession | null
  if (!session) return { success: false, error: 'Session not found' }
  if (session.userId !== userId) return { success: false, error: 'Not your draft session' }
  if (session.status !== 'DRAFTING') return { success: false, error: 'Session is not in DRAFTING status' }

  const formationDef = getFormation(session.formation)
  if (!formationDef) return { success: false, error: 'Invalid formation' }

  // Get all picks
  const picks = await prisma.draftPick.findMany({
    where: { draftSessionId: sessionId },
  }) as DraftPick[]

  // Ensure all formation slots are filled
  const formationFilled = checkFormationFillBonus(picks, formationDef.slots)
  if (!formationFilled) {
    return { success: false, error: 'Not all formation slots are filled. Complete all required positions before committing.' }
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
  prisma: any,
  sessionId: string,
  userId: string,
): Promise<{ session: DraftSession | null; picks: DraftPick[]; squad: SquadPlayer[]; error?: string }> {
  const session = await prisma.draftSession.findUnique({ where: { id: sessionId } }) as DraftSession | null
  if (!session) return { session: null, picks: [], squad: [], error: 'Session not found' }
  if (session.userId !== userId) return { session: null, picks: [], squad: [], error: 'Not your draft session' }

  const picks = await prisma.draftPick.findMany({
    where: { draftSessionId: sessionId },
    orderBy: { slotIndex: 'asc' },
  }) as DraftPick[]

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

export async function listUserDrafts(
  prisma: any,
  userId: string,
): Promise<DraftSession[]> {
  const sessions = await prisma.draftSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return sessions as DraftSession[]
}

// ─── Helpers ─────────────────────────────────────────────

function findHighestRarityIndex(rarities: string[]): number {
  const tierOrder: Record<string, number> = { ICON: 0, GOLD: 1, SILVER: 2, BRONZE: 3 }
  let bestIdx = 0
  // @ts-ignore
  let bestScore = tierOrder[rarities[0]] ?? 99
  for (let i = 1; i < rarities.length; i++) {
    // @ts-ignore
    const score = tierOrder[rarities[i]] ?? 99
    if (score < bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  return bestIdx
}
