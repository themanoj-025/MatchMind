/**
 * Shared types for Match-Mind seed scripts.
 *
 * Mirrors the PlayerRecord used by the admin API so that seed scripts,
 * migration scripts, and the runtime all agree on the player JSON shape.
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
