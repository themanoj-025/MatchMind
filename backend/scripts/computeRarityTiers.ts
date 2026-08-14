/**
 * computeRarityTiers.ts — MatchMind v4 §1.3
 *
 * Ranks all players in every tournament by basePrice descending,
 * assigns a rarityTier per the percentile buckets defined in constants.ts,
 * then writes the results back to players.json atomically.
 *
 * Idempotent — safe to run repeatedly. Only updates the rarityTier field;
 * all other player data is preserved.
 *
 * Usage:
 *   npx tsx scripts/computeRarityTiers.ts               # all tournaments
 *   npx tsx scripts/computeRarityTiers.ts fifa-wc-2026  # single tournament
 *
 * Exit code: 0 = success, 1 = fail
 */

import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(__dirname, '..', 'src', 'data')

// ─── Rarity Tiers — must match constants.ts ─────────────
const RARITY_TIERS = [
  { tier: 'BRONZE', maxPercentile: 60, packWeight: 0.55 },
  { tier: 'SILVER', maxPercentile: 85, packWeight: 0.30 },
  { tier: 'GOLD',   maxPercentile: 97, packWeight: 0.13 },
  { tier: 'ICON',   maxPercentile: 100, packWeight: 0.02 },
] as const

// ─── Helpers ─────────────────────────────────────────────

function loadJSON(filename: string): any[] {
  const filePath = path.join(DATA_DIR, filename)
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function atomicWrite(filePath: string, data: any): void {
  const tmpPath = filePath + '.tmp'
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmpPath, filePath)
}

// ─── Assign Rarity for a Single Tournament ──────────────

function assignRaritiesForTournament(
  players: any[],
  tournamentId: string,
): { updated: number; icons: number } {
  // Filter to this tournament
  const tournamentPlayers = players.filter((p: any) => p.tournamentId === tournamentId)

  if (tournamentPlayers.length === 0) {
    console.warn(`  ⚠ No players found for tournament "${tournamentId}"`)
    return { updated: 0, icons: 0 }
  }

  // Check all players have basePrice
  const noPrice = tournamentPlayers.filter((p: any) => p.basePrice == null)
  if (noPrice.length > 0) {
    console.error(`  ❌ ${noPrice.length} player(s) missing basePrice in "${tournamentId}". Aborting.`)
    console.error(`     Examples: ${noPrice.slice(0, 3).map((p: any) => p.name || p.id).join(', ')}`)
    process.exit(1)
  }

  // Sort by basePrice descending
  const sorted = [...tournamentPlayers].sort((a, b) => b.basePrice - a.basePrice)
  const total = sorted.length

  let icons = 0

  for (let i = 0; i < total; i++) {
    const player = sorted[i]
    const percentile = ((i + 1) / total) * 100

    // Convert to bottom-up percentile: rank 1 (highest price, percentile=0.625)
    // becomes bottomPct=99.375, correctly matching ICON (97-100).
    const bottomPct = 100 - percentile
    let assignedTier = 'BRONZE'
    for (const tier of RARITY_TIERS) {
      if (bottomPct <= tier.maxPercentile) {
        assignedTier = tier.tier
        break
      }
    }

    // ICON tier requires admin eligibility flag AND top 2%
    if (assignedTier === 'ICON' && !player.isEligibleForIcon) {
      assignedTier = 'GOLD' // Demote to GOLD if not admin-gated for Icon
    }

    if (assignedTier === 'ICON') icons++

    // Update the player object in the master array
    const playerIndex = players.findIndex((p: any) => p.id === player.id)
    if (playerIndex !== -1) {
      players[playerIndex] = {
        ...players[playerIndex],
        rarityTier: assignedTier,
      }
    }
  }

  return { updated: tournamentPlayers.length, icons }
}

// ─── Main ─────────────────────────────────────────────---

function main() {
  const targetId = process.argv[2]
  const playersPath = path.join(DATA_DIR, 'players.json')

  if (!fs.existsSync(playersPath)) {
    console.error('❌ players.json not found at', playersPath)
    process.exit(1)
  }

  const players: any[] = loadJSON('players.json')
  const tournamentIds = new Set(players.map((p: any) => p.tournamentId))

  console.log(`📊 Computing rarity tiers for ${players.length} players across ${tournamentIds.size} tournament(s)...\n`)

  let totalUpdated = 0
  let totalIcons = 0

  for (const tid of tournamentIds) {
    if (targetId && tid !== targetId) continue
    console.log(`  Tournament: ${tid}`)
    const result = assignRaritiesForTournament(players, tid)
    totalUpdated += result.updated
    totalIcons += result.icons
    console.log(`    → ${result.updated} players processed, ${result.icons} ICONs assigned\n`)
  }

  // Write back atomically
  atomicWrite(playersPath, players)

  // Write a cache file with computation timestamp
  const cachePath = path.join(DATA_DIR, 'playerRarityCache.json')
  const tidArray = Array.from(tournamentIds)
  const cache = tidArray
    .filter((tid) => !targetId || tid === targetId)
    .map((tid) => ({
      tournamentId: tid,
      rarityComputedAt: new Date().toISOString(),
    }))
  atomicWrite(cachePath, cache)

  // Also update each player record in data (in-memory) to include rarityTier
  console.log(`\n${'='.repeat(50)}`)
  console.log(`✅ Done: ${totalUpdated} players assigned rarity tiers (${totalIcons} ICONs).`)
  console.log(`   players.json and playerRarityCache.json written atomically.\n`)
}

main()
