import { env } from '../config/env'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import logger from '../utils/logger'

export interface AuthenticatedRequest extends Request {
  userId?: string
  user?: any
}

/**
 * Verify the tokenVersion claim in a JWT matches the user's current
 * version stored in the database. If they differ, the token has been
 * revoked (user logged out on another device).
 */
async function checkTokenVersion(userId: string, tokenVersion: number, prisma: any): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    })
    if (!user) return false
    return (user.tokenVersion ?? 0) === tokenVersion
  } catch (err: any) {
    // Fail closed to prevent bypasses during database outages/transient errors
    logger.fatal(
      { event: 'auth.token_version_db_failure', userId, err: (err as Error).message },
      'Token version DB lookup failed. Denying access (fail closed) to prevent security bypass.'
    )
    return false
  }
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  // Check Authorization header first, then fall back to accessToken cookie
  const authHeader = req.headers['authorization']
  let token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    token = req.cookies?.accessToken
  }

  if (!token) {
    res.status(401).json({ message: 'Authentication required' })
    return
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET!) as { userId: string; tokenVersion?: number }
    req.userId = decoded.userId

    // Verify token hasn't been revoked (tokenVersion matches)
    const prisma = (req as any).container.resolve('prisma')
    if (prisma && decoded.tokenVersion !== undefined) {
      const isValid = await checkTokenVersion(decoded.userId, decoded.tokenVersion, prisma)
      if (!isValid) {
        res.status(401).json({
          error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked. Please log in again.' },
        })
        return
      }
    }

    next()
  } catch (err: any) {
    res.status(403).json({ message: 'Invalid or expired token' })
  }
}

export const optionalAuth = async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization']
  let token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    token = req.cookies?.accessToken
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET!) as { userId: string; tokenVersion?: number }
      const prisma = (req as any).container.resolve('prisma')
      if (prisma && decoded.tokenVersion !== undefined) {
        const isValid = await checkTokenVersion(decoded.userId, decoded.tokenVersion, prisma)
        if (isValid) {
          req.userId = decoded.userId
        }
      } else {
        req.userId = decoded.userId
      }
    } catch (err: any) {
      // Ignore invalid/expired tokens for optional auth
    }
  }
  next()
}
