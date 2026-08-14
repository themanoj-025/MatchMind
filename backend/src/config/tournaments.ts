/**
 * Tournament Configuration — MatchMind v2
 *
 * Loads tournament metadata from tournamentRegistry.json,
 * validates it with Zod at boot, and exposes typed accessors.
 *
 * Adding a new tournament = adding one JSON object.
 * No schema migration, no new code required.
 */

import { z } from 'zod'
import fs from 'fs'
import path from 'path'

// ─── Zod Schema ─────────────────────────────────────────

const TournamentStatus = z.enum(['LIVE', 'ANNOUNCED', 'ANNOUNCED_NOT_CONFIRMED'])
const TournamentFormat = z.enum(['GROUP_KNOCKOUT', 'LEAGUE_KNOCKOUT'])
const Gender = z.enum(['MEN', 'WOMEN'])
const Confederation = z.enum(['FIFA', 'UEFA', 'CAF', 'CONMEBOL', 'CONCACAF', 'AFC', 'OFC'])

const TournamentNavSchema = z.object({
  order: z.number().int().positive(),
  icon: z.string(),
})

const TournamentDateRangeSchema = z.object({
  start: z.string().nullable(),
  end: z.string().nullable(),
})

const TournamentThemeSchema = z.object({
  primary: z.string(),
  accent: z.string(),
})

const TournamentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id must be lowercase-kebab'),
  name: z.string().min(1),
  shortName: z.string().min(1).max(10),
  confederation: Confederation,
  gender: Gender,
  format: TournamentFormat,
  teamCount: z.number().int().positive(),
  squadSize: z.number().int().positive(),
  status: TournamentStatus,
  launchPhase: z.number().int().positive(),
  dateRange: TournamentDateRangeSchema,
  theme: TournamentThemeSchema,
  nav: TournamentNavSchema,
})

const RegistrySchema = z.object({
  tournaments: z.array(TournamentSchema).refine(
    (tournaments) => {
      const ids = tournaments.map((t) => t.id)
      return new Set(ids).size === ids.length
    },
    { message: 'Tournament IDs must be unique' },
  ),
})

// ─── Tournament Registry Type ───────────────────────────

export type TournamentStatus = z.infer<typeof TournamentStatus>
export type TournamentFormat = z.infer<typeof TournamentFormat>
export type Gender = z.infer<typeof Gender>

export interface Tournament {
  id: string
  name: string
  shortName: string
  confederation: string
  gender: string
  format: string
  teamCount: number
  squadSize: number
  status: TournamentStatus
  launchPhase: number
  dateRange: { start: string | null; end: string | null }
  theme: { primary: string; accent: string }
  nav: { order: number; icon: string }
}

// ─── Load Registry ──────────────────────────────────────

const REGISTRY_PATH = path.join(__dirname, 'tournamentRegistry.json')

function loadRegistry(): Tournament[] {
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    const result = RegistrySchema.parse(parsed)
    return result.tournaments as Tournament[]
  } catch (err: any) {
    console.error('[TournamentRegistry] Failed to load or validate:', err)
    process.exit(1)
  }
}

export const TOURNAMENTS: readonly Tournament[] = loadRegistry()

// ─── Accessors ──────────────────────────────────────────

export function getTournament(id: string): Tournament | undefined {
  return TOURNAMENTS.find((t) => t.id === id)
}

export function isValidTournamentId(id: string): boolean {
  return TOURNAMENTS.some((t) => t.id === id)
}

export function listLive(): Tournament[] {
  return TOURNAMENTS.filter((t) => t.status === 'LIVE')
}

export function listAnnounced(): Tournament[] {
  return TOURNAMENTS.filter((t) => t.status === 'ANNOUNCED')
}

export function listVisible(): Tournament[] {
  return TOURNAMENTS.filter((t) => t.status !== 'ANNOUNCED_NOT_CONFIRMED')
}

// ─── Existing constants (unchanged) ─────────────────────

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'] as const
export type Position = (typeof POSITIONS)[number]

export const DEFAULT_ROSTER_RULES = {
  GK: 2,
  DEF: 5,
  MID: 5,
  FWD: 3,
  total: 15,
} as const

export const BID_INCREMENTS = [
  { threshold: 0, increment: 5 },
  { threshold: 50, increment: 10 },
  { threshold: 100, increment: 25 },
  { threshold: 200, increment: 50 },
] as const

export const AUCTION_DEFAULT_TIMER_SECONDS = 15
export const AUCTION_ANTI_SNIPE_SECONDS = 5
export const AUCTION_ANTI_SNIPE_RESET_SECONDS = 10
export const MAX_FREE_ROOMS_PER_USER = 3
