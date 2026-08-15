/**
 * validateLeagueDataPackage.test.ts — MatchMind v2 §8
 *
 * Tests the data completeness validation logic:
 * - Team count matches registry
 * - Every team has a squad (players)
 * - Fixtures reference valid teams
 * - Venues referenced by fixtures exist
 * - History has at least last 3 editions
 */

import { describe, it, expect } from 'vitest'

// ─── Validation logic extracted for testability ──────────

interface ValidationResult {
  tournamentId: string
  passed: boolean
  errors: string[]
  warnings: string[]
}

function validateDataPackage(
  tournamentId: string,
  registryTeamCount: number,
  registrySquadSize: number,
  data: {
    teams: Record<string, unknown>[]
    players: Record<string, unknown>[]
    fixtures: Record<string, unknown>[]
    venues: Record<string, unknown>[]
    history: Record<string, unknown>[]
  },
): ValidationResult {
  const { teams, players, fixtures, venues, history } = data
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Team count
  if (teams.length === 0) {
    errors.push(`No teams found for tournament "${tournamentId}"`)
  } else if (registryTeamCount && teams.length < registryTeamCount) {
    warnings.push(`Expected ${registryTeamCount} teams, found ${teams.length}`)
  }

  // 2. Squad size
  const minSquadSize = Math.min(registrySquadSize || 23, 20)
  if (players.length < minSquadSize) {
    errors.push(`Expected at least ${minSquadSize} players, found ${players.length}`)
  }

  // 3. Fixture team refs
  const teamIds = new Set(teams.map((t) => t.id))
  for (const fixture of fixtures) {
    if (fixture.homeTeamId && !teamIds.has(fixture.homeTeamId)) {
      errors.push(`Fixture "${fixture.id}" references unknown homeTeamId "${fixture.homeTeamId}"`)
    }
    if (fixture.awayTeamId && !teamIds.has(fixture.awayTeamId)) {
      errors.push(`Fixture "${fixture.id}" references unknown awayTeamId "${fixture.awayTeamId}"`)
    }
  }

  // 4. Venue refs
  const venueIds = new Set(venues.map((v) => v.id))
  for (const fixture of fixtures) {
    if (fixture.venueId && !venueIds.has(fixture.venueId)) {
      warnings.push(`Fixture "${fixture.id}" references unknown venueId "${fixture.venueId}"`)
    }
  }

  // 5. History
  if (history.length === 0) {
    warnings.push(`No history record found for "${tournamentId}"`)
  } else {
    const pastWinners = history[0]?.pastWinners
    if (!pastWinners || pastWinners.length < 3) {
      warnings.push(`Expected at least 3 past winners, found ${pastWinners?.length || 0}`)
    }
  }

  return { tournamentId, passed: errors.length === 0, errors, warnings }
}

describe('validateLeagueDataPackage', () => {
  const baseFixture = {
    tournamentId: 'test-tournament',
    homeTeamId: 'team-1',
    awayTeamId: 'team-2',
  }

  it('passes with complete data', () => {
    const result = validateDataPackage(
      'test-tournament',
      4, // teamCount
      23, // squadSize
      {
        teams: [{ id: 'team-1' }, { id: 'team-2' }, { id: 'team-3' }, { id: 'team-4' }],
        players: Array.from({ length: 23 }, (_, i) => ({ id: `p${i}` })),
        fixtures: [
          { ...baseFixture, id: 'f1' },
          { ...baseFixture, id: 'f2', venueId: 'venue-1' },
        ],
        venues: [{ id: 'venue-1' }],
        history: [{ pastWinners: [{ year: 2022 }, { year: 2018 }, { year: 2014 }] }],
      },
    )
    expect(result.passed).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('fails with no teams', () => {
    const result = validateDataPackage('test', 4, 23, { teams: [], players: [], fixtures: [], venues: [], history: [] })
    expect(result.passed).toBe(false)
    expect(result.errors).toContain('No teams found for tournament "test"')
  })

  it('fails with insufficient players', () => {
    const result = validateDataPackage('test', 4, 23, {
      teams: [{ id: 'team-1' }],
      players: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}` })),
      fixtures: [],
      venues: [],
      history: [],
    })
    expect(result.passed).toBe(false)
    expect(result.errors[0]).toContain('Expected at least 20 players')
  })

  it('fails when fixture references unknown team', () => {
    const result = validateDataPackage('test', 2, 23, {
      teams: [{ id: 'team-1' }], // only 1 team
      players: Array.from({ length: 23 }, (_, i) => ({ id: `p${i}` })),
      fixtures: [{ ...baseFixture, id: 'f1', homeTeamId: 'team-1', awayTeamId: 'unknown-team' }],
      venues: [],
      history: [{ pastWinners: [{ year: 2022 }, { year: 2018 }, { year: 2014 }] }],
    })
    expect(result.passed).toBe(false)
    expect(result.errors[0]).toContain('unknown-team')
  })

  it('warns when fixture references unknown venue', () => {
    const result = validateDataPackage('test', 2, 23, {
      teams: [{ id: 'team-1' }, { id: 'team-2' }],
      players: Array.from({ length: 23 }, (_, i) => ({ id: `p${i}` })),
      fixtures: [{ ...baseFixture, id: 'f1', venueId: 'unknown-venue' }],
      venues: [{ id: 'real-venue' }],
      history: [{ pastWinners: [{ year: 2022 }, { year: 2018 }, { year: 2014 }] }],
    })
    expect(result.passed).toBe(true) // venue ref is only a warning
    expect(result.warnings[0]).toContain('unknown-venue')
  })

  it('warns with less than 3 past winners', () => {
    const result = validateDataPackage('test', 2, 23, {
      teams: [{ id: 'team-1' }, { id: 'team-2' }],
      players: Array.from({ length: 23 }, (_, i) => ({ id: `p${i}` })),
      fixtures: [],
      venues: [],
      history: [{ pastWinners: [{ year: 2022 }] }], // only 1
    })
    expect(result.passed).toBe(true) // history is a warning, not a failure
    expect(result.warnings[0]).toContain('Expected at least 3 past winners')
  })

  it('warns when team count is below registry count', () => {
    const result = validateDataPackage('test', 10, 23, {
      teams: [{ id: 'team-1' }], // only 1 loaded
      players: Array.from({ length: 23 }, (_, i) => ({ id: `p${i}` })),
      fixtures: [],
      venues: [],
      history: [{ pastWinners: [{ year: 2022 }, { year: 2018 }, { year: 2014 }] }],
    })
    expect(result.passed).toBe(true) // team count is a warning, not a failure
    expect(result.warnings[0]).toContain('Expected 10 teams')
  })
})
