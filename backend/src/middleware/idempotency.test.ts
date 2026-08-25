import { describe, it, expect, vi, beforeEach } from 'vitest'
import { idempotent } from './idempotency'

function mockReqRes(method = 'POST', path = '/api/test', headers: Record<string, string> = {}) {
  const req = {
    method,
    path,
    headers: {
      'idempotency-key': undefined,
      ...headers,
    },
  } as any
  const res = {
    statusCode: 200,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    getHeader: vi.fn().mockReturnValue('application/json'),
    setHeader: vi.fn(),
  } as any
  const next = vi.fn()
  return { req, res, next }
}

describe('idempotent middleware', () => {
  const middleware = idempotent()

  beforeEach(() => {
    vi.clearAllMocks()
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
})
