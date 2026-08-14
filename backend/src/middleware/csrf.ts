import { env } from '../config/env'
/**
 * CSRF Protection — Double-Submit Cookie Pattern
 *
 * Generates a cryptographically random CSRF token, sets it as a non-httpOnly
 * cookie, and validates that the X-CSRF-Token header matches on mutating requests.
 *
 * Skip logic:
 * - GET / HEAD / OPTIONS are never checked (read-only)
 * - Requests with `Authorization: Bearer <token>` are skipped (API clients
 *   don't need CSRF because browsers don't auto-attach auth headers)
 * - Requests without a csrf-token cookie are rejected with 403
 *
 * Usage:
 *   app.use(csrfProtection)           // globally, before routes
 *   app.get('/api/auth/csrf-token', generateCsrfToken, ...)  // token endpoint
 */

import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'

const COOKIE_NAME = 'csrf-token'
const HEADER_NAME = 'x-csrf-token'
const TOKEN_BYTES = 32

/**
 * Generate a random hex string for use as a CSRF token.
 */
function createToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex')
}

/**
 * Set the CSRF token cookie on the response.
 * Non-httpOnly so client-side JS can read it and set it as a header.
 */
function setCsrfCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: false,   // must be readable by JS
    sameSite: 'strict',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  })
}

/**
 * Middleware: generates a fresh CSRF token and sets it as a cookie.
 * Use on the endpoint where the client fetches its initial CSRF token.
 */
export function generateCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Only set if not already present, or force-refresh
  if (!req.cookies?.[COOKIE_NAME]) {
    const token = createToken()
    setCsrfCookie(res, token)
    res.locals.csrfToken = token
  } else {
    res.locals.csrfToken = req.cookies[COOKIE_NAME]
  }
  next()
}

/**
 * Middleware endpoint handler: returns the current CSRF token.
 * Mount at GET /api/auth/csrf-token.
 */
export function csrfTokenHandler(req: Request, res: Response): void {
  let token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    token = createToken()
    setCsrfCookie(res, token)
  }
  res.json({ csrfToken: token })
}

/**
 * Middleware: validates CSRF token on mutating requests.
 *
 * Skips validation when:
 * 1. The request uses GET / HEAD / OPTIONS
 * 2. The request carries an `Authorization: Bearer` header (API client)
 *
 * On failure returns 403 with CSRF_INVALID error code.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // ─── Skip read-only methods ─────────────────────────────
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
    return next()
  }

  // ─── Skip server-to-server webhooks (Stripe) ────────────
  if (req.path === '/api/stripe/webhook') {
    return next()
  }

  // ─── Skip API clients using Bearer token ────────────────
  const authHeader = req.headers['authorization']
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next()
  }

  // ─── Validate double-submit cookie ──────────────────────
  const cookieToken = req.cookies?.[COOKIE_NAME]
  const headerToken = req.headers[HEADER_NAME] as string | undefined

  if (!cookieToken) {
    res.status(403).json({
      error: { code: 'CSRF_TOKEN_MISSING', message: 'CSRF token cookie is missing' },
    })
    return
  }

  if (!headerToken) {
    res.status(403).json({
      error: { code: 'CSRF_HEADER_MISSING', message: 'X-CSRF-Token header is missing' },
    })
    return
  }

  // Constant-time comparison to prevent timing attacks
  if (cookieToken.length !== headerToken.length ||
      !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    res.status(403).json({
      error: { code: 'CSRF_TOKEN_MISMATCH', message: 'CSRF token mismatch' },
    })
    return
  }

  next()
}
