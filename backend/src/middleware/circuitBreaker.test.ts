import { describe, it, expect } from 'vitest'
import { withBreaker, getBreakerStatus } from './circuitBreaker'

describe('withBreaker', () => {
  it('returns the result of a successful action', async () => {
    const result = await withBreaker('test-service', async () => 42)
    expect(result).toBe(42)
  })

  it('returns null when the action throws', async () => {
    const result = await withBreaker('test-service-fail', async () => {
      throw new Error('Service unavailable')
    })
    expect(result).toBeNull()
  })

  it('caches the same breaker instance for a service name', async () => {
    const r1 = await withBreaker('cached-service', async () => 'first')
    const r2 = await withBreaker('cached-service', async () => 'second')
    expect(r1).toBe('first')
    expect(r2).toBe('second')
  })

  it('works with async functions', async () => {
    const result = await withBreaker('async-service', async () => {
      return new Promise((resolve) => setTimeout(() => resolve('done'), 10))
    })
    expect(result).toBe('done')
  })
})

describe('getBreakerStatus', () => {
  it('returns status for pre-configured breakers', () => {
    const status = getBreakerStatus()
    expect(status).toHaveProperty('stripe')
    expect(status).toHaveProperty('anthropic')
    expect(status).toHaveProperty('email')
    expect(status).toHaveProperty('sportradar')
  })

  it('each breaker has state, failures, successes', () => {
    const status = getBreakerStatus()
    for (const [name, info] of Object.entries(status)) {
      expect(info).toHaveProperty('state')
      expect(info).toHaveProperty('failures')
      expect(info).toHaveProperty('successes')
      expect(['open', 'half-open', 'closed']).toContain(info.state)
    }
  })
})
