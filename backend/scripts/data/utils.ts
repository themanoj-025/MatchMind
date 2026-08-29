/** Utility functions and types for seed data generation. */

import { FIRST_NAMES, WOMEN_FIRST_NAMES, LAST_NAMES } from './names'

export interface PlayerTemplate {
  name: string
  club: string
  nationality: string
  position: 'GK' | 'DEF' | 'MID' | 'FWD'
  basePrice: number
  isEligibleForIcon?: boolean
}

export function section(entries: PlayerTemplate[]): PlayerTemplate[] {
  return entries
}

// ─── Realistic player generator ────────────────────────
//
// Generates fictional but realistic-looking players to fill up
// to real tournament squad sizes:
//   FIFA WC 2026: 48 teams × 26 players = 1,248
//   UCL 2026/27:  32 teams × 25 (List A) = 800
//
// Position distribution per squad: GK~3, DEF~9, MID~8, FWD~6

// First names by region

export function pick<T>(arr: T[], exclude?: Set<T>): T {
  const pool = exclude ? arr.filter((x) => !exclude.has(x)) : arr
  return pool[Math.floor(Math.random() * pool.length)]
}

// Generate first name based on nationality (fallback to a generic list)
export function firstName(nationality: string): string {
  const names = FIRST_NAMES[nationality]
  if (names) return names[Math.floor(Math.random() * names.length)]
  const allNames = Object.values(FIRST_NAMES).flat()
  return allNames[Math.floor(Math.random() * allNames.length)]
}

export function womenFirstName(nationality: string): string {
  const names = WOMEN_FIRST_NAMES[nationality]
  if (names) return names[Math.floor(Math.random() * names.length)]
  const allNames = Object.values(WOMEN_FIRST_NAMES).flat()
  return allNames[Math.floor(Math.random() * allNames.length)]
}

export function generateFillerPlayers(
  existing: PlayerTemplate[],
  targetCount: number,
  nationalities: string[],
  clubs: string[],
  womenNames?: boolean,
): PlayerTemplate[] {
  if (existing.length >= targetCount) return []

  const fillers: PlayerTemplate[] = []
  const existingNames = new Set(existing.map((p) => p.name))
  const usedNames = new Set<string>()
  const needed = targetCount - existing.length

  // Position distribution: GK~12%, DEF~34%, MID~30%, FWD~24%
  const posTargets = {
    GK: Math.round(needed * 0.12),
    DEF: Math.round(needed * 0.34),
    MID: Math.round(needed * 0.3),
    FWD: Math.round(needed * 0.24),
  }

  // Price tiers per position (ensure good distribution)
  // We need a mix of low/med/high prices so rarity tiers compute correctly
  const positionPriceRanges: Record<string, [number, number][]> = {
    GK: [
      [8, 20],
      [22, 35],
      [36, 50],
      [52, 68],
    ],
    DEF: [
      [8, 18],
      [20, 30],
      [32, 44],
      [46, 55],
    ],
    MID: [
      [8, 18],
      [20, 30],
      [32, 44],
      [46, 65],
    ],
    FWD: [
      [8, 18],
      [20, 30],
      [32, 44],
      [46, 70],
    ],
  }

  // Shuffle nationalities array for better distribution
  const shuffledNat = [...nationalities].sort(() => Math.random() - 0.5)

  for (const [pos, count] of Object.entries(posTargets) as [string, number][]) {
    const ranges = positionPriceRanges[pos]
    for (let i = 0; i < count; i++) {
      // Pick nationality with round-robin distribution
      const nat = shuffledNat[i % shuffledNat.length]
      const club = pick(clubs)

      // Generate unique name
      let name = ''
      for (let attempt = 0; attempt < 50; attempt++) {
        const first = womenNames ? womenFirstName(nat) : firstName(nat)
        const last = pick(LAST_NAMES)
        const candidate = `${first} ${last}`
        if (!existingNames.has(candidate) && !usedNames.has(candidate)) {
          name = candidate
          usedNames.add(candidate)
          break
        }
      }
      if (!name) continue // Skip if we can't find a unique name

      // Distribute prices across the 4 buckets (roughly 25% each)
      const bucketIdx = i % 4
      const [minP, maxP] = ranges[bucketIdx]
      const price = minP + Math.round(Math.random() * (maxP - minP))

      fillers.push({ name, club, nationality: nat, position: pos as 'GK' | 'DEF' | 'MID' | 'FWD', basePrice: price })
    }
  }

  // Shuffle for variety
  return fillers.sort(() => Math.random() - 0.5)
}
