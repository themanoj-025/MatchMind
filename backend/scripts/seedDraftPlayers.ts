/**
 * seedDraftPlayers.ts — MatchMind v4 §6.5
 *
 * Generates comprehensive seed player data for both LIVE tournaments
 * (fifa-wc-2026 and uefa-ucl-2026-27) to ensure the Draft Mode
 * seeding gate passes (§6.3).
 *
 * Creates ~280 players per tournament with realistic name, club,
 * nationality, position, and basePrice distributions so rarity tiers
 * are populated correctly.
 *
 * Usage:
 *   npx tsx scripts/seedDraftPlayers.ts
 *
 * This REPLACES the existing players.json with the complete seed data.
 */

import fs from 'fs'
import path from 'path'

import {
  WC_NATIONALITIES,
  UCL_NATIONALITIES,
  UEL_NATIONALITIES,
  AFCON_NATIONALITIES,
  WWC_NATIONALITIES,
  COPA_NATIONALITIES,
  WC_CLUBS,
  UCL_CLUBS,
  UEL_CLUBS,
  AFCON_CLUBS,
  WWC_CLUBS,
  COPA_CLUBS,
  WC_PLAYERS,
  UCL_PLAYERS,
  UEL_PLAYERS,
  AFCON_PLAYERS,
  WWC_PLAYERS,
  COPA_PLAYERS,
} from './data'

import { generateFillerPlayers } from './data/utils'

const DATA_DIR = path.join(__dirname, '..', 'src', 'data')

// ─── Target sizes (real tournament data) ────────────────
// FIFA World Cup 2026: 48 teams x 26 players = 1,248
// UEFA Champions League 2026/27: 32 teams x 25 (List A) = 800
// UEFA Europa League 2026/27: 36 teams x 25 (List A) = 900
// CAF Africa Cup of Nations 2027: 24 teams x 27 players = 648
// FIFA Women's World Cup 2027: 32 teams x 26 players = 832
// Copa America 2028: 16 teams x 26 players = 416

const WC_TARGET = 1248
const UCL_TARGET = 800
const UEL_TARGET = 900
const AFCON_TARGET = 648
const WWC_TARGET = 832
const COPA_TARGET = 416

// ─── Main ───────────────────────────────────────────────

function main() {
  const wcBase = WC_PLAYERS
  const uclBase = UCL_PLAYERS
  const uelBase = UEL_PLAYERS
  const afconBase = AFCON_PLAYERS
  const wwcBase = WWC_PLAYERS
  const copaBase = COPA_PLAYERS

  // Generate filler players to reach target counts
  const wcFillers = generateFillerPlayers(wcBase, WC_TARGET, WC_NATIONALITIES, WC_CLUBS)
  const uclFillers = generateFillerPlayers(uclBase, UCL_TARGET, UCL_NATIONALITIES, UCL_CLUBS)
  const uelFillers = generateFillerPlayers(uelBase, UEL_TARGET, UEL_NATIONALITIES, UEL_CLUBS)
  const afconFillers = generateFillerPlayers(afconBase, AFCON_TARGET, AFCON_NATIONALITIES, AFCON_CLUBS)
  const wwcFillers = generateFillerPlayers(wwcBase, WWC_TARGET, WWC_NATIONALITIES, WWC_CLUBS, true)
  const copaFillers = generateFillerPlayers(copaBase, COPA_TARGET, COPA_NATIONALITIES, COPA_CLUBS)

  const wcPlayers = [...wcBase, ...wcFillers]
  const uclPlayers = [...uclBase, ...uclFillers]
  const uelPlayers = [...uelBase, ...uelFillers]
  const afconPlayers = [...afconBase, ...afconFillers]
  const wwcPlayers = [...wwcBase, ...wwcFillers]
  const copaPlayers = [...copaBase, ...copaFillers]

  const allPlayers: { id: string; tournamentId: string; name: string; club: string; nationality: string; position: string; basePrice: number; isEligibleForIcon?: boolean }[] = []
  let idCounter = 1

  const tournaments = [
    {
      id: 'fifa-wc-2026',
      players: wcPlayers,
      base: wcBase,
      fillers: wcFillers,
      target: WC_TARGET,
      label: 'FIFA WC 2026',
    },
    {
      id: 'uefa-ucl-2026-27',
      players: uclPlayers,
      base: uclBase,
      fillers: uclFillers,
      target: UCL_TARGET,
      label: 'UCL 2026/27',
    },
    {
      id: 'uefa-uel-2026-27',
      players: uelPlayers,
      base: uelBase,
      fillers: uelFillers,
      target: UEL_TARGET,
      label: 'UEL 2026/27',
    },
    {
      id: 'caf-afcon-2027',
      players: afconPlayers,
      base: afconBase,
      fillers: afconFillers,
      target: AFCON_TARGET,
      label: 'AFCON 2027',
    },
    {
      id: 'fifa-wwc-2027',
      players: wwcPlayers,
      base: wwcBase,
      fillers: wwcFillers,
      target: WWC_TARGET,
      label: 'WWC 2027',
    },
    {
      id: 'conmebol-copa-america-2028',
      players: copaPlayers,
      base: copaBase,
      fillers: copaFillers,
      target: COPA_TARGET,
      label: 'COPA 2028',
    },
  ]

  for (const t of tournaments) {
    for (const template of t.players) {
      allPlayers.push({
        id: `player-${idCounter++}`,
        tournamentId: t.id,
        ...template,
      })
    }
  }

  console.log(`\n=== Player Generation Summary ===`)
  console.log(`Total players: ${allPlayers.length}\n`)

  for (const t of tournaments) {
    const count = allPlayers.filter((p) => p.tournamentId === t.id).length
    const realCount = t.base.length
    const genCount = t.fillers.length
    const positions: Record<string, number> = {}
    for (const p of allPlayers) {
      if (p.tournamentId === t.id) {
        positions[p.position] = (positions[p.position] || 0) + 1
      }
    }
    console.log(`  ${t.label}: ${count} players (${realCount} real + ${genCount} generated) — target: ${t.target}`)
    console.log(
      `    Positions: GK=${positions.GK ?? 0}, DEF=${positions.DEF ?? 0}, MID=${positions.MID ?? 0}, FWD=${
        positions.FWD ?? 0
      }`,
    )
  }

  const outputPath = path.join(DATA_DIR, 'players.json')
  const tmpPath = outputPath + '.tmp'
  if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(tmpPath, JSON.stringify(allPlayers, null, 2), 'utf-8')
  fs.renameSync(tmpPath, outputPath)
  console.log(`\nWritten to ${outputPath}`)
}

main()
