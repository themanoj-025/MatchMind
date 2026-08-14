import { Redis } from 'ioredis'
import logger from '../utils/logger'

export class CacheService {
  private readonly redis: Redis

  constructor(opts: { redis: Redis }) {
    this.redis = opts.redis
  }

  private isConnected(): boolean {
    return this.redis.status === 'ready' || this.redis.status === 'connect'
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected()) return null

    try {
      const data = await this.redis.get(key)
      if (data) {
        logger.debug(`Cache hit: ${key}`)
        return JSON.parse(data) as T
      }
      return null
    } catch (err: any) {
      logger.error({ event: 'cache.get_error', key, err: (err as Error).message }, 'Failed to read from cache')
      return null
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.isConnected() || value === undefined || value === null) return

    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch (err: any) {
      logger.error({ event: 'cache.set_error', key, err: (err as Error).message }, 'Failed to set cache')
    }
  }

  async getOrFetch<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    logger.debug(`Cache miss: ${key}`)
    const data = await fetcher()
    
    await this.set(key, data, ttlSeconds)
    return data
  }

  async invalidateByPattern(pattern: string): Promise<void> {
    if (!this.isConnected()) return

    try {
      let cursor = '0'
      const keysToDelete: string[] = []
      
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        cursor = nextCursor
        keysToDelete.push(...keys)
      } while (cursor !== '0')

      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete)
        logger.info({ event: 'cache.invalidated', pattern, count: keysToDelete.length }, 'Invalidated cache keys')
      }
    } catch (err: any) {
      logger.error({ event: 'cache.invalidate_error', pattern, err: (err as Error).message }, 'Failed to invalidate cache by pattern')
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.isConnected()) return

    try {
      await this.redis.del(key)
    } catch (err: any) {
      logger.error({ event: 'cache.delete_error', key, err: (err as Error).message }, 'Failed to delete cache key')
    }
  }
}
