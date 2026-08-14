/**
 * Idempotency Middleware
 *
 * Idempotency keys prevent duplicate processing of the same request when
 * clients retry after a network failure or timeout. The client sends an
 * `Idempotency-Key` header (UUID) on mutating requests. The server caches
 * the response for that key and returns it on repeat attempts.
 *
 * Storage: in-memory Map with TTL. For multi-instance deployments, swap
 * to Redis (same pattern as rate-limit-redis).
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
import crypto from 'crypto'
import logger from '../utils/logger'

interface CachedResponse {
  statusCode: number
  headers: Record<string, string>
  body: any
  createdAt: number
}

const store = new Map<string, CachedResponse>()

interface IdempotencyOptions {
  /** Time-to-live in milliseconds. Default: 24 hours. */
  ttlMs?: number
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// ─── Module-level cleanup timer (shared singleton) ────────
const CLEANUP_INTERVAL_MS = 60_000 // 1 minute
const cleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now - entry.createdAt > DEFAULT_TTL_MS) {
      store.delete(key)
    }
  }
}, CLEANUP_INTERVAL_MS)
cleanupTimer.unref()

/**
 * Middleware factory: returns an idempotency-checking middleware.
 */
export function idempotent(options: IdempotencyOptions = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS

  return (req: Request, res: Response, next: NextFunction): void => {
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
      res.status(400).json({
        error: {
          code: 'INVALID_IDEMPOTENCY_KEY',
          message: 'Idempotency-Key must be a valid UUID v4',
        },
      })
      return
    }

    // Scoped key = method + path + idempotency key (prevents cross-endpoint collisions)
    const scopedKey = `${req.method}:${req.path}:${idempotencyKey}`

    // Check cache
    const cached = store.get(scopedKey)
    if (cached) {
      // Check TTL
      if (Date.now() - cached.createdAt > ttlMs) {
        store.delete(scopedKey)
      } else {
        // Return cached response
        logger.info({
          event: 'idempotency.cache_hit',
          key: idempotencyKey,
          method: req.method,
          path: req.path,
        })
        for (const [key, value] of Object.entries(cached.headers)) {
          res.setHeader(key, value)
        }
        res.status(cached.statusCode).json(cached.body)
        return
      }
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res)
    res.json = function (body: any) {
      // Only cache successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.set(scopedKey, {
          statusCode: res.statusCode,
          headers: {
            'content-type': res.getHeader('content-type') as string || 'application/json',
          },
          body,
          createdAt: Date.now(),
        })
        logger.info({
          event: 'idempotency.cache_stored',
          key: idempotencyKey,
          statusCode: res.statusCode,
        })
      }
      return originalJson(body)
    }

    next()
  }
}
