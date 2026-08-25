import { describe, it, expect } from 'vitest'
import { rollRarity, computeSynergyScore, checkFormationFillBonus, type SquadPlayer, type FormationSlot } from './draftService'

describe('rollRarity', () => {
  it('returns a valid rarity tier name', () => {
    const validTiers = ['BRONZE', 'SILVER', 'GOLD', 'ICON']
    for (let i = 0; i < 100; i++) {
      expect(validTiers).toContain(rollRarity())
    }
  })

  it('returns BRONZE most often (highest pack weight)', () => {
    const counts: Record<string, number> = { BRONZE: 0, SILVER: 0, GOLD: 0, ICON: 0 }
    for (let i = 0; i < 1000; i++) {
      counts[rollRarity()]!++
    }
    // BRONZE has 55% weight, so should be most common
    expect(counts.BRONZE).toBeGreaterThan(counts.SILVER)
  })

  it('returns ICON rarely (2% weight)', () => {
    const counts = { ICON: 0 }
    for (let i = 0; i < 1000; i++) {
      if (rollRarity() === 'ICON') counts.ICON++
    }
    // ICON has 2% weight — should be ~20 out of 1000
    expect(counts.ICON).toBeLessThan(60)
  })
})

describe('computeSynergyScore', () => {
  const allPlayers = [
    { id: 'p1', name: 'A', position: 'DEF', club: 'Barca', nationality: 'Spain', basePrice: 50, rarityTier: 'GOLD' },
    { id: 'p2', name: 'B', position: 'DEF', club: 'Barca', nationality: 'Spain', basePrice: 40, rarityTier: 'SILVER' },
    { id: 'p3', name: 'C', position: 'DEF', club: 'Barca', nationality: 'Spain', basePrice: 30, rarityTier: 'BRONZE' },
    { id: 'p4', name: 'D', position: 'MID', club: 'Real', nationality: 'France', basePrice: 60, rarityTier: 'GOLD' },
    { id: 'p5', name: 'E', position: 'FWD', club: 'Real', nationality: 'France', basePrice: 70, rarityTier: 'ICON' },
    { id: 'p6', name: 'F', position: 'FWD', club: 'Real', nationality: 'France', basePrice: 55, rarityTier: 'GOLD' },
  ]

  it('returns 0 for no clusters', () => {
    const squad: SquadPlayer[] = [
      { playerId: 'p1', position: 'DEF', slotIndex: 0, isAutoPicked: false, rarityTier: 'GOLD' },
      { playerId: 'p4', position: 'MID', slotIndex: 1, isAutoPicked: false, rarityTier: 'GOLD' },
    ]
    expect(computeSynergyScore(squad, allPlayers)).toBe(0)
  })

  it('gives nationality + club bonus for 3 players from same country/club', () => {
    // 3 Spain/Barca players:
    //   nationality bonus: (3 - 2) * 1 = 1
    //   club bonus: (3 - 1) * 2 = 4
    //   total = 5
    const squad: SquadPlayer[] = [
      { playerId: 'p1', position: 'DEF', slotIndex: 0, isAutoPicked: false, rarityTier: 'GOLD' },
      { playerId: 'p2', position: 'DEF', slotIndex: 1, isAutoPicked: false, rarityTier: 'SILVER' },
      { playerId: 'p3', position: 'DEF', slotIndex: 2, isAutoPicked: false, rarityTier: 'BRONZE' },
    ]
    expect(computeSynergyScore(squad, allPlayers)).toBe(5)
  })

  it('gives nationality + club bonus for 3 Real/France players', () => {
    // 3 France/Real players:
    //   nationality bonus: (3 - 2) * 1 = 1
    //   club bonus: (3 - 1) * 2 = 4
    //   total = 5
    const squad: SquadPlayer[] = [
      { playerId: 'p4', position: 'MID', slotIndex: 0, isAutoPicked: false, rarityTier: 'GOLD' },
      { playerId: 'p5', position: 'FWD', slotIndex: 1, isAutoPicked: false, rarityTier: 'ICON' },
      { playerId: 'p6', position: 'FWD', slotIndex: 2, isAutoPicked: false, rarityTier: 'GOLD' },
    ]
    expect(computeSynergyScore(squad, allPlayers)).toBe(5)
  })

  it('caps bonus at 15% (DRAFT.SYNERGY_MAX_BONUS)', () => {
    // Build a large squad with many clusters to exceed cap
    const bigSquad: SquadPlayer[] = Array.from({ length: 15 }, (_, i) => ({
      playerId: `p${i + 1}`,
      position: 'MID' as const,
      slotIndex: i,
      isAutoPicked: false,
      rarityTier: 'GOLD',
    }))
    const bigPlayers = bigSquad.map((sp) => ({
      id: sp.playerId,
      name: `Player ${sp.playerId}`,
      position: 'MID',
      club: 'ClubA',
      nationality: 'NationA',
      basePrice: 50,
      rarityTier: 'GOLD',
    }))
    expect(computeSynergyScore(bigSquad, bigPlayers)).toBe(15) // capped
  })

  it('handles missing player IDs gracefully', () => {
    const squad: SquadPlayer[] = [
      { playerId: 'nonexistent', position: 'DEF', slotIndex: 0, isAutoPicked: false, rarityTier: 'BRONZE' },
    ]
    expect(computeSynergyScore(squad, allPlayers)).toBe(0)
  })
})

