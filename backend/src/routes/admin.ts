import { env } from '../config/env'
import express from 'express'
import { authenticateToken } from '../middleware/auth'
import { requireAdmin } from '../middleware/requireAdmin'
import { AdminService } from '../services/adminService'
import { createRepositories } from '../repositories/index'
import logger from '../utils/logger'
import type { AuthenticatedRequest } from '../middleware/auth'
import { validateTournamentDraftPool } from '../lib/validateDraftPool'
import { openapiRegistry } from "../config/openapi";
import { redis } from '../lib/redis'
import { z } from 'zod'
import { paginationSchema, PaginationParams, PaginatedResponse } from '@matchmind/shared-types'

const router = express.Router()

async function invalidatePlayerCache() {
  if (redis.status === 'ready' || redis.status === 'connect') {
    try {
      const keys = await redis.keys('players:*')
      if (keys.length > 0) {
        await redis.del(...keys)
        logger.info({ event: 'redis.cache_invalidated' }, 'Invalidated player cache')
      }
    } catch (err: any) {
      logger.error({ event: 'redis.cache_invalidation_error', err: (err as Error).message }, 'Failed to invalidate cache')
    }
  }
}

// All admin routes require auth + admin role
router.use(authenticateToken, requireAdmin)

// Audit Log Middleware for all mutations
const auditLogMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const method = req.method
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    // Intercept when the response finishes
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const authenticatedReq = req as AuthenticatedRequest
        const actionStr = `API_MUTATION_${method}`
        
        try {
          const adminService = getAdminService(authenticatedReq)
          adminService.logAction(
            authenticatedReq.userId!,
            actionStr,
            req.originalUrl,
            'api',
            {
              body: req.body,
              query: req.query,
              params: req.params,
            }
          ).catch((err: any) => {
            logger.error({ event: 'admin.audit_log_error', err: (err as Error).message }, 'Failed to save audit log in middleware')
          })
        } catch (err: any) {
          logger.error({ event: 'admin.audit_log_setup_error', err: (err as Error).message }, 'Failed to instantiate admin service for logging')
        }
      }
    })
  }
  next()
}
router.use(auditLogMiddleware)

/** Create an AdminService instance from the Express app's prisma client */
function getAdminService(req: AuthenticatedRequest) {
  const prisma = (req as any).container.resolve('prisma')
  const { userRepository, reportRepository, adminLogRepository } = createRepositories(prisma)
  return new AdminService({
    userRepository,
    reportRepository,
    adminLogRepository,
    prisma: {
      user: { count: (opts?: any) => prisma.user.count(opts) },
      room: { count: (opts?: any) => prisma.room.count(opts) },
    },
  })
}

// ─── DASHBOARD STATS ─────────────────────────────────────

/**
 * GET /api/admin/stats
 * Returns aggregated dashboard metrics via AdminService
 */

openapiRegistry.registerPath({
  method: 'get',
  path: '/stats',
  responses: { 200: { description: 'Success' } }
})
router.get('/stats', async (req: AuthenticatedRequest, res) => {
      const stats = await getAdminService(req).getDashboardStats()

      // Compute sport distribution from real fixtures data
      const prisma = (req as any).container.resolve('prisma')
      const allFixtures = await prisma.fixture.findMany({
        select: { sport: true },
      })
      const sportCounts: Record<string, number> = {}
      for (const f of allFixtures) {
        const sport = f.sport || 'UNKNOWN'
        sportCounts[sport] = (sportCounts[sport] || 0) + 1
      }
      const total = Object.values(sportCounts).reduce((a, b) => a + b, 0) || 1
      const sportDistribution = Object.entries(sportCounts)
        .map(([name, value]) => ({ name, value: Math.round((value / total) * 100) }))
        .sort((a, b) => b.value - a.value)

      res.json({
        ...stats,
        sportDistribution,
      })
    })

// ─── SYSTEM METRICS ──────────────────────────────────────

/**
 * GET /api/admin/metrics
 * Returns server and background queue metrics
 */

