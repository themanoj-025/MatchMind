import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { validate } from './validate'

function mockReqRes(source: 'body' | 'query' | 'params' = 'body', data: unknown = {}) {
  const req = { [source]: data } as any
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any
  const next = vi.fn()
  return { req, res, next }
}

describe('validate middleware', () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().positive() })

  it('calls next() with valid data', () => {
    const { req, res, next } = mockReqRes('body', { name: 'Alice', age: 25 })
    validate(schema)(req, res, next)
    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('replaces req[source] with parsed/coerced data', () => {
    const coerceSchema = z.object({ count: z.coerce.number() })
    const { req, res, next } = mockReqRes('query', { count: '42' })
    validate(coerceSchema, 'query')(req, res, next)
    expect(req.query.count).toBe(42)
    expect(next).toHaveBeenCalledOnce()
  })

  it('returns 400 with validation errors on invalid data', () => {
    const { req, res, next } = mockReqRes('body', { name: '', age: -1 })
    validate(schema)(req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          details: expect.arrayContaining([
            expect.objectContaining({ path: 'name' }),
          ]),
        }),
      }),
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('validates query params when source is "query"', () => {
    const querySchema = z.object({ q: z.string().min(2) })
    const { req, res, next } = mockReqRes('query', { q: 'a' })
    validate(querySchema, 'query')(req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('validates params when source is "params"', () => {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const { req, res, next } = mockReqRes('params', { id: 'not-a-uuid' })
    validate(paramsSchema, 'params')(req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
  })
})
