import { describe, it, expect, vi } from 'vitest'
import { type Request, type Response, type NextFunction } from 'express'
import { requestId } from './requestId'

function mockReqRes(incomingRequestId?: string) {
  const req = {
    headers: incomingRequestId ? { 'x-request-id': incomingRequestId } : {},
    id: undefined as string | undefined,
  } as unknown as Request
  const res = {
    setHeader: vi.fn(),
  } as unknown as Response
  const next = vi.fn() as unknown as NextFunction
  return { req, res, next }
}

describe('requestId middleware', () => {
  it('generates a random UUID when no X-Request-Id header is present', () => {
    const { req, res, next } = mockReqRes()
    requestId(req, res, next)
    expect(req.id).toBeDefined()
    expect(typeof req.id).toBe('string')
    expect(req.id!.length).toBeGreaterThan(0)
    expect(next).toHaveBeenCalledOnce()
  })

  it('honors an incoming X-Request-Id header', () => {
    const incomingId = 'my-trace-id-123'
    const { req, res, next } = mockReqRes(incomingId)
    requestId(req, res, next)
    expect(req.id).toBe(incomingId)
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', incomingId)
  })

  it('sets X-Request-Id on the response', () => {
    const { req, res, next } = mockReqRes()
    requestId(req, res, next)
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.id)
  })

  it('always calls next()', () => {
    const { req, res, next } = mockReqRes()
    requestId(req, res, next)
    expect(next).toHaveBeenCalledOnce()
  })
})
