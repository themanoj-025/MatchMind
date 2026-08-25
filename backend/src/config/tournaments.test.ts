import { describe, it, expect } from 'vitest'
import { getTournament, isValidTournamentId, listLive, listAnnounced, listVisible, POSITIONS, DEFAULT_ROSTER_RULES, BID_INCREMENTS } from './tournaments'

describe('tournament accessors', () => {
  it('getTournament returns a tournament by ID', () => {
    const tournament = getTournament('fifa-wc-2026')
    expect(tournament).toBeDefined()
    expect(tournament?.id).toBe('fifa-wc-2026')
  })

  it('getTournament returns undefined for unknown ID', () => {
    expect(getTournament('nonexistent')).toBeUndefined()
  })

  it('isValidTournamentId returns true for valid IDs', () => {
    expect(isValidTournamentId('fifa-wc-2026')).toBe(true)
  })

  it('isValidTournamentId returns false for invalid IDs', () => {
    expect(isValidTournamentId('fake-tournament')).toBe(false)
  })

  it('listLive returns only LIVE tournaments', () => {
    const live = listLive()
    expect(Array.isArray(live)).toBe(true)
    for (const t of live) {
      expect(t.status).toBe('LIVE')
    }
  })

  it('listAnnounced returns only ANNOUNCED tournaments', () => {
    const announced = listAnnounced()
    expect(Array.isArray(announced)).toBe(true)
    for (const t of announced) {
      expect(t.status).toBe('ANNOUNCED')
    }
  })

  it('listVisible excludes ANNOUNCED_NOT_CONFIRMED', () => {
    const visible = listVisible()
    for (const t of visible) {
      expect(t.status).not.toBe('ANNOUNCED_NOT_CONFIRMED')
    }
  })
})

describe('POSITIONS', () => {
  it('contains all 4 positions', () => {
    expect(POSITIONS).toEqual(['GK', 'DEF', 'MID', 'FWD'])
  })
})

describe('DEFAULT_ROSTER_RULES', () => {
  it('has reasonable defaults', () => {
    expect(DEFAULT_ROSTER_RULES.GK).toBe(2)
    expect(DEFAULT_ROSTER_RULES.DEF).toBe(5)
    expect(DEFAULT_ROSTER_RULES.MID).toBe(5)
    expect(DEFAULT_ROSTER_RULES.FWD).toBe(3)
    expect(DEFAULT_ROSTER_RULES.total).toBe(15)
  })

  it('total matches sum of positions', () => {
    const sum = DEFAULT_ROSTER_RULES.GK + DEFAULT_ROSTER_RULES.DEF + DEFAULT_ROSTER_RULES.MID + DEFAULT_ROSTER_RULES.FWD
    expect(DEFAULT_ROSTER_RULES.total).toBe(sum)
  })
})

describe('BID_INCREMENTS', () => {
  it('starts at threshold 0', () => {
    expect(BID_INCREMENTS[0].threshold).toBe(0)
  })

  it('has increasing thresholds', () => {
    for (let i = 1; i < BID_INCREMENTS.length; i++) {
      expect(BID_INCREMENTS[i].threshold).toBeGreaterThan(BID_INCREMENTS[i - 1].threshold)
    }
  })

  it('has positive increments', () => {
    for (const inc of BID_INCREMENTS) {
      expect(inc.increment).toBeGreaterThan(0)
    }
  })
})
