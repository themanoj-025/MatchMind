import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { publicLimiter } from '../middleware/rateLimiter'

export const healthRouter = Router()

interface HealthChecks {
  status: 'healthy' | 'degraded'
  timestamp: string
  checks: {
    database: { status: 'ok' | 'degraded'; type: string; error?: string }
    redis: { status: 'ok' | 'degraded'; error?: string }
  }
}

healthRouter.get('/', publicLimiter, async (req, res) => {
  const checks: HealthChecks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'ok', type: 'postgres' },
      redis: { status: 'ok' },
    },
  }

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    checks.checks.database.status = 'degraded'
    checks.checks.database.error = 'database connection failed'
    checks.status = 'degraded'
  }

  // Check Redis connectivity
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      await redis.ping()
    } else {
      throw new Error('Redis not ready')
    }
  } catch {
    checks.checks.redis.status = 'degraded'
    checks.checks.redis.error = 'redis connection failed'
    checks.status = 'degraded'
  }

  // Return 503 if degraded
  if (checks.status === 'degraded') {
    res.status(503).json(checks)
  } else {
    res.json(checks)
  }
})
