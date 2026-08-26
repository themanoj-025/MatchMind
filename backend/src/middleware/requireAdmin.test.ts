/**
 * requireAdmin Middleware Tests — MatchMind
 *
 * Tests requireAdmin:
 * - allows ADMIN role through
 * - allows SUPERADMIN role through
 * - blocks USER role with 403
 * - blocks missing user with 403
 * - passes errors to next()
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireAdmin } from './requireAdmin'
import type { AuthenticatedRequest } from './auth'
import type { Response, NextFunction } from 'express'

function createMockReq(userId: string = 'user-1'): AuthenticatedRequest {
  return {
    userId,
    container: {
      cradle: {
        prisma: {
          user: {
            findUnique: vi.fn(),
          },
        },
      },
    },
  } as unknown as AuthenticatedRequest
}

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

function createMockNext(): NextFunction {
  return vi.fn()
}

describe('requireAdmin', () => {
  let req: AuthenticatedRequest
  let res: Response
  let next: NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
    req = createMockReq()
    res = createMockRes()
    next = createMockNext()
  })

  it('allows ADMIN role through', async () => {
    const prisma = req.container.cradle.prisma
    prisma.user.findUnique = vi.fn().mockResolvedValue({ role: 'ADMIN' })

    await requireAdmin(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('allows SUPERADMIN role through', async () => {
    const prisma = req.container.cradle.prisma
    prisma.user.findUnique = vi.fn().mockResolvedValue({ role: 'SUPERADMIN' })

    await requireAdmin(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('blocks USER role with 403', async () => {
    const prisma = req.container.cradle.prisma
    prisma.user.findUnique = vi.fn().mockResolvedValue({ role: 'USER' })

    await requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('blocks when user not found', async () => {
    const prisma = req.container.cradle.prisma
    prisma.user.findUnique = vi.fn().mockResolvedValue(null)

    await requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('passes errors to next()', async () => {
    const prisma = req.container.cradle.prisma
    const error = new Error('Database error')
    prisma.user.findUnique = vi.fn().mockRejectedValue(error)

    await requireAdmin(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })
})
