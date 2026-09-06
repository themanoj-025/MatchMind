import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type Request, type Response, type NextFunction } from 'express'
import { idempotent, resetIdempotencyState } from './idempotency'

function mockReqRes(method = 'POST', path = '/api/test', headers: Record<string, string> = {}) {
  const req = {
    method,
    path,
    headers: {
      'idempotency-key': undefined,
      ...headers,
    },
  } as unknown as Request
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  const res = {
    statusCode: 200,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    getHeader: vi.fn().mockReturnValue('application/json'),
    setHeader: vi.fn(),
    once: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      const list = listeners.get(event) ?? []
      list.push(cb)
      listeners.set(event, list)
      return res
    }),
    emit: vi.fn((event: string) => {
      for (const cb of listeners.get(event) ?? []) {
        cb()
      }
      return true
    }),
  } as unknown as Response
  const next = vi.fn() as unknown as NextFunction
  const emitFinish = () => {
    ;(res as unknown as { emit: (event: string) => boolean }).emit('finish')
  }
  return { req, res, next, emitFinish }
}

/** Let awaited microtasks (in-flight lock resolution) settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('idempotent middleware', () => {
  const middleware = idempotent()

  beforeEach(() => {
    vi.clearAllMocks()
    resetIdempotencyState()
  })

  it('skips non-mutating methods (GET)', () => {
    const { req, res, next } = mockReqRes('GET')
    middleware(req, res, next)
    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('skips when no idempotency key is provided', () => {
    const { req, res, next } = mockReqRes('POST')
    middleware(req, res, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('rejects invalid UUID format', () => {
    const { req, res, next } = mockReqRes('POST', '/api/test', {
      'idempotency-key': 'not-a-uuid',
    })
    middleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'INVALID_IDEMPOTENCY_KEY',
        }),
      }),
    )
  })

  it('accepts valid UUID v4 format', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const { req, res, next } = mockReqRes('POST', '/api/test', {
      'idempotency-key': uuid,
    })
    middleware(req, res, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('caches successful responses and returns them on repeat', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const { req, res, next } = mockReqRes('POST', '/api/test', {
      'idempotency-key': uuid,
    })

    // First call — should pass through
    middleware(req, res, next)
    expect(next).toHaveBeenCalledOnce()

    // Simulate a successful response
    res.json({ success: true })

    // Second call with same key — should return cached response
    const { req: req2, res: res2, next: next2 } = mockReqRes('POST', '/api/test', {
      'idempotency-key': uuid,
    })
    middleware(req2, res2, next2)
    expect(res2.status).toHaveBeenCalledWith(200)
    expect(res2.json).toHaveBeenCalledWith({ success: true })
  })

  it('skips for DELETE method without idempotency key', () => {
    const { req, res, next } = mockReqRes('DELETE')
    middleware(req, res, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('applies to PUT and PATCH methods with key', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    for (const method of ['PUT', 'PATCH']) {
      const { req, res, next } = mockReqRes(method, '/api/test', {
        'idempotency-key': uuid,
      })
      middleware(req, res, next)
      expect(next).toHaveBeenCalledOnce()
    }
  })

  it('dedupes concurrent requests with the same key (single execution)', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const { req: reqA, res: resA, next: nextA } = mockReqRes('POST', '/api/checkout', {
      'idempotency-key': uuid,
    })
    const { req: reqB, res: resB, next: nextB } = mockReqRes('POST', '/api/checkout', {
      'idempotency-key': uuid,
    })

    // Request A starts first and becomes the in-flight leader.
    middleware(reqA, resA, nextA)
    // Request B overlaps A with the same key — it must NOT execute.
    middleware(reqB, resB, nextB)
    await flush()
    expect(nextA).toHaveBeenCalledOnce()
    expect(nextB).not.toHaveBeenCalled()

    // A completes successfully.
    resA.json({ success: true, id: 'session_123' })
    await flush()

    // B replays A's response instead of executing the handler a second time.
    expect(nextB).not.toHaveBeenCalled()
    expect(resB.status).toHaveBeenCalledWith(200)
    expect(resB.json).toHaveBeenCalledWith({ success: true, id: 'session_123' })
  })

  it('lets a retry execute when the in-flight leader fails (non-2xx)', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const { req: reqA, res: resA, next: nextA, emitFinish } = mockReqRes('POST', '/api/checkout', {
      'idempotency-key': uuid,
    })
    const { req: reqB, res: resB, next: nextB } = mockReqRes('POST', '/api/checkout', {
      'idempotency-key': uuid,
    })

    middleware(reqA, resA, nextA)
    middleware(reqB, resB, nextB)
    await flush()

    // A fails with a 503 (never cached) and finishes.
    resA.statusCode = 503
    resA.json({ error: { code: 'SERVICE_UNAVAILABLE' } })
    emitFinish()
    await flush()

    // B falls through and executes its own fresh attempt.
    expect(nextB).toHaveBeenCalledOnce()
  })

  it('scopes the in-flight lock by path (same key, different endpoint)', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const { req: reqA, res: resA, next: nextA } = mockReqRes('POST', '/api/rooms', {
      'idempotency-key': uuid,
    })
    const { req: reqB, res: resB, next: nextB } = mockReqRes('POST', '/api/checkout', {
      'idempotency-key': uuid,
    })

    middleware(reqA, resA, nextA)
    middleware(reqB, resB, nextB)
    await flush()

    // Different paths are independent keys — both may execute.
    expect(nextA).toHaveBeenCalledOnce()
    expect(nextB).toHaveBeenCalledOnce()
  })
})
