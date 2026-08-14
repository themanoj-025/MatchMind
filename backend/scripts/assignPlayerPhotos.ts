/**
 * assignPlayerPhotos.ts — MatchMind v4
 *
 * Assigns deterministic photoUrl values to all players using ui-avatars.com.
 * Each player gets a consistent URL based on their name and position:
 *   - Position-based background color (GK=blue, DEF=green, MID=amber, FWD=red)
 *   - Initials derived from player name
 *   - Deterministic via seeded name-based color saturation
 *
 * Assigns placeholder player photos until real images are sourced.
 * ui-avatars.com is free, requires no API key, and works over HTTPS.
 *
 * Usage:
 *   npx tsx scripts/assignPlayerPhotos.ts
 *
 * Exit code: 0 = success, 1 = fail
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const DATA_DIR = path.join(__dirname, '..', 'src', 'data')

// ─── Position Color Palette ─────────────────────────────
// Each position gets a distinct hue family for visual recognition.
const POSITION_COLORS: Record<string, string[]> = {
  GK: ['#1E3A5F', '#2B4C7E', '#1A2F4F', '#3D5A80', '#0D2137'],
  DEF: ['#1B5E20', '#2E7D32', '#388E3C', '#43A047', '#4CAF50'],
  MID: ['#E65100', '#EF6C00', '#F57C00', '#FB8C00', '#FF9800'],
  FWD: ['#B71C1C', '#C62828', '#D32F2F', '#E53935', '#F44336'],
}

const FALLBACK_COLORS = ['#37474F', '#455A64', '#546E7A', '#607D8B', '#78909C']

// ─── Helpers ─────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function seededColor(name: string, position: string): string {
  const palette = POSITION_COLORS[position] || FALLBACK_COLORS
  // Deterministic index from name hash
  const hash = crypto.createHash('md5').update(name).digest('hex')
  const idx = parseInt(hash.substring(0, 8), 16) % palette.length
  return palette[idx]
}

function encodeName(name: string): string {
  return encodeURIComponent(name.trim())
}

function buildPhotoUrl(name: string, position: string): string {
  const initials = getInitials(name)
  const bg = seededColor(name, position).replace('#', '')
  const encoded = encodeName(name)
  // ui-avatars.com format: name param for display, initials for letters, background color
  return `https://ui-avatars.com/api/?name=${encoded}&background=${bg}&color=fff&size=256&font-size=0.33&bold=true&initials=${initials}`
}

// ─── Main ────────────────────────────────────────────────

function main() {
  const playersPath = path.join(DATA_DIR, 'players.json')

  if (!fs.existsSync(playersPath)) {
    console.error('❌ players.json not found at', playersPath)
    process.exit(1)
  }

  const raw = fs.readFileSync(playersPath, 'utf-8')
  const players: any[] = JSON.parse(raw)

  console.log(`📸 Assigning photo URLs for ${players.length} players...\n`)

  let assigned = 0
  let skipped = 0

  for (let i = 0; i < players.length; i++) {
    const player = players[i]

    if (player.photoUrl && player.photoUrl.startsWith('http')) {
      skipped++
      continue
    }

    const url = buildPhotoUrl(player.name, player.position || 'MID')
    players[i] = { ...player, photoUrl: url }
    assigned++
  }

  // Write back atomically
  const tmpPath = playersPath + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(players, null, 2), 'utf-8')
  fs.renameSync(tmpPath, playersPath)

  // Stats by tournament
  const byTournament: Record<string, number> = {}
  for (const p of players) {
    byTournament[p.tournamentId] = (byTournament[p.tournamentId] || 0) + 1
  }

  console.log('✅ Photo URLs assigned.\n')
  console.log(`   Assigned: ${assigned}`)
  console.log(`   Skipped (already had URL): ${skipped}`)
  console.log(`   Total: ${players.length}`)
  console.log(`\n📊 By tournament:`)
  for (const [tid, count] of Object.entries(byTournament)) {
    const withPhoto = players.filter((p: any) => p.tournamentId === tid && p.photoUrl).length
    const pct = ((withPhoto / count) * 100).toFixed(1)
    console.log(`   ${tid}: ${withPhoto}/${count} photos (${pct}%)`)
  }

  // Sample URLs
  console.log(`\n🎯 Sample URLs:`)
  const samples = players.slice(0, 5)
  for (const p of samples) {
    console.log(`   ${p.name} (${p.position}): ${p.photoUrl}`)
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`✅ Done — ${assigned} photo URLs written to players.json\n`)
}

main()