openapiRegistry.registerPath({
  method: 'get',
  path: '/metrics',
  responses: { 200: { description: 'Success' } }
})
router.get('/metrics', async (req: AuthenticatedRequest, res) => {
      // Use memory usage
      const memoryUsage = process.memoryUsage()
      const uptime = process.uptime()

      // In a real app we might fetch bullmq queue metrics here
      // For the sake of the portfolio, we'll return the system stats.
      res.json({
        uptime,
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
        }
      })
    })

// ─── USER MANAGEMENT ─────────────────────────────────────

/**
 * GET /api/admin/users
 * List users with pagination and search
 */

openapiRegistry.registerPath({
  method: 'get',
  path: '/users',
  responses: { 200: { description: 'Success' } }
})
router.get('/users', async (req: AuthenticatedRequest, res) => {
      const prisma = (req as any).container.resolve('prisma')
      const { page, limit } = paginationSchema.parse(req.query)
      const search = (req.query.search as string) || ''

      const where: Record<string, unknown> = { isDeleted: false }
        if (search) {
          where.OR = [
            { username: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
          ]
        }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            username: true,
            email: true,
            displayName: true,
            avatar: true,
            role: true,
            tier: true,
            isPro: true,
            totalPoints: true,
            predAccuracy: true,
            createdAt: true,
            lastActiveAt: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.user.count({ where }),
      ])

      res.json({ users, total, page, totalPages: Math.ceil(total / limit) })
    })

/**
 * GET /api/admin/users/:id
 * Get detailed user info
 */

openapiRegistry.registerPath({
  method: 'get',
  path: '/users/:id',
  responses: { 200: { description: 'Success' } }
})
router.get('/users/:id', async (req: AuthenticatedRequest, res) => {
      const prisma = (req as any).container.resolve('prisma')
      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        include: {
          subscription: true,
          _count: {
            select: {
              followers: true,
              following: true,
              notifications: true,
            },
          },
        },
      })
      if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } })
      res.json({ user })
    })

/**
 * PATCH /api/admin/users/:id
 * Update user fields
 */

openapiRegistry.registerPath({
  method: 'patch',
  path: '/users/:id',
  responses: { 200: { description: 'Success' } }
})
router.patch('/users/:id', async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const prisma = (req as any).container.resolve('prisma')
      const { role, tier, username, email, displayName } = req.body as {
        role?: string
        tier?: string
        username?: string
        email?: string
        displayName?: string
      }

      const data: Record<string, any> = {}
      if (role) data.role = role
      if (tier) data.tier = tier
      if (username) data.username = username
      if (email) data.email = email
      if (displayName) data.displayName = displayName

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data,
        select: { id: true, username: true, email: true, role: true, tier: true },
      })

      res.json({ user })
    })

/**
 * DELETE /api/admin/users/:id
 * Soft-delete user (sets isDeleted flag instead of permanent removal).
 */

openapiRegistry.registerPath({
  method: 'delete',
  path: '/users/:id',
  responses: { 200: { description: 'Success' } }
})
router.delete('/users/:id', async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const prisma = (req as any).container.resolve('prisma')
      await prisma.user.update({
        where: { id: req.params.id },
        data: { isDeleted: true, email: `deleted-${req.params.id}@matchmind.gg`, username: `deleted-${req.params.id}` },
      })
      getAdminService(req).logAction(req.userId!, 'USER_SOFT_DELETED', String(req.params.id), 'user', {})
      res.json({ message: 'User soft-deleted' })
    })

/**
 * POST /api/admin/users/:id/toggle-pro
 * Toggle Pro status for a user
 */

openapiRegistry.registerPath({
  method: 'post',
  path: '/users/:id/toggle-pro',
  responses: { 200: { description: 'Success' } }
})
router.post('/users/:id/toggle-pro', async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const prisma = (req as any).container.resolve('prisma')
      const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { isPro: true } })
      if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } })

      const updated = await prisma.user.update({
        where: { id: req.params.id },
        data: {
          isPro: !user.isPro,
          proExpiresAt: user.isPro ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
        select: { id: true, isPro: true, proExpiresAt: true },
      })

      getAdminService(req).logAction(req.userId!, 'PRO_TOGGLED', String(req.params.id), 'user', {
        wasPro: user.isPro,
        nowPro: !user.isPro,
      })
      res.json({ user: updated })
    })

// ─── FIXTURE MANAGEMENT ─────────────────────────────────

