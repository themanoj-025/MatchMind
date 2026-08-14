/**
 * Request-ID Middleware — Distributed Tracing
 *
 * Generates a unique request ID for every HTTP request, sets it on the
 * response as X-Request-Id, and attaches it to req.id for downstream
 * use in log lines and Sentry events.
 *
 * Usage:
 *   app.use(requestId)
 *
 * This MUST be the first middleware (before helmet, cors, pino-http) so
 * the request ID is available for every downstream log line.
 */
import type { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

export function requestId(req: Request, res: Response, next: NextFunction): void {
  // Honor an incoming request ID (from a load balancer / proxy) or generate fresh
  const id = (req.headers['x-request-id'] as string) || crypto.randomUUID()
  req.id = id
  res.setHeader('X-Request-Id', id)
  next()
}

// Extend Express Request to include id
declare global {
  namespace Express {
    interface Request {
      id: string
    }
  }
}
