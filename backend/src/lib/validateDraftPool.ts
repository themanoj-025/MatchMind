/**
 * validateDraftPool.ts — MatchMind v4 §6.3
 *
 * Shared validation logic for Draft Mode pool readiness.
 * Imported by both:
 *   1. The CLI script (scripts/validateDraftPool.ts)
 *   2. The admin API endpoint (routes/admin.ts)
 *
 * Lives in src/lib/ so it's inside the tsconfig include scope
 * and can be imported cleanly by runtime code.
 */

import fs from 'fs'
import path from 'path'

// Default: resolve relative to this file (backend/src/lib/) → backend/src/data/
const DEFAULT_DATA_DIR = path.resolve(__dirname, '..', 'data')
const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'] as const
const RARITY_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'ICON'] as const
const MIN_PLAYERS_PER_POSITION_RARITY = 4
const ICON_MIN_PER_POSITION = 1

export interface ValidationResult {
  tournamentId: string
  passed: boolean
  errors: string[]
  warnings: string[]
  infos: string[]
}

// ─── Helpers ─────────────────────────────────────────────

function loadJSON(filename: string, dataDir: string): any[] {
  const filePath = path.join(dataDir, filename)
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

// ─── Validate Single Tournament ─────────────────────────

export function validateTournamentDraftPool(
  tournamentId: string,
  dataDir?: string,
): ValidationResult {
  const effectiveDataDir = dataDir || DEFAULT_DATA_DIR
  const errors: string[] = []
  const warnings: string[] = []
  const infos: string[] = []

  let players: any[];
  try {
    players = loadJSON('players.json', effectiveDataDir).filter(
      (p: any) => p.tournamentId === tournamentId,
    )
  } catch {
    errors.push(`Failed to read players.json from ${effectiveDataDir}`)
    return { tournamentId, passed: false, errors, warnings, infos }
  }

  if (players.length === 0) {
    errors.push(`No players found for tournament "${tournamentId}"`)
    return { tournamentId, passed: false, errors, warnings, infos }
  }

  // ─── Check 1: All players have basePrice ─────────────────
  const noPrice = players.filter((p: any) => p.basePrice == null)
  if (noPrice.length > 0) {
    errors.push(
      `${noPrice.length} player(s) missing basePrice — hard requirement for Draft Mode rarity computation`,
    )
    noPrice.slice(0, 5).forEach((p: any) => {
      errors.push(`  • ${p.name || p.id} (${p.position})`)
    })
  }

  // ─── Check 2: Rarity tiers computed ────────────────────
  const hasRarityData = players.some((p: any) => p.rarityTier != null)

  if (!hasRarityData) {
    errors.push(
      `No rarity tiers found — run \`npx tsx scripts/computeRarityTiers.ts ${tournamentId}\` first`,
    )
  } else {
    try {
      const cache = loadJSON('playerRarityCache.json', effectiveDataDir)
      const entry = cache.find((c: any) => c.tournamentId === tournamentId)
      if (entry?.rarityComputedAt) {
        infos.push(`Rarity tiers computed at ${entry.rarityComputedAt}`)
      }
    } catch {
      /* non-fatal */
    }
  }

  const missingRarity = players.filter(
    (p: any) => p.rarityTier == null && p.basePrice != null,
  )
  if (missingRarity.length > 0) {
    errors.push(
      `${missingRarity.length} player(s) missing rarityTier — run computeRarityTiers.ts again`,
    )
  }

  // ─── Check 3: For each position × rarity, at least 8 ──
  const counts: Record<string, Record<string, number>> = {
    GK: { BRONZE: 0, SILVER: 0, GOLD: 0, ICON: 0 },
    DEF: { BRONZE: 0, SILVER: 0, GOLD: 0, ICON: 0 },
    MID: { BRONZE: 0, SILVER: 0, GOLD: 0, ICON: 0 },
    FWD: { BRONZE: 0, SILVER: 0, GOLD: 0, ICON: 0 },
  }

  for (const player of players) {
    const pos = player.position as string
    const rarity = (player.rarityTier || 'BRONZE') as string
    if (counts[pos] && counts[pos][rarity] !== undefined) {
      counts[pos][rarity]++
    }
  }

  for (const pos of POSITIONS) {
    for (const rarity of RARITY_TIERS) {
      const count = counts[pos]?.[rarity] || 0
      if (rarity === 'ICON') {
        if (count < ICON_MIN_PER_POSITION) {
          infos.push(
            `ICON/${pos}: ${count} player(s) — below recommendation of ${ICON_MIN_PER_POSITION} (graceful: Draft Mode simply never offers ICONs for this position)`,
          )
        }
      } else {
        if (count < MIN_PLAYERS_PER_POSITION_RARITY) {
          errors.push(
            `${rarity}/${pos}: ${count} player(s) — need at least ${MIN_PLAYERS_PER_POSITION_RARITY} for Draft Mode packs`,
          )
        }
      }
    }
  }

  // ─── Check 5: photoUrl completeness (informational) ──
  const withPhoto = players.filter((p: any) => p.photoUrl)
  const photoPct = ((withPhoto.length / players.length) * 100).toFixed(1)
  if (parseFloat(photoPct) < 100) {
    warnings.push(
      `Photo URL completeness: ${photoPct}% (${withPhoto.length}/${players.length}) — target 100% before public launch`,
    )
  } else {
    infos.push(`Photo URL completeness: 100% ✅`)
  }

  // ─── Summary ─────────────────────────────────────────
  const totalCounts = Object.entries(counts).flatMap(([pos, rarities]) =>
    Object.entries(rarities).map(([rarity, count]) => `${rarity}/${pos}: ${count}`),
  )
  infos.push(`Player pool: ${players.length} total players`)
  infos.push(`Distribution: ${totalCounts.join(', ')}`)

  return {
    tournamentId,
    passed: errors.length === 0,
    errors,
    warnings,
    infos,
  }
}

export function formatValidationResult(result: ValidationResult): string {
  const status = result.passed ? '✅ PASS' : '❌ FAIL'
  const lines: string[] = []

  lines.push(`\n${status} — ${result.tournamentId}`)

  if (result.infos.length > 0) {
    lines.push(`  ℹ️  Info:`)
    result.infos.forEach((i) => lines.push(`    • ${i}`))
  }
  if (result.warnings.length > 0) {
    lines.push(`  ⚠️  Warnings:`)
    result.warnings.forEach((w) => lines.push(`    • ${w}`))
  }
  if (result.errors.length > 0) {
    lines.push(`  ❌ Errors:`)
    result.errors.forEach((e) => lines.push(`    • ${e}`))
  }
  if (
    result.errors.length === 0 &&
    result.warnings.length === 0 &&
    result.infos.length === 0
  ) {
    lines.push(`    All checks passed.`)
  }

  return lines.join('\n')
}
