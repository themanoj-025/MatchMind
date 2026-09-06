/**
 * Idempotency Middleware
 *
 * Idempotency keys prevent duplicate processing of the same request when
 * clients retry after a network failure or timeout. The client sends an
 * `Idempotency-Key` header (UUID) on mutating requests. The server caches
 * the response for that key and returns it on repeat attempts.
 *
 * Concurrency: a per-key in-flight lock ensures two overlapping requests
 * with the same key never both execute. The first request becomes the
 * "leader" and publishes a promise; overlapping requests await that promise
 * and replay the leader's response instead of running the handler. If the
 * leader fails (non-2xx) or stalls past the staleness bound, followers fall
 * through and execute a fresh attempt — retrying after a failed attempt is
 * exactly what the key is for.
 *
 * Storage: in-memory Map with TTL. For multi-instance deployments, swap
 * to Redis (same pattern as rate-limit-redis) — the cache read/write AND the
 * in-flight lock must move to Redis so two instances cannot execute the same
 * key at once.
 *
 * Usage:
 *   router.post('/rooms', idempotent({ ttlMs: 86_400_000 }), ...)
 *
 * Routes that MUST be idempotent:
 *   - POST /api/rooms (room creation)
 *   - POST /api/stripe/create-checkout (checkout session)
 *   - Socket.IO PLACE_BID events (handled in socket/index.ts)
 *
 * Idempotency-Key requirements:
 *   - 36-char UUID v4 format
 *   - Must be unique per client per request
 *   - Reusing a key = replaying the same request
 */

import type { Request, Response, NextFunction } from 'express'
import logger from '../utils/logger'

interface CachedResponse {
  statusCode: number
  headers: Record<string, string>
  body: unknown
  createdAt: number
}

interface InflightEntry {
  /** Settles with the leader's cached response, or null if the leader failed/stalled. */
  done: Promise<CachedResponse | null>
  /** Resolves `done`. Kept so the staleness sweep can release waiters. */
  release: (value: CachedResponse | null) => void
  createdAt: number
}

const store = new Map<string, CachedResponse>()

/** Requests currently executing for a given scoped key (the in-flight lock). */
const inflight = new Map<string, InflightEntry>()

interface IdempotencyOptions {
  /** Time-to-live in milliseconds. Default: 24 hours. */
  ttlMs?: number
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * How long an in-flight entry may live before waiters give up and execute
 * themselves. Requests longer than this are treated as stalled; the timeout
 * prevents a hung handler from blocking every retry forever.
 */
const INFLIGHT_STALE_MS = 60_000

// ─── Module-level cleanup timer (shared singleton) ────────
const CLEANUP_INTERVAL_MS = 60_000 // 1 minute
const cleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now - entry.createdAt > DEFAULT_TTL_MS) {
      store.delete(key)
    }
  }
  for (const [key, entry] of inflight) {
    if (now - entry.createdAt > INFLIGHT_STALE_MS) {
      entry.release(null)
      inflight.delete(key)
    }
  }
}, CLEANUP_INTERVAL_MS)
cleanupTimer.unref()

/**
 * Test-only: clears cached responses and in-flight locks so tests can start
 * from a clean slate. Production state is cleared by TTL/staleness sweeps and
 * per-request `finish` handlers.
 */
export function resetIdempotencyState(): void {
  store.clear()
  inflight.clear()
}

function replayResponse(res: Response, cached: CachedResponse): Response {
  for (const [key, value] of Object.entries(cached.headers)) {
    res.setHeader(key, value)
  }
  return res.status(cached.statusCode).json(cached.body)
}

/**
 * Register this request as the in-flight leader for scopedKey: publish a
 * promise that overlapping requests await, and hook `res.json`/response
 * finish to settle it (with the cached response, or null on failure).
 */
function becomeLeader(req: Request, res: Response, scopedKey: string): void {
  let release!: (value: CachedResponse | null) => void
  const done = new Promise<CachedResponse | null>((resolve) => {
    release = resolve
  })
  const entry: InflightEntry = { done, release, createdAt: Date.now() }
  inflight.set(scopedKey, entry)

  // If the response completes without a cacheable JSON body (error path,
  // redirect, res.send, hung handler), release waiters so they can retry.
  // Identity guard: only delete if we are still the registered leader — a
  // follower that fell through may have replaced us by the time finish fires.
  res.once?.('finish', () => {
    release(null)
    if (inflight.get(scopedKey) === entry) {
      inflight.delete(scopedKey)
    }
  })

  // Override res.json to cache the response.
  const originalJson = res.json.bind(res)
  res.json = function (body: unknown) {
    // Only cache successful responses (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const cachedEntry: CachedResponse = {
        statusCode: res.statusCode,
        headers: {
          'content-type': (res.getHeader('content-type') as string) || 'application/json',
        },
        body,
        createdAt: Date.now(),
      }
      store.set(scopedKey, cachedEntry)
      release(cachedEntry)
      logger.info({
        event: 'idempotency.cache_stored',
        key: req.headers['idempotency-key'] as string,
        statusCode: res.statusCode,
      })
    }
    return originalJson(body)
  }
}

/**
 * Middleware factory: returns an idempotency-checking middleware.
 */
export function idempotent(options: IdempotencyOptions = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS

  return async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    // Only apply to mutating methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next()
    }

    const idempotencyKey = req.headers['idempotency-key'] as string

    // Idempotency key is optional — skip early (no monkey-patch overhead)
    if (!idempotencyKey) {
      return next()
    }

    // Validate UUID v4 format
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidV4Regex.test(idempotencyKey)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_IDEMPOTENCY_KEY',
          message: 'Idempotency-Key must be a valid UUID v4',
        },
      })
    }

    // Scoped key = method + path + idempotency key (prevents cross-endpoint collisions)
    const scopedKey = `${req.method}:${req.path}:${idempotencyKey}`

    // 1. Completed-cache check — replay a finished request
    const cached = store.get(scopedKey)
    if (cached) {
      // Check TTL
      if (Date.now() - cached.createdAt > ttlMs) {
        store.delete(scopedKey)
      } else {
        logger.info({
          event: 'idempotency.cache_hit',
          key: idempotencyKey,
          method: req.method,
          path: req.path,
        })
        return replayResponse(res, cached)
      }
    }

    // 2. In-flight lock — an overlapping request with the same key is already
    //    executing. Await its result and replay it instead of running again.
    const existing = inflight.get(scopedKey)
    if (existing) {
      const result = await existing.done
      if (result) {
        logger.info({
          event: 'idempotency.inflight_replay',
          key: idempotencyKey,
          method: req.method,
          path: req.path,
        })
        return replayResponse(res, result)
      }
      // Leader failed or stalled (null) — fall through and execute a fresh attempt.
    }

    // 3. Become the in-flight leader for this key.
    becomeLeader(req, res, scopedKey)

    return next()
  }
}