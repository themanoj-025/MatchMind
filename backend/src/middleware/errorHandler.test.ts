import { describe, it, expect, vi } from 'vitest'
import { type Request, type Response, type NextFunction } from 'express'
import { errorHandler } from './errorHandler'

function mockReqRes(overrides: Record<string, unknown> = {}) {
  const req = {
    id: 'test-request-id',
    method: 'GET',
    url: '/api/test',
    originalUrl: '/api/test',
    userId: undefined,
    ...overrides,
  } as unknown as Request
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  const next = vi.fn() as unknown as NextFunction
  return { req, res, next }
}

describe('errorHandler', () => {
  it('handles AppError-like objects with isAppError flag', () => {
    const err = { isAppError: true, code: 'NOT_FOUND', statusCode: 404, message: 'Not found' }
    const { req, res, next } = mockReqRes()
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'Not found' },
    })
  })

  it('handles CONFLICT error code', () => {
    const err = { code: 'CONFLICT', message: 'Duplicate entry' }
    const { req, res, next } = mockReqRes()
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'CONFLICT', message: 'Duplicate entry' },
    })
  })

  it('handles NOT_FOUND error code', () => {
    const err = { code: 'NOT_FOUND' }
    const { req, res, next } = mockReqRes()
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'NOT_FOUND' }),
      }),
    )
  })

  it('handles JWT errors', () => {
    const err = { name: 'JsonWebTokenError', message: 'invalid signature' }
    const { req, res, next } = mockReqRes()
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INVALID_TOKEN', message: 'Authentication token is invalid or expired' },
    })
  })

  it('handles TokenExpiredError', () => {
    const err = { name: 'TokenExpiredError', message: 'jwt expired' }
    const { req, res, next } = mockReqRes()
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('falls back to 500 for unknown errors', () => {
    const err = new Error('Something broke')
    const { req, res, next } = mockReqRes()
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    })
  })

  it('handles null/undefined errors gracefully', () => {
    const { req, res, next } = mockReqRes()
    errorHandler(null, req, res, next)
    expect(res.status).toHaveBeenCalled()
  })
})
