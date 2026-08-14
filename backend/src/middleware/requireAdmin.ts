/**
 * Middleware: require ADMIN or SUPERADMIN role.
 * Extracted from matches.js and admin.js into a single shared module.
 */
import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from './auth'

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const prisma = (req as any).container.resolve('prisma')
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    })
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      })
      return
    }
    next()
  } catch (err: any) {
    next(err)
  }
}
