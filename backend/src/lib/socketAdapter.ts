import type { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import type { Redis } from 'ioredis'
import { env } from '../config/env'
import { redis } from './redis'
import logger from '../utils/logger'

/**
 * WebSocket horizontal scaling — Redis adapter for Socket.IO.
 *
 * Attaches the @socket.io/redis-adapter so rooms/broadcasts span every node
 * behind the load balancer (k8s HPA scales backend replicas; without this each
 * pod only knows its own sockets). Requires REDIS_URL to point at a SHARED
 * Redis instance across all replicas — which is already the case: the same
 * Redis backs BullMQ queues, rate limiting, and the idempotency store.
 *
 * Graceful degradation: when REDIS_URL is absent (unit-test stub) or the
 * client cannot be duplicated, we keep Socket.IO's default in-memory adapter
 * and log why — the server still runs single-node exactly as before.
 *
 * Ops note: the default memory adapter keeps affinity implicitly (one node);
 * with the Redis adapter, HTTP long-polling fallback across replicas requires
 * sticky sessions. The frontend pins `transports: ['websocket']`, which is
 * immune to this, but any polling-based client must be session-sticky.
 */

export interface AdapterAttachment {
  enabled: boolean
  reason?: string
}

export async function attachRedisAdapter(io: Server, client: Redis = redis): Promise<AdapterAttachment> {
  if (!env.REDIS_URL) {
    logger.warn({ event: 'socket.adapter.disabled' }, 'REDIS_URL not set — Socket.IO using single-node memory adapter')
    return { enabled: false, reason: 'REDIS_URL not set' }
  }

  // The test-mode stub in lib/redis.ts is a plain object without duplicate()
  if (typeof client.duplicate !== 'function') {
    logger.warn(
      { event: 'socket.adapter.disabled' },
      'Redis client unavailable — Socket.IO using single-node memory adapter',
    )
    return { enabled: false, reason: 'redis client unavailable' }
  }

  const pub = client.duplicate()
  const sub = client.duplicate()

  // createAdapter resolves once the pub/sub clients subscribe; failures here
  // are logged by the redis 'error' handler in lib/redis.ts (both duplicates
  // re-use the connection options, including its error logging).
  io.adapter(await createAdapter(pub, sub))

  logger.info(
    { event: 'socket.adapter.enabled' },
    'Socket.IO Redis adapter attached — rooms/broadcasts now span all nodes',
  )
  return { enabled: true }
}
