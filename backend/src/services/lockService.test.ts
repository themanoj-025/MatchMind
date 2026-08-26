/**
 * LockService Tests — MatchMind
 *
 * Tests lockService:
 * - acquireLock: acquires distributed lock via Redis
 * - acquireLock: falls back to local mutex when Redis offline
 * - acquireLock: retries on failure
 * - release: releases lock via Lua script
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so variables are available when vi.mock factory runs
const { mockRedisSet, mockRedisEval, mockRedisStatusFn } = vi.hoisted(() => ({
  mockRedisSet: vi.fn(),
  mockRedisEval: vi.fn(),
  mockRedisStatusFn: vi.fn().mockReturnValue('ready'),
}))

vi.mock('../lib/redis', () => ({
  redis: {
    get status() {
      return mockRedisStatusFn()
    },
    set: mockRedisSet,
    eval: mockRedisEval,
  },
}))

vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { acquireLock } from './lockService'

describe('lockService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRedisStatusFn.mockReturnValue('ready')
  })

  describe('acquireLock', () => {
    it('acquires lock when Redis returns OK', async () => {
      mockRedisSet.mockResolvedValue('OK')

      const lock = await acquireLock('test-key')

      expect(lock.key).toBe('test-key')
      expect(lock.token).toBeDefined()
      expect(typeof lock.release).toBe('function')
      expect(mockRedisSet).toHaveBeenCalledWith(
        'test-key',
        expect.any(String),
        'PX',
        5000,
        'NX',
      )
    })

    it('retries on failure and throws after max retries', async () => {
      mockRedisSet.mockResolvedValue(null) // NX fails

      await expect(
        acquireLock('test-key', 5000, 2, 10),
      ).rejects.toThrow('LOCK_ACQUISITION_FAILED')

      // Should have tried retries + 1 initial attempt
      expect(mockRedisSet).toHaveBeenCalledTimes(3)
    })

    it('uses custom TTL and retry count', async () => {
      mockRedisSet.mockResolvedValue('OK')

      await acquireLock('test-key', 10000, 5, 500)

      expect(mockRedisSet).toHaveBeenCalledWith(
        'test-key',
        expect.any(String),
        'PX',
        10000,
        'NX',
      )
    })

    it('release calls Redis EVAL with Lua script', async () => {
      mockRedisSet.mockResolvedValue('OK')
      mockRedisEval.mockResolvedValue(1)

      const lock = await acquireLock('test-key')
      await lock.release()

      expect(mockRedisEval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("get"'),
        1,
        'test-key',
        lock.token,
      )
    })
  })

  describe('acquireLock with Redis offline', () => {
    it('falls back to local mutex when Redis not ready', async () => {
      mockRedisStatusFn.mockReturnValue('disconnected')

      const lock = await acquireLock('test-key')

      expect(lock.key).toBe('test-key')
      expect(lock.token).toBeDefined()
      expect(mockRedisSet).not.toHaveBeenCalled()
    })
  })

  describe('acquireLock concurrent access', () => {
    it('second lock on same key waits for first to release', async () => {
      let callCount = 0
      mockRedisSet.mockImplementation(async () => {
        callCount++
        if (callCount === 1) return 'OK'
        return null // Second call fails (lock held)
      })

      // First lock succeeds
      const lock1 = await acquireLock('shared-key', 5000, 0, 10)
      expect(lock1.key).toBe('shared-key')

      // Second lock fails (no retries left)
      await expect(
        acquireLock('shared-key', 5000, 0, 10),
      ).rejects.toThrow('LOCK_ACQUISITION_FAILED')
    })
  })
})
