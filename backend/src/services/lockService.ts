import { redis } from '../lib/redis'
import { Mutex } from 'async-mutex'
import logger from '../utils/logger'

const localMutexes = new Map<string, Mutex>()

function getLocalMutex(key: string): Mutex {
  let mutex = localMutexes.get(key)
  if (!mutex) {
    mutex = new Mutex()
    localMutexes.set(key, mutex)
  }
  return mutex
}

export interface Lock {
  key: string
  token: string
  release: () => Promise<void>
}

/**
 * Acquire a distributed lock.
 * Caches local fallback mutexes if Redis is disconnected.
 */
export async function acquireLock(
  key: string,
  ttlMs = 5000,
  retries = 3,
  retryDelayMs = 200
): Promise<Lock> {
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36)

  // Verify Redis is connected. If not, use local-fallback mutex
  const isRedisConnected = redis.status === 'ready' || redis.status === 'connect'

  if (!isRedisConnected) {
    logger.warn({ event: 'lock.redis_offline', key }, 'Redis is offline. Falling back to local node-level mutex.')
    const localMutex = getLocalMutex(key)
    const releaseMutex = await localMutex.acquire()
    return {
      key,
      token,
      release: async () => {
        releaseMutex()
      }
    }
  }

  // Attempt lock acquisition with retries
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
  // @ts-ignore
      const result = await redis.set(key, token, 'NX', 'PX', ttlMs)
      if (result === 'OK') {
        return {
          key,
          token,
          release: async () => {
            const releaseScript = `
              if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
              else
                return 0
              end
            `
            await redis.eval(releaseScript, 1, key, token).catch((err: any) => {
              logger.error({ event: 'lock.release_failed', key, err: (err as Error).message }, 'Failed to release lock')
            })
          }
        }
      }
    } catch (err: any) {
      logger.error({ event: 'lock.acquire_error', key, err: (err as Error).message }, 'Error attempting to acquire lock in Redis')
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
    }
  }

  throw new Error(`LOCK_ACQUISITION_FAILED: Could not acquire lock for key "${key}" after ${retries + 1} attempts.`)
}
