import { describe, it, expect, vi } from 'vitest'
import { acquireLock } from '../services/lockService'
import { redis } from '../lib/redis'

describe('Remediation Phase 2 Tests — Distributed Lock & OCC', () => {

  describe('Lock Service fallback', () => {
    it('should degrade to local mutex if Redis is offline', async () => {
      // Temporarily mock redis status
      const originalStatus = redis.status
      redis.status = 'disconnected'

      try {
        const lock1 = await acquireLock('test-lock')
        expect(lock1).toBeDefined()
        expect(lock1.key).toBe('test-lock')

        // Try acquiring lock1 again — since it uses local Mutex fallback, it should block.
        // We set a timeout and expect it to not resolve immediately
        let lock2Acquired = false
        const lock2Promise = acquireLock('test-lock').then(() => {
          lock2Acquired = true
        })

        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(lock2Acquired).toBe(false)

        await lock1.release()
        await lock2Promise
        expect(lock2Acquired).toBe(true)
      } finally {
        redis.status = originalStatus
      }
    })
  })
})
