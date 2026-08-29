/**
 * Admin shared utilities — player I/O, rarity tiers, cache invalidation.
 */

import fs from 'fs'
import path from 'path'

import { env } from '../config/env'
import { type AuthenticatedRequest } from '../middleware/auth'
import { AdminService } from '../services/adminService'
import { createRepositories } from '../repositories/index'
import logger from '../utils/logger'
import { redis } from '../lib/redis'
import type { Prisma } from '@prisma/client'

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

const RARITY_TIERS_FN = [
  { tier: 'BRONZE', maxPercentile: 60 },
  { tier: 'SILVER', maxPercentile: 85 },
  { tier: 'GOLD', maxPercentile: 97 },
  { tier: 'ICON', maxPercentile: 100 },
]

export function readPlayers(): PlayerRecord[] {
  const playersPath = path.join(__dirname, '..', 'data', 'players.json')
  if (!fs.existsSync(playersPath)) return []
  return JSON.parse(fs.readFileSync(playersPath, 'utf-8')) as PlayerRecord[]
}

export function writePlayers(players: PlayerRecord[]): void {
  const playersPath = path.join(__dirname, '..', 'data', 'players.json')
  const tmpPath = playersPath + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(players, null, 2), 'utf-8')
  fs.renameSync(tmpPath, playersPath)
}

export async function invalidatePlayerCache(): Promise<void> {
  if (redis.status === 'ready' || redis.status === 'connect') {
    try {
      const keys = await redis.keys('players:*')
      if (keys.length > 0) {
        await redis.del(...keys)
        logger.info({ event: 'redis.cache_invalidated' }, 'Invalidated player cache')
      }
    } catch (err: unknown) {
      logger.error(
        { event: 'redis.cache_invalidation_error', err: (err as Error).message },
        'Failed to invalidate cache',
      )
    }
  }
}

/** Compute the rarity tier for a player at `index` (0-based) in a sorted pool. */
export function tierForPercentile(player: PlayerRecord, total: number, index: number): string {
  const percentile = ((index + 1) / total) * 100
  const bottomPct = 100 - percentile
  let assignedTier: string = 'BRONZE'
  for (const t of RARITY_TIERS_FN) {
    if (bottomPct <= t.maxPercentile) {
      assignedTier = t.tier
      break
    }
  }
  if (assignedTier === 'ICON' && !player.isEligibleForIcon) {
    assignedTier = 'GOLD'
  }
  return assignedTier
}

/**
 * Re-assign rarity tiers per tournament: sort each tournament's players by
 * basePrice descending and bucket into BRONZE/SILVER/GOLD/ICON by percentile.
 */
export function assignRarityTiers(allPlayers: PlayerRecord[], tournamentIds: string[]): PlayerRecord[] {
  let updated = allPlayers
  for (const tid of tournamentIds) {
    const tournamentPlayers = updated.filter((p) => p.tournamentId === tid)
    if (tournamentPlayers.length === 0) continue
    const sorted = [...tournamentPlayers].sort((a, b) => (b.basePrice ?? 0) - (a.basePrice ?? 0))
    const total = sorted.length
    const rarityMap = new Map<string, string>()
    for (let i = 0; i < total; i++) {
      const player = sorted[i]
      if (!player) continue
      rarityMap.set(player.id, tierForPercentile(player, total, i))
    }
    updated = updated.map((p) =>
      p.tournamentId === tid && rarityMap.has(p.id) ? { ...p, rarityTier: rarityMap.get(p.id) as string } : p,
    )
  }
  return updated
}

/** Read the comma-separated DRAFT_ENABLED_TOURNAMENTS env list. */
export function readEnabledTournaments(): string[] {
  return (env.DRAFT_ENABLED_TOURNAMENTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Add a tournament to the env-controlled draft-mode list. */
export function enableDraftMode(tournamentId: string): void {
  const current = readEnabledTournaments()
  if (!current.includes(tournamentId)) {
    current.push(tournamentId)
    env.DRAFT_ENABLED_TOURNAMENTS = current.join(',')
  }
}

/** Remove a tournament from the env-controlled draft-mode list. */
export function disableDraftMode(tournamentId: string): void {
  env.DRAFT_ENABLED_TOURNAMENTS = readEnabledTournaments()
    .filter((id) => id !== tournamentId)
    .join(',')
}

/** Create an AdminService instance from the Express app's prisma client */
export function getAdminService(req: AuthenticatedRequest) {
  const prisma = req.container.cradle.prisma
  const { userRepository, reportRepository, adminLogRepository } = createRepositories(prisma)
  return new AdminService({
    userRepository,
    reportRepository,
    adminLogRepository,
    prisma: {
      user: { count: (opts?: Prisma.UserCountArgs) => prisma.user.count(opts) },
      room: { count: (opts?: Prisma.RoomCountArgs) => prisma.room.count(opts) },
    },
  })
}