/**
 * GET /api/admin/fixtures
 * List all fixtures with pagination
 */

openapiRegistry.registerPath({
  method: 'get',
  path: '/fixtures',
  responses: { 200: { description: 'Success' } }
})
router.get('/fixtures', async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const prisma = (req as any).container.resolve('prisma')
      const { page, limit } = paginationSchema.parse(req.query)
      const tournamentId = req.query.tournamentId as string | undefined

      const where: Record<string, any> = {}
      if (tournamentId) where.tournamentId = tournamentId

      const [fixtures, total] = await Promise.all([
        prisma.fixture.findMany({
          where,
          orderBy: { scheduledAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.fixture.count({ where }),
      ])

      res.json({ fixtures, total, page, totalPages: Math.ceil(total / limit) })
    })

/**
 * PATCH /api/admin/fixtures/:id
 * Update fixture details (score, status)
 */

openapiRegistry.registerPath({
  method: 'patch',
  path: '/fixtures/:id',
  responses: { 200: { description: 'Success' } }
})
router.patch('/fixtures/:id', async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const prisma = (req as any).container.resolve('prisma')
      const { homeScore, awayScore, status } = req.body as {
        homeScore?: number
        awayScore?: number
        status?: string
      }

      const data: Record<string, any> = {}
      if (homeScore !== undefined) data.homeScore = homeScore
      if (awayScore !== undefined) data.awayScore = awayScore
      if (status) data.status = status

      const fixture = await prisma.fixture.update({
        where: { id: req.params.id },
        data,
      })

      getAdminService(req).logAction(req.userId!, 'FIXTURE_UPDATED', String(req.params.id), 'fixture', { ...data })
      res.json({ fixture })
    })

// ─── REPORTS ─────────────────────────────────────────────

/**
 * GET /api/admin/reports
 * List reports with pagination and status filter
 */

openapiRegistry.registerPath({
  method: 'get',
  path: '/reports',
  responses: { 200: { description: 'Success' } }
})
router.get('/reports', async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const prisma = (req as any).container.resolve('prisma')
      const { page, limit } = paginationSchema.parse(req.query)
      const status = (req.query.status as string) || 'pending'

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where: { status },
          include: {
            reporter: { select: { id: true, username: true, avatar: true } },
            message: { select: { id: true, text: true, createdAt: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.report.count({ where: { status } }),
      ])

      res.json({ reports, total, page, totalPages: Math.ceil(total / limit) })
    })

/**
 * PATCH /api/admin/reports/:id
 * Resolve or dismiss a report
 */

openapiRegistry.registerPath({
  method: 'patch',
  path: '/reports/:id',
  responses: { 200: { description: 'Success' } }
})
router.patch('/reports/:id', async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const prisma = (req as any).container.resolve('prisma')
      const { status } = req.body as { status?: string } // 'resolved' | 'dismissed'

      const report = await prisma.report.update({
        where: { id: req.params.id },
        data: { status: status || 'resolved' },
      })

      // If resolved and has a message, delete the message
      if (status === 'resolved' && report.messageId) {
        await prisma.chatMessage.update({
          where: { id: report.messageId },
          data: { isDeleted: true },
        })
      }

      getAdminService(req).logAction(req.userId!, status === 'resolved' ? 'REPORT_RESOLVED' : 'REPORT_DISMISSED', String(req.params.id), 'report', {
        reportStatus: status,
      })
      res.json({ report })
    })

// ─── ACTIVITY LOG ────────────────────────────────────────────

/**
 * GET /api/admin/activity-log
 * Returns recent admin actions with pagination
 */

openapiRegistry.registerPath({
  method: 'get',
  path: '/activity-log',
  responses: { 200: { description: 'Success' } }
})
router.get('/activity-log', async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const prisma = (req as any).container.resolve('prisma')
      const { page, limit } = paginationSchema.parse(req.query)

      const [logs, total] = await Promise.all([
        prisma.adminLog.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.adminLog.count(),
      ])

      res.json({ logs, total, page, totalPages: Math.ceil(total / limit) })
    })

// ─── FEATURE FLAGS ───────────────────────────────────────

/**
 * GET /api/admin/settings
 * Get feature flags and system settings
 */

