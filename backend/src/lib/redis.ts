import { env } from '../config/env'
import { Redis } from 'ioredis'
import logger from '../utils/logger'

if (!env.REDIS_URL) {
  if (process.env.NODE_ENV === 'test') {
    logger.warn({ event: 'redis.missing_url' }, 'REDIS_URL is missing in test mode. Redis commands will be bypassed.')
  } else {
    logger.fatal({ event: 'redis.missing_url' }, 'REDIS_URL is strictly required')
    process.exit(1)
  }
}

export const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
    })
  : ({
      status: 'disconnected',
      on: () => {},
      set: async () => null,
      get: async () => null,
      eval: async () => 0,
      expire: async () => true,
      rpush: async () => 1,
      lpop: async () => null,
      llen: async () => 0,
      lrange: async () => [],
      del: async () => 1,
    } as unknown as Redis)

redis.on('error', (err: any) => {
  logger.error({ event: 'redis.error', err: (err as Error).message }, 'Redis connection error')
})

redis.on('connect', () => {
  logger.info({ event: 'redis.connected' }, 'Connected to Redis')
})
