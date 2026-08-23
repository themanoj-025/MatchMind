/**
 * Auth Middleware Tests — MatchMind
 *
 * Tests authenticateToken and optionalAuth middleware:
 * - Valid JWT → sets userId, calls next()
 * - Missing token → 401
 * - Invalid/expired token → 403
 * - optionalAuth: missing/invalid token → calls next() without error
 * - optionalAuth: valid token → sets userId
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'

// Set env vars BEFORE any imports that read them
process.env.JWT_SECRET = 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only'

// Mock the env module — must use string literal, not variable (vi.mock is hoisted)
vi.mock('../config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_RESET_SECRET: 'test-reset-secret',
  },
}))

// Mock logger
vi.mock('../utils/logger', () => ({
  default: {
    fatal: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

import { authenticateToken, optionalAuth } from './auth'

const TEST_JWT_SECRET = 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only'

function createReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    cookies: {},
    container: {
      cradle: {
        prisma: {
          user: {
            findUnique: vi.fn().mockResolvedValue({ tokenVersion: 0 }),
          },
        },
      },
    },
    userId: undefined,
    ...overrides,
  } as unknown as Request
}

function createRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

function createNext(): NextFunction {
  return vi.fn() as unknown as NextFunction
}

function makeToken(payload: Record<string, unknown>, secret = TEST_JWT_SECRET): string {
  return jwt.sign(payload, secret, { expiresIn: '1h' })
}

describe('authenticateToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets userId and calls next() for valid Bearer token', async () => {
    const token = makeToken({ userId: 'user-1', tokenVersion: 0 })
    const req = createReq({ headers: { authorization: `Bearer ${token}` } })
    const res = createRes()
    const next = createNext()

    await authenticateToken(req, res, next)

    expect(req.userId).toBe('user-1')
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('sets userId from accessToken cookie when no Authorization header', async () => {
    const token = makeToken({ userId: 'user-2', tokenVersion: 0 })
    const req = createReq({ cookies: { accessToken: token } })
    const res = createRes()
    const next = createNext()

    await authenticateToken(req, res, next)

    expect(req.userId).toBe('user-2')
    expect(next).toHaveBeenCalled()
  })

  it('returns 401 when no token is provided', async () => {
    const req = createReq()
    const res = createRes()
    const next = createNext()

    await authenticateToken(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 for invalid token', async () => {
    const req = createReq({ headers: { authorization: 'Bearer invalid-token' } })
    const res = createRes()
    const next = createNext()

    await authenticateToken(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 TOKEN_REVOKED when tokenVersion mismatches', async () => {
    const token = makeToken({ userId: 'user-1', tokenVersion: 5 })
    const req = createReq({ headers: { authorization: `Bearer ${token}` } })
    const res = createRes()
    const next = createNext()

    // Mock prisma to return different tokenVersion
    req.container.cradle.prisma.user.findUnique = vi.fn().mockResolvedValue({ tokenVersion: 0 })

    await authenticateToken(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked. Please log in again.' },
    })
    expect(next).not.toHaveBeenCalled()
  })
})

describe('optionalAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls next() without setting userId when no token', async () => {
    const req = createReq()
    const res = createRes()
    const next = createNext()

    await optionalAuth(req, res, next)

    expect(req.userId).toBeUndefined()
    expect(next).toHaveBeenCalled()
  })

  it('sets userId for valid token', async () => {
    const token = makeToken({ userId: 'user-1', tokenVersion: 0 })
    const req = createReq({ headers: { authorization: `Bearer ${token}` } })
    const res = createRes()
    const next = createNext()

    await optionalAuth(req, res, next)

    expect(req.userId).toBe('user-1')
    expect(next).toHaveBeenCalled()
  })

  it('calls next() without error for invalid token', async () => {
    const req = createReq({ headers: { authorization: 'Bearer garbage' } })
    const res = createRes()
    const next = createNext()

    await optionalAuth(req, res, next)

    expect(req.userId).toBeUndefined()
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })
})
