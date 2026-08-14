import { env } from '../config/env'
/**
 * Rate limiting middleware using express-rate-limit.
 *
 * Tiers:
 * - Login/signup: 5 requests / 15 min / IP
 * - Password reset: 3 requests / hour / IP+email
 * - Predictions (POST only): 30 requests / min / user
 * - Global: 100 requests / min / IP
 * - AI prediction: 10 requests / hour / user
 *
 * Shares one Redis client across all limiters when available.
 * Falls back to in-memory store if Redis is unavailable.
 */
import logger from '../utils/logger'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import type { Request, Response, NextFunction } from 'express'

let RedisStore: any = null
try {
  const rlr = require('rate-limit-redis')
  RedisStore = rlr.default || rlr.RedisStore || rlr
} catch {
  // Fall back to built-in memory store
}

// ─── Shared Redis client (created once, reused by all limiters) ─────

let sharedRedisClient: any = null
let redisStoreBacking = 'local-fallback'

try {
  const redis = require('redis')
  sharedRedisClient = redis.createClient({
    url: env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries: number) => {
        // Exponential backoff capped at 3000ms
        const delay = Math.min(retries * 100, 3000)
        logger.info({ event: 'redis.reconnect_strategy', retries, delay }, `Redis reconnect attempt ${retries}; waiting ${delay}ms`)
        return delay
      }
    }
  })

  sharedRedisClient.on('connect', () => {
    logger.info({ event: 'redis.connecting' }, 'Redis client connecting...')
  })

  sharedRedisClient.on('ready', () => {
    redisStoreBacking = 'redis'
    logger.info({ event: 'redis.ready', storeBacking: redisStoreBacking }, 'Redis client ready. Rate limiting using Redis store.')
  })

  sharedRedisClient.on('error', (err: any) => {
    logger.error({ event: 'redis.error', err: (err as Error).message }, `Redis client error: ${(err as Error).message}`)
  })

  sharedRedisClient.on('end', () => {
    redisStoreBacking = 'local-fallback'
    logger.warn({ event: 'redis.end', storeBacking: redisStoreBacking }, 'Redis connection closed. Rate limiting falling back to local memory.')
  })

  sharedRedisClient.on('reconnecting', () => {
    logger.info({ event: 'redis.reconnecting' }, 'Redis client reconnecting...')
  })

  sharedRedisClient.connect().catch((err: any) => {
    logger.warn({ event: 'redis.initial_connection_failed', err: (err as Error).message }, 'Redis initial connection failed; rate limiting using local memory.')
  })
} catch (err: any) {
  sharedRedisClient = null
  logger.warn({ event: 'redis.initialization_failed', err: (err as Error).message }, 'Redis client initialization failed; rate limiting using local memory.')
}

// ─── Fallback In-Memory Store ──────────────────────────────

class MemoryStoreFallback {
  private hits = new Map<string, { count: number; expiresAt: number }>()
  private windowMs: number

  constructor(windowMs: number) {
    this.windowMs = windowMs
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const now = Date.now()
    const record = this.hits.get(key)

    if (!record || now > record.expiresAt) {
      const expiresAt = now + this.windowMs
      this.hits.set(key, { count: 1, expiresAt })
      return { totalHits: 1, resetTime: new Date(expiresAt) }
    }

    record.count += 1
    return { totalHits: record.count, resetTime: new Date(record.expiresAt) }
  }

  async decrement(key: string): Promise<void> {
    const record = this.hits.get(key)
    if (record) {
      record.count = Math.max(0, record.count - 1)
    }
  }

  async resetKey(key: string): Promise<void> {
    this.hits.delete(key)
  }
}

// ─── Hybrid Store (Dynamic Failover/Failback) ──────────────

class HybridStore {
  private redisStore: any
  private memoryStore: MemoryStoreFallback

  constructor(options: { prefix?: string; windowMs: number }) {
    if (RedisStore) {
      this.redisStore = new RedisStore({
        sendCommand: async (...args: any[]) => {
          if (sharedRedisClient && sharedRedisClient.isOpen && redisStoreBacking === 'redis') {
            return sharedRedisClient.sendCommand(args[0])
          }
          throw new Error('Redis client disconnected or offline')
        },
        ...(options.prefix ? { prefix: options.prefix } : {}),
      })
    }
    this.memoryStore = new MemoryStoreFallback(options.windowMs)
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    if (RedisStore && sharedRedisClient && sharedRedisClient.isOpen && redisStoreBacking === 'redis') {
      try {
        return await this.redisStore.increment(key)
      } catch (err: any) {
        logger.error(
          { event: 'redis.rate_limit_fallback_active', key, err: (err as Error).message },
          'Redis rate limit store increment failed — falling back to local memory store'
        )
      }
    }
    return this.memoryStore.increment(key)
  }

