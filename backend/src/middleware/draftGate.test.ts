import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDraftEnabledTournaments, isDraftEnabledForTournament, requireDraftEnabled } from './draftGate'

// Mock the env module
vi.mock('../config/env', () => ({
  env: {
    DRAFT_ENABLED_TOURNAMENTS: 'fifa-wc-2026,uefa-ucl-2026-27',
  },
}))

describe('getDraftEnabledTournaments', () => {
  it('returns comma-separated tournament IDs', () => {
    const result = getDraftEnabledTournaments()
    expect(result).toContain('fifa-wc-2026')
    expect(result).toContain('uefa-ucl-2026-27')
  })

  it('returns an array', () => {
    expect(Array.isArray(getDraftEnabledTournaments())).toBe(true)
  })
})

describe('isDraftEnabledForTournament', () => {
  it('returns true for enabled tournaments', () => {
    expect(isDraftEnabledForTournament('fifa-wc-2026')).toBe(true)
  })

  it('returns false for disabled tournaments', () => {
    expect(isDraftEnabledForTournament('unknown-tournament')).toBe(false)
  })
})

describe('requireDraftEnabled middleware', () => {
  function mockReqRes(body?: { tournamentId?: string }, params?: { tournamentId?: string }) {
    const req = { params: params || {}, body: body || {} } as unknown as import('express').Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as import('express').Response
    const next = vi.fn() as unknown as import('express').NextFunction
    return { req, res, next }
  }

  it('calls next() when tournament is enabled', () => {
    const { req, res, next } = mockReqRes({ tournamentId: 'fifa-wc-2026' })
    requireDraftEnabled(req, res, next)
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith() // no error
  })

  it('calls next(error) when tournament is not enabled', () => {
    const { req, res, next } = mockReqRes({ tournamentId: 'unknown-tournament' })
    requireDraftEnabled(req, res, next)
    expect(next).toHaveBeenCalledOnce()
    const err = next.mock.calls[0][0]
    expect(err.isAppError).toBe(true)
    expect(err.code).toBe('DRAFT_MODE_DISABLED')
    expect(err.statusCode).toBe(403)
  })

  it('calls next(error) when tournamentId is missing', () => {
    const { req, res, next } = mockReqRes({})
    requireDraftEnabled(req, res, next)
    expect(next).toHaveBeenCalledOnce()
    const err = next.mock.calls[0][0]
    expect(err.code).toBe('TOURNAMENT_ID_REQUIRED')
  })

  it('reads tournamentId from req.params as fallback', () => {
    const { req, res, next } = mockReqRes({}, { tournamentId: 'fifa-wc-2026' })
    requireDraftEnabled(req, res, next)
    expect(next).toHaveBeenCalledWith() // enabled, no error
  })
})
