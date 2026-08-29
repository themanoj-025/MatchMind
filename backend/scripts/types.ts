/**
 * Shared types for Match-Mind seed scripts.
 *
 * Mirrors the shapes used by the admin API so that seed scripts,
 * migration scripts, and the runtime all agree on data shapes.
 */

export interface PlayerRecord {
  id: string
  name: string
  tournamentId: string
  position?: string
  club?: string
  nationality?: string
  basePrice?: number
  rarityTier?: string
  isEligibleForIcon?: boolean
  photoUrl?: string
}

export interface TournamentRecord {
  id: string
  teamCount?: number
  squadSize?: number
}

export interface TeamRecord {
  id: string
  tournamentId: string
}

export interface FixtureRecord {
  id: string
  tournamentId: string
  homeTeamId?: string
  awayTeamId?: string
  venueId?: string
}

export interface VenueRecord {
  id: string
  tournamentId: string
}

export interface HistoryRecord {
  tournamentId: string
  pastWinners?: string[]
}

export interface RegistryEntry {
  tournaments: TournamentRecord[]
}
