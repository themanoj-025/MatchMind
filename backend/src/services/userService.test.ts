/**
 * User Service Tests — MatchMind
 *
 * Tests UserService:
 * - getUser: returns PublicUser or null
 * - checkUsernameAvailable: validation + availability
 * - getUserProfile: returns public profile fields
 * - updateProfile: cleans and delegates to repository
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserService, type PublicUser } from './userService'
import type { IUserRepository, UserData } from '../repositories/types'

function createMockUser(overrides: Partial<UserData> = {}): UserData {
  return {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    displayName: 'Test User',
    avatar: null,
    bio: null,
    countryCode: null,
    totalPoints: 0,
    globalRank: null,
    predAccuracy: null,
    streakCurrent: 0,
    tier: 'BRONZE',
    isPro: false,
    proExpiresAt: null,
    tokenVersion: 0,
    favouriteSports: [],
    favouriteTeams: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as UserData
}

function createMockRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    findByUsername: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(createMockUser()),
    update: vi.fn().mockImplementation((_id: string, data: Partial<UserData>) =>
      Promise.resolve(createMockUser(data)),
    ),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('UserService', () => {
  let repo: ReturnType<typeof createMockRepo>
  let service: UserService

  beforeEach(() => {
    repo = createMockRepo()
    service = new UserService({ userRepository: repo })
  })

  describe('getUser', () => {
    it('returns PublicUser when user exists', async () => {
      repo.findById = vi.fn().mockResolvedValue(createMockUser({ id: 'user-1' }))

      const result = await service.getUser('user-1')

      expect(result).toMatchObject({
        id: 'user-1',
        username: 'testuser',
        displayName: 'Test User',
        avatar: null,
        isPro: false,
        proExpiresAt: null,
      })
    })

    it('returns null when user does not exist', async () => {
      repo.findById = vi.fn().mockResolvedValue(null)

      const result = await service.getUser('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('checkUsernameAvailable', () => {
    it('returns false for short usernames', async () => {
      const result = await service.checkUsernameAvailable('ab')
      expect(result).toBe(false)
    })

    it('returns false for empty username', async () => {
      const result = await service.checkUsernameAvailable('')
      expect(result).toBe(false)
    })

    it('returns true when username is available', async () => {
      repo.findByUsername = vi.fn().mockResolvedValue(null)

      const result = await service.checkUsernameAvailable('newuser')

      expect(result).toBe(true)
      expect(repo.findByUsername).toHaveBeenCalledWith('newuser')
    })

    it('returns false when username is taken', async () => {
      repo.findByUsername = vi.fn().mockResolvedValue(createMockUser({ username: 'takenuser' }))

      const result = await service.checkUsernameAvailable('takenuser')

      expect(result).toBe(false)
    })
  })

  describe('getUserProfile', () => {
    it('returns profile fields when user exists', async () => {
      repo.findById = vi.fn().mockResolvedValue(
        createMockUser({
          id: 'user-1',
          totalPoints: 500,
          globalRank: 42,
          predAccuracy: 75.5,
          streakCurrent: 3,
          tier: 'GOLD',
        }),
      )

      const result = await service.getUserProfile('user-1')

      expect(result).toMatchObject({
        id: 'user-1',
        username: 'testuser',
        totalPoints: 500,
        globalRank: 42,
        predAccuracy: 75.5,
        streakCurrent: 3,
        tier: 'GOLD',
      })
    })

    it('returns null when user does not exist', async () => {
      repo.findById = vi.fn().mockResolvedValue(null)

      const result = await service.getUserProfile('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('updateProfile', () => {
    it('updates displayName', async () => {
      repo.update = vi.fn().mockImplementation((_id: string, data: Partial<UserData>) =>
        Promise.resolve(createMockUser(data)),
      )

      const result = await service.updateProfile('user-1', { displayName: 'New Name' })

      expect(repo.update).toHaveBeenCalledWith('user-1', { displayName: 'New Name' })
    })

    it('updates avatar to null', async () => {
      repo.update = vi.fn().mockImplementation((_id: string, data: Partial<UserData>) =>
        Promise.resolve(createMockUser(data)),
      )

      const result = await service.updateProfile('user-1', { avatar: null })

      expect(repo.update).toHaveBeenCalledWith('user-1', { avatar: null })
    })

    it('filters out undefined values', async () => {
      repo.update = vi.fn().mockImplementation((_id: string, data: Partial<UserData>) =>
        Promise.resolve(createMockUser(data)),
      )

      await service.updateProfile('user-1', { displayName: 'New' })

      const callData = repo.update.mock.calls[0][1]
      expect(Object.keys(callData)).not.toContain('avatar')
      expect(Object.keys(callData)).not.toContain('bio')
    })
  })
})
