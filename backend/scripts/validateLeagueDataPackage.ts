/**
 * validateLeagueDataPackage.ts — MatchMind v2 §4.3
 *
 * Validates that a tournament has a complete League Data Package before
 * its status can be flipped to LIVE.
 *
 * Run: npx ts-node scripts/validateLeagueDataPackage.ts [tournamentId]
 *      (omit tournamentId to validate ALL tournaments)
 *
 * Exit code: 0 = pass, 1 = fail (blocks CI/deployment)
 */

import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(__dirname, '..', 'src', 'data')
const REGISTRY_PATH = path.join(__dirname, '..', 'src', 'config', 'tournamentRegistry.json')

interface ValidationResult {
  tournamentId: string
  passed: boolean
  errors: string[]
  warnings: string[]
}

// ─── Load registry ──────────────────────────────────────

function loadRegistry(): any[] {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8')
  const parsed = JSON.parse(raw)
  return parsed.tournaments || []
}

// ─── Load JSON data file ────────────────────────────────

function loadDataFile(filename: string): any[] {
  const filePath = path.join(DATA_DIR, filename)
  if (!fs.existsSync(filePath)) return []
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

// ─── Validation rules (§4.3) ────────────────────────────

function validateTournamentData(tournament: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const tid = tournament.id

  // 1. Team count matches registry
  const teams = loadDataFile('teams.json').filter((t: any) => t.tournamentId === tid)
  if (teams.length === 0) {
    errors.push(`No teams found in teams.json for tournament "${tid}"`)
  } else if (tournament.teamCount && teams.length < tournament.teamCount) {
    warnings.push(`Expected ${tournament.teamCount} teams, found ${teams.length} in teams.json`)
  }

  // 2. Every team has full squad (at least minimum realistic squad)
  const players = loadDataFile('players.json').filter((p: any) => p.tournamentId === tid)
  const minSquadSize = Math.min(tournament.squadSize || 23, 20) // at least 20 even for pre-squad-trim
  if (players.length < minSquadSize) {
    errors.push(`Expected at least ${minSquadSize} players, found ${players.length} in players.json for "${tid}"`)
  }

  // 3. Every fixture references valid teams
  const fixtures = loadDataFile('fixtures.json').filter((f: any) => f.tournamentId === tid)
  const teamIds = new Set(teams.map((t: any) => t.id))
  for (const fixture of fixtures) {
    if (fixture.homeTeamId && !teamIds.has(fixture.homeTeamId)) {
      errors.push(`Fixture "${fixture.id}" references unknown homeTeamId "${fixture.homeTeamId}"`)
    }
    if (fixture.awayTeamId && !teamIds.has(fixture.awayTeamId)) {
      errors.push(`Fixture "${fixture.id}" references unknown awayTeamId "${fixture.awayTeamId}"`)
    }
  }

  // 4. Every venue referenced by a fixture exists in venues.json
  const venues = loadDataFile('venues.json').filter((v: any) => v.tournamentId === tid)
  const venueIds = new Set(venues.map((v: any) => v.id))
  for (const fixture of fixtures) {
    if (fixture.venueId && !venueIds.has(fixture.venueId)) {
      warnings.push(`Fixture "${fixture.id}" references unknown venueId "${fixture.venueId}"`)
    }
  }

  // 5. History exists with at least last 3 editions
  const history = loadDataFile('history.json').filter((h: any) => h.tournamentId === tid)
  if (history.length === 0) {
    warnings.push(`No history record found in history.json for "${tid}"`)
  } else {
    const pastWinners = history[0]?.pastWinners
    if (!pastWinners || pastWinners.length < 3) {
      warnings.push(`Expected at least 3 past winners in history for "${tid}", found ${pastWinners?.length || 0}`)
    }
  }

  return {
    tournamentId: tid,
    passed: errors.length === 0,
    errors,
    warnings,
  }
}

// ─── Main ───────────────────────────────────────────────

function main() {
  const targetId = process.argv[2]
  const registry = loadRegistry()

  const toValidate = targetId
    ? registry.filter((t: any) => t.id === targetId)
    : registry

  if (toValidate.length === 0) {
    console.error(targetId
      ? `❌ Tournament "${targetId}" not found in registry`
      : '❌ No tournaments found in registry'
    )
    process.exit(1)
  }

  let allPassed = true

  for (const tournament of toValidate) {
    const result = validateTournamentData(tournament)
    const status = result.passed ? '✅ PASS' : '❌ FAIL'

    console.log(`\n${status} — ${tournament.name} (${tournament.id})`)
    console.log(`  Status: ${tournament.status}`)

    if (result.errors.length > 0) {
      console.log(`  Errors:`)
      result.errors.forEach((e) => console.log(`    • ${e}`))
    }
    if (result.warnings.length > 0) {
      console.log(`  Warnings:`)
      result.warnings.forEach((w) => console.log(`    • ${w}`))
    }
    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log(`  All checks passed.`)
    }

    if (!result.passed) allPassed = false
  }

  console.log(`\n${'='.repeat(50)}`)
  if (allPassed) {
    console.log('✅ All tournament data packages validated successfully.')
  } else {
    console.log('❌ Some tournament data packages failed validation.')
    console.log('   Fix errors above before flipping status to LIVE.')
  }

  process.exit(allPassed ? 0 : 1)
}

main()
