import { env } from '../config/env'
/**
 * Token Service — Cookie and token helpers
 *
 * Re-exports generateTokens and provides setAuthCookies for setting
 * HTTP-only cookies with access + refresh tokens.
 *
 * This file is imported by auth routes as a bridge between the
 * AuthService layer and Express response objects.
 */
import type { Response } from 'express'
import { generateTokens, revokeTokens, getTokenVersion } from './authService'

export { generateTokens, revokeTokens, getTokenVersion }

/**
 * Set auth cookies (refresh + access) on the Express response.
 */
export function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }): void {
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.NODE_ENV === 'production',
    path: '/api/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  })
  res.cookie('accessToken', tokens.accessToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 minutes
  })
}

/**
 * Clear auth cookies.
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie('refreshToken', { path: '/api/auth' })
  res.clearCookie('accessToken', { path: '/' })
}
