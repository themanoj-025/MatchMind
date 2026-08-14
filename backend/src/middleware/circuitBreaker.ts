/**
 * Circuit Breaker — External Service Resilience
 *
 * Wraps external API calls (Stripe, Anthropic, email, sports-data feed)
 * with circuit breaker pattern using opossum. Prevents cascading failures
 * when an external service is degraded.
 *
 * Usage:
 *   import { withBreaker } from '../middleware/circuitBreaker'
 *   const result = await withBreaker('stripe', () => stripe.customers.create(...))
 *
 * Each service gets its own circuit breaker. The breaker wraps a generic
 * "call an action function" handler. The actual action is passed at call time.
 *
 * Defaults: 50% failure rate over 3+ calls → open for 30s → half-open → 3 successes → closed
 */

import CircuitBreaker from 'opossum'
import logger from '../utils/logger'

interface BreakerOptions {
  name: string
  timeout?: number
  errorThresholdPercentage?: number
  resetTimeout?: number
  volumeThreshold?: number
}

const breakers = new Map<string, CircuitBreaker>()

function createBreaker(options: BreakerOptions): CircuitBreaker {
  // The breaker wraps a generic action executor.
  // The actual action function is passed as the first argument to fire().
  const breaker = new CircuitBreaker(async (actionFn: () => any) => {
    return actionFn()
  }, {
    timeout: options.timeout ?? 10_000,
    errorThresholdPercentage: options.errorThresholdPercentage ?? 50,
    resetTimeout: options.resetTimeout ?? 30_000,
    volumeThreshold: options.volumeThreshold ?? 3,
    name: options.name,
  })

  breaker.on('open', () => logger.warn({
    event: 'circuit_breaker.open',
    service: options.name,
  }, `Circuit breaker OPEN for ${options.name}`))

  breaker.on('halfOpen', () => logger.info({
    event: 'circuit_breaker.half_open',
    service: options.name,
  }, `Circuit breaker half-open for ${options.name}`))

  breaker.on('close', () => logger.info({
    event: 'circuit_breaker.close',
    service: options.name,
  }, `Circuit breaker CLOSED for ${options.name}`))

  breakers.set(options.name, breaker)
  return breaker
}

function getBreaker(name: string): CircuitBreaker {
  let breaker = breakers.get(name)
  if (!breaker) {
    breaker = createBreaker({ name })
  }
  return breaker
}

/**
 * Wrap an external API call with a circuit breaker.
 * Returns null if the circuit is open (caller must handle gracefully).
 */
export async function withBreaker<T>(
  serviceName: string,
  action: () => Promise<T>,
): Promise<T | null> {
  const breaker = getBreaker(serviceName)

  if (breaker.opened) {
    logger.info({
      event: 'circuit_breaker.open_skip',
      service: serviceName,
    }, `Circuit open for ${serviceName} — skipping call`)
    return null
  }

  try {
    const result = await breaker.fire(action)
    return result as T
  } catch (err: any) {
    logger.warn({
      event: 'circuit_breaker.fallback',
      service: serviceName,
      err: err instanceof Error ? (err as Error).message : String(err),
    }, `Call failed for ${serviceName} — returning null`)
    return null
  }
}

// ─── Pre-configured Breakers ───────────────────────────

createBreaker({ name: 'stripe', timeout: 15_000, errorThresholdPercentage: 40, resetTimeout: 60_000, volumeThreshold: 5 })
createBreaker({ name: 'anthropic', timeout: 30_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 3 })
createBreaker({ name: 'email', timeout: 10_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 3 })
createBreaker({ name: 'sportradar', timeout: 15_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 3 })

/**
 * Returns the current state of all circuit breakers.
 */
export function getBreakerStatus(): Record<string, { state: string; failures: number; successes: number }> {
  const status: Record<string, any> = {}
  for (const [name, breaker] of breakers) {
    status[name] = {
      state: breaker.status,
      failures: breaker.stats.failures,
      successes: breaker.stats.successes,
    }
  }
  return status
}
