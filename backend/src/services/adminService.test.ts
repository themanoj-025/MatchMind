/**
 * AdminService Tests — MatchMind
 *
 * Tests AdminService:
 * - getDashboardStats: aggregated metrics from repositories
 * - logAction: audit trail logging with error resilience
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminService, type AdminServiceDeps } from './adminService'

function createMockDeps(overrides: Partial<AdminServiceDeps> = {}): AdminServiceDeps {
  return {
    userRepository: {
      count: vi.fn().mockResolvedValue(100),
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByUsername: vi.fn(),
      findByEmailOrUsername: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      updateSports: vi.fn(),
      updateTeams: vi.fn(),
      followUser: vi.fn(),
      unfollowUser: vi.fn(),
      getNotifications: vi.fn(),
      markNotificationsRead: vi.fn(),
    },
    reportRepository: {
      count: vi.fn().mockResolvedValue(5),
    },
    adminLogRepository: {
      create: vi.fn().mockResolvedValue({}),
    },
    prisma: {
      user: {
        count: vi.fn().mockResolvedValue(50),
      },
      room: {
        count: vi.fn().mockResolvedValue(10),
      },
    },
    ...overrides,
  }
}

describe('AdminService', () => {
  let service: AdminService
  let deps: AdminServiceDeps

  beforeEach(() => {
    deps = createMockDeps()
    service = new AdminService(deps)
  })

  describe('getDashboardStats', () => {
    it('should return aggregated dashboard metrics', async () => {
      const stats = await service.getDashboardStats()

      expect(stats).toHaveProperty('totalUsers')
      expect(stats).toHaveProperty('activeUsers')
      expect(stats).toHaveProperty('activeRooms')
      expect(stats).toHaveProperty('liveAuctions')
      expect(stats).toHaveProperty('proUsers')
      expect(stats).toHaveProperty('pendingReports')
      expect(stats).toHaveProperty('signupTrend')
      expect(Array.isArray(stats.signupTrend)).toBe(true)
      expect(stats.signupTrend).toHaveLength(7)
    })

    it('should call all repository count methods', async () => {
      await service.getDashboardStats()

      expect(deps.userRepository.count).toHaveBeenCalled()
      expect(deps.reportRepository.count).toHaveBeenCalledWith({ where: { status: 'pending' } })
      expect(deps.prisma.user.count).toHaveBeenCalled()
      expect(deps.prisma.room.count).toHaveBeenCalled()
    })

    it('should return signup trend with day names', async () => {
      const stats = await service.getDashboardStats()

      for (const entry of stats.signupTrend) {
        expect(entry).toHaveProperty('day')
        expect(entry).toHaveProperty('signups')
        expect(typeof entry.day).toBe('string')
        expect(typeof entry.signups).toBe('number')
      }
    })
  })

  describe('logAction', () => {
    it('should log an admin action', async () => {
      await service.logAction('admin-1', 'USER_BANNED', 'user-123', 'user', { reason: 'spam' })

      expect(deps.adminLogRepository.create).toHaveBeenCalledWith({
        adminId: 'admin-1',
        action: 'USER_BANNED',
        targetId: 'user-123',
        targetType: 'user',
        detail: { reason: 'spam' },
      })
    })

    it('should handle null targetId and targetType', async () => {
      await service.logAction('admin-1', 'SYSTEM_CONFIG_CHANGED')

      expect(deps.adminLogRepository.create).toHaveBeenCalledWith({
        adminId: 'admin-1',
        action: 'SYSTEM_CONFIG_CHANGED',
        targetId: null,
        targetType: null,
        detail: {},
      })
    })

    it('should not throw when logging fails', async () => {
      const failingDeps = createMockDeps({
        adminLogRepository: {
          create: vi.fn().mockRejectedValue(new Error('DB connection lost')),
        },
      })
      const failingService = new AdminService(failingDeps)

      // Should not throw
      await expect(
        failingService.logAction('admin-1', 'TEST_ACTION'),
      ).resolves.toBeUndefined()
    })
  })
})