openapiRegistry.registerPath({
  method: 'get',
  path: '/settings',
  responses: { 200: { description: 'Success' } }
})
router.get('/settings', (_req, res) => {
  // Parse draft-enabled tournaments from env (comma-separated ids, e.g. "fifa-wc-2026,uefa-ucl-2026-27")
  const draftEnabledRaw = env.DRAFT_ENABLED_TOURNAMENTS || ''
  const draftEnabledTournaments = draftEnabledRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  res.json({
    settings: [
      { flag: 'AI Hints', key: 'FLAG_AI_HINTS', enabled: env.FLAG_AI_HINTS !== 'false' },
      { flag: 'Pro Gate AI', key: 'FLAG_PRO_GATE_AI', enabled: env.FLAG_PRO_GATE_AI !== 'false' },
      { flag: 'Chat GIFs', key: 'FLAG_CHAT_GIFS', enabled: env.FLAG_CHAT_GIFS !== 'false' },
      { flag: 'Leaderboard Realtime', key: 'FLAG_LB_REALTIME', enabled: env.FLAG_LB_REALTIME === 'true' },
      { flag: 'Direct Messages', key: 'FLAG_DM', enabled: env.FLAG_DM === 'true' },
      { flag: 'Draft Mode', key: 'DRAFT_ENABLED_TOURNAMENTS', enabled: draftEnabledTournaments.length > 0, tournaments: draftEnabledTournaments },
    ],
  })
})

/**
 * POST /api/admin/settings/draft-mode/:tournamentId/:action
 * Enable or disable Draft Mode for a tournament.
 * Uses the shared validateDraftPoolLib module — no subprocess needed.
 * Refuses to enable if validation fails (§6.4).
 */

openapiRegistry.registerPath({
  method: 'post',
  path: '/settings/draft-mode/:tournamentId/:action',
  responses: { 200: { description: 'Success' } }
})
router.post('/settings/draft-mode/:tournamentId/:action', async (req: AuthenticatedRequest, res) => {
      const tournamentId = String(req.params.tournamentId)
      const action = String(req.params.action)

      // Use default data dir (backend/src/data/) — the lib resolves this automatically
      const validationResult = validateTournamentDraftPool(tournamentId)

      if (action === 'enable') {
        if (!validationResult.passed) {
          return res.status(400).json({
            error: {
              code: 'DRAFT_POOL_INSUFFICIENT',
              message: 'Draft Mode cannot be enabled — player pool validation failed',
              details: validationResult,
            },
          })
        }

        // Add to env-controlled list (in production this would update a DB/config store)
        const current = (env.DRAFT_ENABLED_TOURNAMENTS || '').split(',').map((s) => s.trim()).filter(Boolean)
        if (!current.includes(tournamentId)) {
          current.push(tournamentId)
          env.DRAFT_ENABLED_TOURNAMENTS = current.join(',')
        }

        getAdminService(req).logAction(req.userId!, 'DRAFT_MODE_ENABLED', tournamentId, 'tournament', {
          validationPassed: true,
        })

        res.json({
          message: `Draft Mode enabled for ${tournamentId}`,
          tournamentId,
          validation: validationResult,
        })
      } else if (action === 'disable') {
        const current = (env.DRAFT_ENABLED_TOURNAMENTS || '').split(',').map((s) => s.trim()).filter(Boolean)
        env.DRAFT_ENABLED_TOURNAMENTS = current.filter((id) => id !== tournamentId).join(',')

        getAdminService(req).logAction(req.userId!, 'DRAFT_MODE_DISABLED', tournamentId, 'tournament', {})

        res.json({ message: `Draft Mode disabled for ${tournamentId}` })
      } else if (action === 'validate') {
        res.json({
          tournamentId,
          validation: validationResult,
          canEnable: validationResult.passed,
        })
      } else {
        res.status(400).json({ error: { code: 'INVALID_ACTION', message: 'Action must be enable, disable, or validate' } })
      }
    })

// ─── DRAFT MODE ADMIN — Pool Validation ────────────────────

/**
 * GET /api/admin/draft/pool-validation
 * Validates Draft Mode readiness for all tournaments in the registry.
 * Runs the same validation logic as the CLI script.
 */

