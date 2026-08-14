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
// eslint-disable-next-line no-unused-vars
export function errorHandler(err: any, req: AuthenticatedRequest, res: Response, _next: NextFunction): void {
  // Structured error logging with request context
  logger.error({
    event: 'error.unhandled',
    err: { message: (err as Error).message, stack: env.NODE_ENV === 'development' ? err.stack : undefined },
    requestId: (req as any).id,
    method: req.method,
    url: req.originalUrl || req.url,
    userId: req.userId,
  }, (err as Error).message)

  // ─── JSON DB errors (unique constraint, not found) ───────────────────
  if (err.code === 'CONFLICT') {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: (err as Error).message || 'A record with that value already exists',
      },
    })
    return
  }
  if (err.code === 'NOT_FOUND') {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: (err as Error).message || 'The requested record was not found',
      },
    })
    return
  }

  // ─── JWT errors ────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Authentication token is invalid or expired',
      },
    })
    return
  }

  // ─── Custom AppError ───────────────────────────────────────────────
  if (err.isAppError) {
    res.status(err.statusCode || 400).json({
      error: {
        code: err.code || 'APP_ERROR',
        message: (err as Error).message,
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
