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
import { DRAFT, RARITY_TIERS, type RarityTierName } from '../config/constants'
import type { DatabaseClient } from '../repositories'
import logger from '../utils/logger'
// ─── Types ───────────────────────────────────────────────
/** Shape of a player record from src/data/players.json or Prisma Player. */
export interface PlayerRecord {
  id: string
  name: string
  position: string
  club: string
  nationality: string
  basePrice: number
  rarityTier?: string | null
  photoUrl?: string | null
}
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
export type DraftSessionStatus = 'DRAFTING' | 'SQUAD_COMPLETE' | 'RUN_IN_PROGRESS' | 'RUN_COMPLETE' | 'ABANDONED'
export interface DraftSession {
  id: string
  userId: string
  tournamentId: string
  formation: string
  status: DraftSessionStatus
  ticketConsumedId?: string
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
