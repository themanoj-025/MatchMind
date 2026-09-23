/**
 * Tests for lib/socketAdapter.ts
 *
 * attachRedisAdapter must:
 *  - attach the Redis adapter when a real Redis client with duplicate() exists
 *    (verified against a live Redis — CI provides one at REDIS_URL)
 *  - gracefully skip (memory adapter) when REDIS_URL is unset or the client
 *    is the test stub without duplicate()
 *
 * Awaiting attachRedisAdapter before opening client connections guarantees
 * the pub/sub subscription is live before the first cross-node broadcast,
 * avoiding the "first event lost" race.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { Server } from 'socket.io'
import http from 'http'
import { io as Client, type Socket as ClientSocket } from 'socket.io-client'
import { attachRedisAdapter } from './socketAdapter'
import { redis } from './redis'

const clients: ClientSocket[] = []
const servers: http.Server[] = []

// Fast reachability probe: REDIS_URL may be set but unreachable (e.g. a
// docker-compose hostname with no local docker). Fail fast instead of
// hanging on adapter subscription retries.
const redisReachable = await Promise.race([
  redis
    .ping()
    .then(() => true)
    .catch(() => false),
  new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500)),
])

afterAll(() => {
  for (const c of clients) {
    c.disconnect()
  }
  for (const s of servers) {
    s.close()
  }
  redis.disconnect()
})

async function listen(io: Server): Promise<string> {
  const httpServer = http.createServer()
  io.attach(httpServer)
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  servers.push(httpServer)
  const addr = httpServer.address()
  return `http://127.0.0.1:${(addr as { port: number }).port}`
}

function connect(url: string, room: string): Promise<ClientSocket> {
  const client = Client(url, { transports: ['websocket'] })
  clients.push(client)
  return new Promise((resolve, reject) => {
    client.on('connect', () => {
      client.emit('join', room)
      resolve(client)
    })
    client.on('connect_error', reject)
  })
}

describe('attachRedisAdapter', () => {
  it('skips gracefully when the redis client is the test stub (no duplicate)', async () => {
    const io = new Server(http.createServer(), { cors: { origin: '*' } })
    const stub = { status: 'disconnected' } as unknown as typeof redis

    const result = await attachRedisAdapter(io, stub)

    expect(result.enabled).toBe(false)
    expect(result.reason).toContain('unavailable')
    io.close()
  })

  it.runIf(process.env.REDIS_URL && redisReachable)('attaches the adapter against live Redis', async () => {
    const io = new Server(http.createServer(), { cors: { origin: '*' } })
    const url = await listen(io)

    const result = await attachRedisAdapter(io)
    expect(result.enabled).toBe(true)

    // Cross-node proof: a broadcast made on a SECOND server (its own adapter
    // instance, same Redis) must reach a client joined on the FIRST server.
    const io2 = new Server(http.createServer(), { cors: { origin: '*' } })
    const url2 = await listen(io2)
    await attachRedisAdapter(io2, redis)

    io.on('connection', (s) => {
      s.on('join', (room: string) => s.join(room))
    })
    io2.on('connection', (s) => {
      s.on('join', (room: string) => s.join(room))
      s.on('ping-room', (room: string) => io2.to(room).emit('room-echo', room))
    })

    const clientA = await connect(url, 'test-room')
    const received = new Promise<string>((resolve) => clientA.on('room-echo', (room: string) => resolve(room)))

    const clientB = await connect(url2, 'test-room')
    clientB.emit('ping-room', 'test-room')

    expect(await received).toBe('test-room')
    io2.close()
  })
})
