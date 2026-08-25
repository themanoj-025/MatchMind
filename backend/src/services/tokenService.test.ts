import { describe, it, expect, vi } from 'vitest'
import { setAuthCookies, clearAuthCookies } from './tokenService'

// Mock env
vi.mock('../config/env', () => ({
  env: { NODE_ENV: 'test' },
}))

function mockRes() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as any
}

describe('setAuthCookies', () => {
  it('sets refreshToken cookie with correct options', () => {
    const res = mockRes()
    const tokens = { accessToken: 'access-123', refreshToken: 'refresh-456' }
    setAuthCookies(res, tokens)
    expect(res.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'refresh-456',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/api/auth',
      }),
    )
  })

  it('sets accessToken cookie with correct options', () => {
    const res = mockRes()
    const tokens = { accessToken: 'access-123', refreshToken: 'refresh-456' }
    setAuthCookies(res, tokens)
    expect(res.cookie).toHaveBeenCalledWith(
      'accessToken',
      'access-123',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      }),
    )
  })

  it('sets exactly 2 cookies', () => {
    const res = mockRes()
    setAuthCookies(res, { accessToken: 'a', refreshToken: 'r' })
    expect(res.cookie).toHaveBeenCalledTimes(2)
  })
})

describe('clearAuthCookies', () => {
  it('clears both cookies', () => {
    const res = mockRes()
    clearAuthCookies(res)
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/api/auth' })
    expect(res.clearCookie).toHaveBeenCalledWith('accessToken', { path: '/' })
  })
})
