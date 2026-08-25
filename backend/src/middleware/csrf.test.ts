import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateCsrfToken, csrfProtection, csrfTokenHandler } from './csrf'

// Mock env
vi.mock('../config/env', () => ({
  env: { NODE_ENV: 'test' },
}))

function mockReqRes(method = 'POST', cookies: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const req = {
    method,
    cookies,
    headers,
    path: '/api/test',
  } as any
  const res = {
    cookie: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    locals: {} as Record<string, unknown>,
  } as any
  const next = vi.fn()
  return { req, res, next }
}

describe('generateCsrfToken', () => {
  it('sets a csrf-token cookie when none exists', () => {
    const { req, res, next } = mockReqRes('GET', {})
    generateCsrfToken(req, res, next)
    expect(res.cookie).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledOnce()
    expect(res.locals.csrfToken).toBeDefined()
    expect(typeof res.locals.csrfToken).toBe('string')
  })

  it('reuses existing cookie token', () => {
    const { req, res, next } = mockReqRes('GET', { 'csrf-token': 'existing-token' })
    generateCsrfToken(req, res, next)
    expect(res.cookie).not.toHaveBeenCalled()
    expect(res.locals.csrfToken).toBe('existing-token')
  })
})

describe('csrfProtection', () => {
  it('skips GET requests', () => {
    const { req, res, next } = mockReqRes('GET')
    csrfProtection(req, res, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('skips HEAD requests', () => {
    const { req, res, next } = mockReqRes('HEAD')
    csrfProtection(req, res, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('skips OPTIONS requests', () => {
    const { req, res, next } = mockReqRes('OPTIONS')
    csrfProtection(req, res, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('skips Stripe webhook path', () => {
    const { req, res, next } = mockReqRes('POST', {}, {})
    req.path = '/api/stripe/webhook'
    csrfProtection(req, res, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('skips requests with Bearer token', () => {
    const { req, res, next } = mockReqRes('POST', {}, { authorization: 'Bearer token123' })
    csrfProtection(req, res, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('returns 403 when csrf-token cookie is missing', () => {
    const { req, res, next } = mockReqRes('POST', {}, { 'x-csrf-token': 'some-token' })
    csrfProtection(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CSRF_TOKEN_MISSING' }),
      }),
    )
  })

  it('returns 403 when x-csrf-token header is missing', () => {
    const { req, res, next } = mockReqRes('POST', { 'csrf-token': 'some-token' }, {})
    csrfProtection(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CSRF_HEADER_MISSING' }),
      }),
    )
  })

  it('returns 403 on token mismatch', () => {
    const { req, res, next } = mockReqRes(
      'POST',
      { 'csrf-token': 'token-A' },
      { 'x-csrf-token': 'token-B' },
    )
    csrfProtection(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CSRF_TOKEN_MISMATCH' }),
      }),
    )
  })

  it('passes when cookie and header match', () => {
    const token = '550e8400-e29b-41d4-a716-446655440000'
    const { req, res, next } = mockReqRes(
      'POST',
      { 'csrf-token': token },
      { 'x-csrf-token': token },
    )
    csrfProtection(req, res, next)
    expect(next).toHaveBeenCalledOnce()
  })
})

describe('csrfTokenHandler', () => {
  it('returns csrf token in JSON body', () => {
    const { req, res } = mockReqRes('GET', { 'csrf-token': 'my-token' })
    csrfTokenHandler(req, res)
    expect(res.json).toHaveBeenCalledWith({ csrfToken: 'my-token' })
  })

  it('generates a new token if cookie is missing', () => {
    const { req, res } = mockReqRes('GET', {})
    csrfTokenHandler(req, res)
    expect(res.cookie).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ csrfToken: expect.any(String) }),
    )
  })
})
