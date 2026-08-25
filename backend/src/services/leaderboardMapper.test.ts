import { describe, it, expect } from 'vitest'
import { toLeaderboardEntry, type LeaderboardUser } from './leaderboardMapper'

const baseUser: LeaderboardUser = {
  id: 'user-1',
  username: 'alice',
  displayName: 'Alice',
  avatar: 'https://example.com/avatar.png',
  totalPoints: 500,
  weeklyPoints: 100,
  predAccuracy: 85.5,
  streakCurrent: 5,
  tier: 'GOLD',
  countryCode: 'US',
}

describe('toLeaderboardEntry', () => {
  it('maps user to leaderboard entry with default pointField', () => {
    const entry = toLeaderboardEntry(baseUser, 1)
    expect(entry.id).toBe('user-1')
    expect(entry.username).toBe('alice')
    expect(entry.name).toBe('Alice')
    expect(entry.avatar).toBe('https://example.com/avatar.png')
    expect(entry.points).toBe(500) // totalPoints by default
    expect(entry.accuracy).toBe(85.5)
    expect(entry.streak).toBe(5)
    expect(entry.tier).toBe('GOLD')
    expect(entry.rank).toBe(1)
  })

  it('uses custom pointField when specified', () => {
    const entry = toLeaderboardEntry(baseUser, 3, { pointField: 'weeklyPoints' })
    expect(entry.points).toBe(100)
    expect(entry.totalPoints).toBe(500) // totalPoints included when pointField !== 'totalPoints'
  })

  it('falls back to username when displayName is null', () => {
    const user = { ...baseUser, displayName: null }
    const entry = toLeaderboardEntry(user, 1)
    expect(entry.name).toBe('alice')
  })

  it('falls back to 0 when pointField value is undefined', () => {
    const user = { ...baseUser, totalPoints: undefined as any }
    const entry = toLeaderboardEntry(user, 1)
    expect(entry.points).toBe(0)
  })

  it('falls back to 0 for missing predAccuracy', () => {
    const user = { ...baseUser, predAccuracy: undefined as any }
    const entry = toLeaderboardEntry(user, 1)
    expect(entry.accuracy).toBe(0)
  })

  it('includes countryCode when present', () => {
    const entry = toLeaderboardEntry(baseUser, 1)
    expect(entry.countryCode).toBe('US')
  })

  it('omits countryCode when not present', () => {
    const user = { ...baseUser, countryCode: undefined }
    const entry = toLeaderboardEntry(user, 1)
    expect(entry).not.toHaveProperty('countryCode')
  })

  it('does not include totalPoints when using default field', () => {
    const entry = toLeaderboardEntry(baseUser, 1)
    // totalPoints is included only when pointField !== 'totalPoints'
    expect(entry).not.toHaveProperty('totalPoints')
  })

  it('assigns correct rank', () => {
    const entry = toLeaderboardEntry(baseUser, 42)
    expect(entry.rank).toBe(42)
  })
})