openapiRegistry.registerPath({
  method: 'get',
  path: '/draft/pool-validation',
  responses: { 200: { description: 'Success' } }
})
router.get('/draft/pool-validation', async (_req: AuthenticatedRequest, res) => {
      const { TOURNAMENTS } = require('../config/tournaments')
      const results = TOURNAMENTS.map((t: any) => {
        const result = validateTournamentDraftPool(t.id)
        return {
          ...result,
          tournamentName: t.name,
          shortName: t.shortName,
          status: t.status,
          iconCount: 0, // populated below
          playerCount: 0,
          enabled: (env.DRAFT_ENABLED_TOURNAMENTS || '').split(',').map((s: string) => s.trim()).filter(Boolean).includes(t.id),
        }
      })

      // Enrich with icon counts from player data
      const fs = require('fs')
      const path = require('path')
      const playersPath = path.join(__dirname, '..', 'data', 'players.json')
      if (fs.existsSync(playersPath)) {
        const allPlayers = JSON.parse(fs.readFileSync(playersPath, 'utf-8'))
        for (const r of results) {
          r.iconCount = allPlayers.filter((p: any) => p.tournamentId === r.tournamentId && p.rarityTier === 'ICON').length
          r.playerCount = allPlayers.filter((p: any) => p.tournamentId === r.tournamentId).length
        }
      }

      res.json({ tournaments: results })
    })

// ─── DRAFT MODE ADMIN — ICON Management ────────────────────

/**
 * GET /api/admin/draft/icons
 * Lists all ICON-rarity players across all tournaments.
 */

openapiRegistry.registerPath({
  method: 'get',
  path: '/draft/icons',
  responses: { 200: { description: 'Success' } }
})
router.get('/draft/icons', async (req: AuthenticatedRequest, res) => {
      const fs = require('fs')
      const path = require('path')
      const playersPath = path.join(__dirname, '..', 'data', 'players.json')
      if (!fs.existsSync(playersPath)) {
        return res.json({ players: [] })
      }
      const allPlayers = JSON.parse(fs.readFileSync(playersPath, 'utf-8'))
      const icons = allPlayers
        .filter((p: any) => p.rarityTier === 'ICON' || p.isEligibleForIcon)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          tournamentId: p.tournamentId,
          position: p.position,
          club: p.club,
          nationality: p.nationality,
          basePrice: p.basePrice,
          rarityTier: p.rarityTier || 'BRONZE',
          isEligibleForIcon: p.isEligibleForIcon || false,
          photoUrl: p.photoUrl,
        }))
        .sort((a: any, b: any) => a.tournamentId.localeCompare(b.tournamentId) || b.basePrice - a.basePrice)

      res.json({ players: icons })
    })

/**
 * POST /api/admin/draft/icons/:playerId/toggle
 * Toggle the isEligibleForIcon flag on a player.
 * After toggling, rarity tiers must be recomputed via revalidate.
 */