describe('checkFormationFillBonus', () => {
  const formationSlots: FormationSlot[] = [
    { position: 'GK', count: 1 },
    { position: 'DEF', count: 2 },
    { position: 'MID', count: 2 },
    { position: 'FWD', count: 1 },
  ]

  it('returns true when all formation slots are filled', () => {
    const picks = [
      { position: 'GK', pickedPlayerId: 'p1', slotIndex: 0 },
      { position: 'DEF', pickedPlayerId: 'p2', slotIndex: 1 },
      { position: 'DEF', pickedPlayerId: 'p3', slotIndex: 2 },
      { position: 'MID', pickedPlayerId: 'p4', slotIndex: 3 },
      { position: 'MID', pickedPlayerId: 'p5', slotIndex: 4 },
      { position: 'FWD', pickedPlayerId: 'p6', slotIndex: 5 },
    ] as any
    expect(checkFormationFillBonus(picks, formationSlots)).toBe(true)
  })

  it('returns false when a position is short', () => {
    const picks = [
      { position: 'GK', pickedPlayerId: 'p1', slotIndex: 0 },
      { position: 'DEF', pickedPlayerId: 'p2', slotIndex: 1 },
      // missing 2nd DEF
      { position: 'MID', pickedPlayerId: 'p4', slotIndex: 3 },
      { position: 'MID', pickedPlayerId: 'p5', slotIndex: 4 },
      { position: 'FWD', pickedPlayerId: 'p6', slotIndex: 5 },
    ] as any
    expect(checkFormationFillBonus(picks, formationSlots)).toBe(false)
  })

  it('returns false when picks have null pickedPlayerId', () => {
    const picks = [
      { position: 'GK', pickedPlayerId: null, slotIndex: 0 },
      { position: 'DEF', pickedPlayerId: 'p2', slotIndex: 1 },
      { position: 'DEF', pickedPlayerId: 'p3', slotIndex: 2 },
      { position: 'MID', pickedPlayerId: 'p4', slotIndex: 3 },
      { position: 'MID', pickedPlayerId: 'p5', slotIndex: 4 },
      { position: 'FWD', pickedPlayerId: 'p6', slotIndex: 5 },
    ] as any
    expect(checkFormationFillBonus(picks, formationSlots)).toBe(false)
  })

  it('returns true with empty formation (no required slots)', () => {
    expect(checkFormationFillBonus([], [])).toBe(true)
  })
})
