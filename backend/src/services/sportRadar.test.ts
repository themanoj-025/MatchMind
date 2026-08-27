/**
 * SportRadarService Tests — MatchMind
 *
 * Tests SportRadarService:
 * - getDailySchedule: fetches match schedule from SportRadar API
 * - Handles missing API key gracefully
 * - Handles API errors
 * - Maps response data correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock logger to avoid console output
vi.mock('../utils/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// Mock env module
let mockApiKey: string | undefined = undefined
vi.mock('../config/env', () => ({
  env: {
    get SPORTRADAR_API_KEY() {
      return mockApiKey
    },
  },
}))

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('SportRadarService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiKey = undefined
  })

  describe('getDailySchedule', () => {
    it('should return empty array when API key is missing', async () => {
      // Dynamic import to get fresh instance with no API key
      const { SportRadarService } = await import('./sportRadar')
      const service = new SportRadarService()

      const result = await service.getDailySchedule('2026-01-01')

      expect(result).toEqual([])
    })

    it('should fetch and parse schedule data', async () => {
      mockApiKey = 'test-api-key'

      const { SportRadarService } = await import('./sportRadar')
      const service = new SportRadarService()

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          sport_events: [
            {
              id: 'match-1',
              scheduled: '2026-01-01T10:00:00Z',
              status: 'scheduled',
              competitors: [
                { id: 'team-1', name: 'Team A', abbreviation: 'TMA' },
                { id: 'team-2', name: 'Team B', abbreviation: 'TMB' },
              ],
            },
          ],
        }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await service.getDailySchedule('2026-01-01')

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 'match-1',
        scheduled: '2026-01-01T10:00:00Z',
        status: 'scheduled',
        home_team: { id: 'team-1', name: 'Team A', alias: 'TMA' },
        away_team: { id: 'team-2', name: 'Team B', alias: 'TMB' },
      })
    })

    it('should filter out events with missing competitors', async () => {
      mockApiKey = 'test-api-key'

      const { SportRadarService } = await import('./sportRadar')
      const service = new SportRadarService()

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          sport_events: [
            {
              id: 'match-1',
              scheduled: '2026-01-01T10:00:00Z',
              status: 'scheduled',
              competitors: [
                { id: 'team-1', name: 'Team A', abbreviation: 'TMA' },
              ],
            },
            {
              id: 'match-2',
              scheduled: '2026-01-01T12:00:00Z',
              status: 'scheduled',
              competitors: [
                { id: 'team-2', name: 'Team B', abbreviation: 'TMB' },
                { id: 'team-3', name: 'Team C', abbreviation: 'TMC' },
              ],
            },
          ],
        }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await service.getDailySchedule('2026-01-01')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('match-2')
    })

    it('should return empty array when no sport_events', async () => {
      mockApiKey = 'test-api-key'

      const { SportRadarService } = await import('./sportRadar')
      const service = new SportRadarService()

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await service.getDailySchedule('2026-01-01')

      expect(result).toEqual([])
    })

    it('should throw on API error', async () => {
      mockApiKey = 'test-api-key'

      const { SportRadarService } = await import('./sportRadar')
      const service = new SportRadarService()

      const mockResponse = {
        ok: false,
        statusText: 'Unauthorized',
      }
      mockFetch.mockResolvedValue(mockResponse)

      await expect(service.getDailySchedule('2026-01-01')).rejects.toThrow('SportRadar API error')
    })

    it('should throw on network error', async () => {
      mockApiKey = 'test-api-key'

      const { SportRadarService } = await import('./sportRadar')
      const service = new SportRadarService()

      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(service.getDailySchedule('2026-01-01')).rejects.toThrow('Network error')
    })
  })
})
