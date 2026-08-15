import { env } from '../config/env'
/**
 * Centralized error handling middleware.
 *
 * Maps known error types to consistent HTTP responses.
 * Logs errors server-side and never leaks stack traces to clients.
 *
 * Usage: add as the last middleware in Express:
 *   app.use(errorHandler)
 */
import type { Request, Response, NextFunction } from 'express'
import logger from '../utils/logger'
import type { AuthenticatedRequest } from './auth'

/**
 * Centralized Express error handler.
 * Must have 4 params so Express recognizes it as an error handler.
 */

interface HttpErrorLike {
  code?: string
  name?: string
  isAppError?: boolean
  statusCode?: number
  stack?: string
  message?: string
}

export function errorHandler(err: unknown, req: AuthenticatedRequest, res: Response, _next: NextFunction): void {
  const httpErr = (typeof err === 'object' && err !== null ? err : {}) as HttpErrorLike
  // Structured error logging with request context
  logger.error(
    {
      event: 'error.unhandled',
      err: { message: httpErr.message, stack: env.NODE_ENV === 'development' ? httpErr.stack : undefined },
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      userId: req.userId,
    },
    httpErr.message || 'Unknown error',
  )

  // ─── JSON DB errors (unique constraint, not found) ───────────────────
  if (httpErr.code === 'CONFLICT') {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: httpErr.message || 'A record with that value already exists',
      },
    })
    return
  }
  if (httpErr.code === 'NOT_FOUND') {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: httpErr.message || 'The requested record was not found',
      },
    })
    return
  }

  // ─── JWT errors ────────────────────────────────────────────────────
  if (httpErr.name === 'JsonWebTokenError' || httpErr.name === 'TokenExpiredError') {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Authentication token is invalid or expired',
      },
    })
    return
  }

  // ─── Custom AppError ───────────────────────────────────────────────
  if (httpErr.isAppError) {
    res.status(httpErr.statusCode || 400).json({
      error: {
        code: httpErr.code || 'APP_ERROR',
        message: httpErr.message,
      },
    })
    return
  }

  // ─── Fallback: 500 Internal Server Error ──────────────────────────
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  })
}