openapiRegistry.registerPath({
  method: 'post',
  path: '/draft/icons/:playerId/toggle',
  responses: { 200: { description: 'Success' } }
})
router.post('/draft/icons/:playerId/toggle', async (req: AuthenticatedRequest, res) => {
      const fs = require('fs')
      const path = require('path')
      const playersPath = path.join(__dirname, '..', 'data', 'players.json')

      if (!fs.existsSync(playersPath)) {
        return res.status(404).json({ error: { code: 'PLAYERS_NOT_FOUND', message: 'players.json not found' } })
      }

      const allPlayers = JSON.parse(fs.readFileSync(playersPath, 'utf-8'))
      const playerIndex = allPlayers.findIndex((p: any) => p.id === req.params.playerId)

      if (playerIndex === -1) {
        return res.status(404).json({ error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found in players.json' } })
      }

      const player = allPlayers[playerIndex]
      const newValue = !player.isEligibleForIcon

      allPlayers[playerIndex] = {
        ...player,
        isEligibleForIcon: newValue,
      }

      // Write back atomically
      const tmpPath = playersPath + '.tmp'
      fs.writeFileSync(tmpPath, JSON.stringify(allPlayers, null, 2), 'utf-8')
      fs.renameSync(tmpPath, playersPath)

      getAdminService(req).logAction(req.userId!, 'ICON_ELIGIBILITY_TOGGLED', String(req.params.playerId), 'player', {
        wasEligible: !newValue,
      })

      await invalidatePlayerCache()

      res.json({ success: true, player: allPlayers[playerIndex] })

      logger.info({
        event: 'admin.icon_toggled',
        adminId: req.userId,
        playerId: req.params.playerId,
        playerName: player.name,
        nowEligible: newValue,
      })

      res.json({
        success: true,
        player: {
          id: player.id,
          name: player.name,
          isEligibleForIcon: newValue,
        },
      })
    })

/**
 * POST /api/admin/draft/revalidate
 * Re-validates the pool and re-computes rarity tiers for a single tournament or all.
 * Calls the same logic as computeRarityTiers.ts then validateDraftPool.ts.
 */

openapiRegistry.registerPath({
  method: 'post',
  path: '/draft/revalidate',
  responses: { 200: { description: 'Success' } }
})
router.post('/draft/revalidate', async (req: AuthenticatedRequest, res) => {
      const tournamentId = req.body.tournamentId as string | undefined

      // 1. Re-compute rarity tiers
      const fs = require('fs')
      const path = require('path')
      const playersPath = path.join(__dirname, '..', 'data', 'players.json')

      if (!fs.existsSync(playersPath)) {
        return res.status(404).json({ error: { code: 'PLAYERS_NOT_FOUND', message: 'players.json not found' } })
      }

      // Read players
      let allPlayers = JSON.parse(fs.readFileSync(playersPath, 'utf-8'))
      const tournamentIds = tournamentId
        ? [tournamentId]
        : [...new Set(allPlayers.map((p: any) => p.tournamentId))]

      // Re-assign rarity tiers
      // Sort each tournament's players by basePrice descending, assign BRONZE/SILVER/GOLD/ICON per percentiles
      const RARITY_TIERS_FN = [
        { tier: 'BRONZE', maxPercentile: 60 },
        { tier: 'SILVER', maxPercentile: 85 },
        { tier: 'GOLD', maxPercentile: 97 },
        { tier: 'ICON', maxPercentile: 100 },
      ]

      for (const tid of tournamentIds) {
        const tournamentPlayers = allPlayers.filter((p: any) => p.tournamentId === tid)
        if (tournamentPlayers.length === 0) continue

        const sorted = [...tournamentPlayers].sort((a: any, b: any) => b.basePrice - a.basePrice)
        const total = sorted.length

        // Build a map of { playerId: rarityTier }
        const rarityMap = new Map<string, string>()
        for (let i = 0; i < total; i++) {
          const player = sorted[i]
          const percentile = ((i + 1) / total) * 100
          const bottomPct = 100 - percentile

          let assignedTier: string = 'BRONZE'
          for (const t of RARITY_TIERS_FN) {
            if (bottomPct <= t.maxPercentile) {
              assignedTier = t.tier
              break
            }
          }

          // ICON requires isEligibleForIcon flag
          if (assignedTier === 'ICON' && !player.isEligibleForIcon) {
            assignedTier = 'GOLD'
          }

          rarityMap.set(player.id, assignedTier)
        }

        // Apply to allPlayers
        allPlayers = allPlayers.map((p: any) =>
          p.tournamentId === tid && rarityMap.has(p.id)
            ? { ...p, rarityTier: rarityMap.get(p.id) as string }
            : p,
        )
      }

      // Write back atomically
      const tmpPath = playersPath + '.tmp'
      fs.writeFileSync(tmpPath, JSON.stringify(allPlayers, null, 2), 'utf-8')
      fs.renameSync(tmpPath, playersPath)

      // 2. Re-validate
      const tidArray = Array.from(tournamentIds) as string[]
      const results = tidArray.map((tid: string) => {
        const result = validateTournamentDraftPool(tid)
        return {
          ...result,
        }
      })

      getAdminService(req).logAction(req.userId!, 'DRAFT_POOL_REVALIDATED', '', 'draft', {
        tournamentIds,
        allPassed: results.every((r: any) => r.passed),
      })

      await invalidatePlayerCache()

      res.json({
        success: true,
        message: `Re-validated ${results.length} tournament(s)`,
        results,
        allPassed: results.every((r: any) => r.passed),
      })
    })

export default router
