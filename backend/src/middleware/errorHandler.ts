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

/** Map a known error shape to its HTTP response, or null for the generic 500 fallback. */
function errorResponse(httpErr: HttpErrorLike): { status: number; code: string; message: string | undefined } | null {
  // JSON DB errors (unique constraint, not found)
  if (httpErr.code === 'CONFLICT') {
    return { status: 409, code: 'CONFLICT', message: httpErr.message || 'A record with that value already exists' }
  }
  if (httpErr.code === 'NOT_FOUND') {
    return { status: 404, code: 'NOT_FOUND', message: httpErr.message || 'The requested record was not found' }
  }

  // JWT errors
  if (httpErr.name === 'JsonWebTokenError' || httpErr.name === 'TokenExpiredError') {
    return { status: 401, code: 'INVALID_TOKEN', message: 'Authentication token is invalid or expired' }
  }

  // Custom AppError
  if (httpErr.isAppError) {
    return { status: httpErr.statusCode || 400, code: httpErr.code || 'APP_ERROR', message: httpErr.message }
  }

  return null
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

  // ─── Fallback: 500 Internal Server Error ──────────────────────────
  const mapped = errorResponse(httpErr)
  const { status, code, message } = mapped ?? {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  }
  res.status(status).json({ error: { code, message } })
}