  async decrement(key: string): Promise<void> {
    if (RedisStore && sharedRedisClient && sharedRedisClient.isOpen && redisStoreBacking === 'redis') {
      try {
        return await this.redisStore.decrement(key)
      } catch (err: any) {
        logger.error(
          { event: 'redis.rate_limit_fallback_active_decrement', key, err: (err as Error).message },
          'Redis rate limit store decrement failed — falling back to local memory store'
        )
      }
    }
    return this.memoryStore.decrement(key)
  }

  async resetKey(key: string): Promise<void> {
    if (RedisStore && sharedRedisClient && sharedRedisClient.isOpen && redisStoreBacking === 'redis') {
      try {
        return await this.redisStore.resetKey(key)
      } catch (err: any) {
        logger.error(
          { event: 'redis.rate_limit_fallback_active_reset', key, err: (err as Error).message },
          'Redis rate limit store resetKey failed — falling back to local memory store'
        )
      }
    }
    return this.memoryStore.resetKey(key)
  }
}

interface LimiterOptions {
  windowMs: number
  max: number
  message?: string
  prefix?: string
  keyGenerator?: (req: Request) => string
}

// ─── Factory: creates a rate limiter with optional Redis backing ─────

function createLimiter(options: LimiterOptions) {
  const windowMs = options.windowMs || 60 * 1000
  const store = new HybridStore({
    prefix: options.prefix,
    windowMs
  })

  return rateLimit({
    windowMs,
    max: options.max || 100,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { ip: false },
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: options.message || 'Too many requests, please try again later',
      },
    },
    store,
    ...(options.keyGenerator ? { keyGenerator: options.keyGenerator } : {}),
  })
}

// ─── Pre-configured limiters ────────────────────────────────

// Login / signup: 5 requests per 15 minutes per IP
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again after 15 minutes',
  prefix: 'rl:auth:',
})

// Password reset: 3 requests per hour per IP+email
export const passwordResetLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many password reset requests, please try again after an hour',
  prefix: 'rl:reset:',
  keyGenerator: (req) => `${(ipKeyGenerator as any)(req, {} as unknown)}:${req.body?.email || 'unknown'}`,
})

// Prediction submission: 30 per minute per user (POST only)
export const predictionLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many prediction submissions, please slow down',
  prefix: 'rl:pred:',
  keyGenerator: (req) => (req as any).userId || (ipKeyGenerator as any)(req, {} as unknown),
})

// Global API default: 100 per minute per IP
export const globalLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests, please slow down',
  prefix: 'rl:global:',
})

// AI prediction: 10 requests per hour per user (paid external API — Anthropic)
export const aiPredictionLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many AI prediction requests, please try again after an hour',
  prefix: 'rl:ai:',
  keyGenerator: (req) => (req as any).userId || (ipKeyGenerator as any)(req, {} as unknown),
})

// ─── Phase 5: Hardened Limiters ───────────────────────────────

// Auction host actions (start, force-sold, next-player, etc.): 30 per minute per user
export const auctionActionLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many auction actions, please slow down',
  prefix: 'rl:auction:',
  keyGenerator: (req) => (req as any).userId || (ipKeyGenerator as any)(req, {} as unknown),
})

// Create Room (Host logic inside the route checks the absolute 3-room limit)
// But we still apply a general anti-spam IP limit just in case.
export const createRoomLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 20, // max 20 attempts per IP
  message: 'Too many rooms created recently, please try again later.',
  prefix: 'rl:createroom:',
  keyGenerator: (req) => (req as any).userId || (ipKeyGenerator as any)(req, {} as unknown),
})

// Room join: 10 per minute per user
export const joinRoomLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many room join attempts, please slow down',
  prefix: 'rl:join-room:',
  keyGenerator: (req) => (req as any).userId || (ipKeyGenerator as any)(req, {} as unknown),
})

// Static assets / public endpoints: higher limit (200/min/IP) so crawlers & real users aren't blocked
export const publicLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: 'Too many requests, please slow down',
  prefix: 'rl:public:',
})

// Draft Mode: start draft limited to 5 per minute per user (prevents ticket-exploit scripting §1.11)
export const draftLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many draft attempts, please slow down',
  prefix: 'rl:draft:',
  keyGenerator: (req) => (req as any).userId || (ipKeyGenerator as any)(req, {} as unknown),
})

export const isRedisConnected = () => sharedRedisClient !== null && sharedRedisClient.isOpen
