/**
 * Admin Service — MatchMind
 *
 * Extracts admin panel business logic from routes/admin.js.
 * Route handlers become thin HTTP adapters that call this service.
 */

import type { IUserRepository } from '../repositories/types'
import logger from '../utils/logger'

// ─── Dashboard Stats ─────────────────────────────────

export interface DashboardStats {
  totalUsers: number
  activeUsers: number
  activeRooms: number
  liveAuctions: number
  proUsers: number
  pendingReports: number
  signupTrend: Array<{ day: string; signups: number }>
}

// ─── Admin Service ───────────────────────────────────

export interface AdminServiceDeps {
  userRepository: IUserRepository
  reportRepository: { count: (where?: Record<string, unknown>) => Promise<number> }
  adminLogRepository: { create: (data: Record<string, unknown>) => Promise<unknown> }
  prisma: {
    user: { count: (opts?: any) => Promise<number> }
    room: { count: (opts?: any) => Promise<number> }
  }
}

export class AdminService {
  private deps: AdminServiceDeps

  constructor(deps: AdminServiceDeps) {
    this.deps = deps
  }

  /**
   * Get aggregated dashboard metrics.
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const { prisma, userRepository, reportRepository } = this.deps

    const [totalUsers, activeUsers, activeRooms, liveAuctions, proUsers, reports] = await Promise.all([
      userRepository.count(),
      prisma.user.count({ where: { lastActiveAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } as unknown }),
      prisma.room.count({ where: {} as unknown }),
      prisma.room.count({ where: { status: 'DRAFTING' } as unknown }),
      prisma.user.count({ where: { isPro: true } as unknown }),
      reportRepository.count({ where: { status: 'pending' } }),
    ])

    // Signup trend (last 7 days)
    const signupTrend: Array<{ day: string; signups: number }> = []
    for (let i = 6; i >= 0; i--) {
      const day = new Date()
      day.setDate(day.getDate() - i)
      const startOfDay = new Date(day.setHours(0, 0, 0, 0))
      const endOfDay = new Date(day.setHours(23, 59, 59, 999))
      const count = await prisma.user.count({
        where: { createdAt: { gte: startOfDay, lte: endOfDay } },
      })
      signupTrend.push({
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][startOfDay.getDay()] ?? 'Sun',
        signups: count,
      })
    }

    return {
      totalUsers,
      activeUsers,
      activeRooms,
      liveAuctions,
      proUsers,
      pendingReports: reports,
      signupTrend,
    }
  }

  /**
   * Log an admin action to the audit trail.
   */
  async logAction(
    adminId: string,
    action: string,
    targetId?: string | null,
    targetType?: string | null,
    detail: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      await this.deps.adminLogRepository.create({
        adminId,
        action,
        targetId: targetId ?? null,
        targetType: targetType ?? null,
        detail,
      })
    } catch (err: any) {
      logger.error({ event: 'admin.log_failed', err: String(err) }, 'Failed to log admin action')
    }
  }
}
