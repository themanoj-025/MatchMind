/**
 * Cache Service Tests — MatchMind
 *
 * Tests CacheService:
 * - get: cache hit returns parsed data, miss returns null
 * - set: stores JSON with TTL
 * - getOrFetch: returns cached value or fetches + caches
 * - Graceful degradation when Redis is disconnected
 * - Error handling for malformed JSON
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock logger
vi.mock('../utils/logger', () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

import { CacheService } from './cacheService'

function createMockRedis(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ready',
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    ...overrides,
  }
}

describe('CacheService', () => {
  let redis: ReturnType<typeof createMockRedis>
  let cache: CacheService

  beforeEach(() => {
    vi.clearAllMocks()
    redis = createMockRedis()
    cache = new CacheService({ redis: redis as any })
  })

  describe('get', () => {
    it('returns parsed JSON on cache hit', async () => {
      redis.get = vi.fn().mockResolvedValue(JSON.stringify({ foo: 'bar' }))

      const result = await cache.get<{ foo: string }>('key1')

      expect(result).toEqual({ foo: 'bar' })
      expect(redis.get).toHaveBeenCalledWith('key1')
    })

    it('returns null on cache miss', async () => {
      redis.get = vi.fn().mockResolvedValue(null)

      const result = await cache.get('key1')

      expect(result).toBeNull()
    })

    it('returns null when Redis is disconnected', async () => {
      redis.status = 'end'

      const result = await cache.get('key1')

      expect(result).toBeNull()
      expect(redis.get).not.toHaveBeenCalled()
    })

    it('returns null and logs error for malformed JSON', async () => {
      redis.get = vi.fn().mockResolvedValue('not-json{{{')

      const result = await cache.get('key1')

      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('stores JSON string with TTL', async () => {
      await cache.set('key1', { data: 42 }, 300)

      expect(redis.set).toHaveBeenCalledWith('key1', '{"data":42}', 'EX', 300)
    })

    it('does not store when Redis is disconnected', async () => {
      redis.status = 'end'

      await cache.set('key1', { data: 42 }, 300)

      expect(redis.set).not.toHaveBeenCalled()
    })

    it('does not store null/undefined values', async () => {
      await cache.set('key1', null, 300)
      await cache.set('key2', undefined, 300)

      expect(redis.set).not.toHaveBeenCalled()
    })
  })

  describe('getOrFetch', () => {
    it('returns cached value when available', async () => {
      redis.get = vi.fn().mockResolvedValue(JSON.stringify({ cached: true }))

      const fetcher = vi.fn()
      const result = await cache.getOrFetch('key1', 300, fetcher)

      expect(result).toEqual({ cached: true })
      expect(fetcher).not.toHaveBeenCalled()
    })

    it('calls fetcher and caches result on miss', async () => {
      redis.get = vi.fn().mockResolvedValue(null)
      const fetcher = vi.fn().mockResolvedValue({ fresh: true })

      const result = await cache.getOrFetch('key1', 300, fetcher)

      expect(result).toEqual({ fresh: true })
      expect(fetcher).toHaveBeenCalled()
      expect(redis.set).toHaveBeenCalledWith('key1', '{"fresh":true}', 'EX', 300)
    })

    it('returns fetcher result even if caching fails', async () => {
      redis.get = vi.fn().mockResolvedValue(null)
      redis.set = vi.fn().mockRejectedValue(new Error('Redis down'))
      const fetcher = vi.fn().mockResolvedValue({ data: 'ok' })

      const result = await cache.getOrFetch('key1', 300, fetcher)

      expect(result).toEqual({ data: 'ok' })
    })
  })
})
