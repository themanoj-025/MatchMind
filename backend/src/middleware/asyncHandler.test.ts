import { describe, it, expect, vi } from 'vitest'
import asyncHandler from './asyncHandler'

describe('asyncHandler', () => {
  it('calls next() when the handler resolves', async () => {
    const handler = asyncHandler(async (_req: any, _res: any) => {
      return 'ok'
    })
    const req = {} as any
    const res = {} as any
    const next = vi.fn()
    await handler(req, res, next)
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next(err) when the handler rejects', async () => {
    const handler = asyncHandler(async () => {
      throw new Error('boom')
    })
    const req = {} as any
    const res = {} as any
    const next = vi.fn()
    await handler(req, res, next)
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }))
  })

  it('passes req and res to the handler', async () => {
    const spy = vi.fn()
    const handler = asyncHandler(async (req: any, res: any) => {
      spy(req, res)
    })
    const req = { id: 1 } as any
    const res = { id: 2 } as any
    const next = vi.fn()
    await handler(req, res, next)
    expect(spy).toHaveBeenCalledWith(req, res)
  })
})
