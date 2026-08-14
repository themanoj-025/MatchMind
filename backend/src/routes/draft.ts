/**
 * Draft Mode Routes — MatchMind v4 §1.10, §2
 *
 * REST endpoints for the Draft Mode feature.
 * No WebSocket required (Draft Mode is asynchronous/solo by nature).
 *
 * Endpoints:
 *   POST   /api/draft/start              — Start a new draft (consumes ticket)
 *   GET    /api/draft/:sessionId          — Full session state
 *   GET    /api/draft/:sessionId/next-round — Get next choice round
 *   POST   /api/draft/:sessionId/pick     — Pick a player
 *   POST   /api/draft/:sessionId/commit   — Commit squad
 *   POST   /api/draft/:sessionId/enter-run — Enter Draft Run (§2.1)
 *   GET    /api/draft/:sessionId/run-status — Get Draft Run status (§2.3)
 *   GET    /api/draft/mine                — List user's draft sessions
 *   GET    /api/draft/tickets             — Ticket balance
 *   GET    /api/draft/formations          — List available formations
 */

import express from 'express'
import { authenticateToken } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { draftStartSchema, draftPickSchema } from '../config/schemas'
import type { AuthenticatedRequest } from '../middleware/auth'
import {
  type ChoiceRound,
  type DraftSession,
  type DraftPick,
  type SquadPlayer,
} from '../services/draftService'
import { getDraftEnabledTournaments } from '../middleware/draftGate'
import { draftLimiter } from '../middleware/rateLimiter'
import logger from '../utils/logger'
import { openapiRegistry } from "../config/openapi";

const router = express.Router()

// All draft routes require authentication
router.use(authenticateToken)

// ─── POST /api/draft/start (§1.2) ───────────────────────


openapiRegistry.registerPath({
  method: 'post',
  path: '/start',
  request: { body: { content: { 'application/json': { schema: draftStartSchema } } } },
  responses: { 200: { description: 'Success' } }
})
router.post(
  '/start',
  draftLimiter,
  validate(draftStartSchema),
  async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const draftService = (req as any).container.resolve('draftService')
  // @ts-ignore
      const userService = (req as any).container.resolve('userService')
      
      const { tournamentId, formation } = req.body as { tournamentId: string; formation: string }

      // Verify Draft Mode is enabled for this tournament
      const enabledTournaments = getDraftEnabledTournaments()
      if (!enabledTournaments.includes(tournamentId)) {
        return res.status(403).json({
          error: {
            code: 'DRAFT_MODE_DISABLED',
            message: `Draft Mode is not enabled for tournament "${tournamentId}". Admins can enable it after the player pool has been validated.`,
          },
        })
      }

      // Check if user is Pro
      const user = await userService.getUser(req.userId)
      const isPro = user?.isPro ?? false

      // Start draft (consumes ticket internally)
      const result = await draftService.startDraft(
        req.userId!,
        tournamentId,
        formation,
        () => draftService.consumeTicket(req.userId!, tournamentId, isPro),
      )

      if (!result.success) {
        return res.status(400).json({
          error: { code: 'DRAFT_START_FAILED', message: result.error || 'Failed to start draft' },
        })
      }

      res.status(201).json({
        session: result.session,
        nextRound: result.nextRound,
      })
    },
)

// ─── GET /api/draft/formations ─────────────────────────


openapiRegistry.registerPath({
  method: 'get',
  path: '/formations',
  responses: { 200: { description: 'Success' } }
})
router.get(
  '/formations',
  async (req, res) => {
  // @ts-ignore
        const draftService = (req as any).container.resolve('draftService')
        const formations = draftService.loadFormations()
        res.json(formations)
      },
)

// ─── GET /api/draft/mine (§1.10) ───────────────────────


openapiRegistry.registerPath({
  method: 'get',
  path: '/mine',
  responses: { 200: { description: 'Success' } }
})
router.get(
  '/mine',
  async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
        const draftService = (req as any).container.resolve('draftService')
        const sessions = await draftService.listUserDrafts(req.userId!)
        res.json(sessions)
      },
)

// ─── GET /api/draft/tickets (§1.10) ─────────────────────


openapiRegistry.registerPath({
  method: 'get',
  path: '/tickets',
  responses: { 200: { description: 'Success' } }
})
router.get(
  '/tickets',
  async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
        const draftService = (req as any).container.resolve('draftService')
  // @ts-ignore
        const userService = (req as any).container.resolve('userService')
        const tournamentId = req.query.tournamentId as string | undefined

        const user = await userService.getUser(req.userId)
        const isPro = user?.isPro ?? false

        if (tournamentId) {
          const balance = await draftService.getTicketBalance(req.userId!, tournamentId, isPro)
          res.json(balance)
        } else {
          // Return balances for all LIVE tournaments
          const { listLive } = require('../config/tournaments')
          const liveTournaments = listLive()
          const balances = await Promise.all(
            liveTournaments.map((t: any) =>
              draftService.getTicketBalance(req.userId!, t.id, isPro).then((b: any) => ({
                tournamentId: t.id,
                tournamentName: t.name,
                ...b,
              })),
            ),
          )
          res.json(balances)
        }
      },
)

// ─── GET /api/draft/:sessionId (§1.10) ──────────────────


openapiRegistry.registerPath({
  method: 'get',
  path: '/:sessionId',
  responses: { 200: { description: 'Success' } }
})
router.get(
  '/:sessionId',
  async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
        const draftService = (req as any).container.resolve('draftService')
  // @ts-ignore
        const prisma = (req as any).container.resolve('prisma') // temporary for player fetch
        const result = await draftService.getSessionState(req.params.sessionId as string, req.userId!)

        if (result.error) {
          const status = result.error === 'Session not found' ? 404 : 403
          return res.status(status).json({ error: { code: 'DRAFT_ERROR', message: result.error } })
        }

        // Load player details for the squad
        const allPlayers: any[] = result.session
          ? await prisma.player.findMany({ where: { tournamentId: result.session.tournamentId } })
          : []

        const playersMap = new Map<string, any>(allPlayers.map((p) => [p.id, p]))
        const squadWithPlayers = result.squad.map((sp: any) => {
          const player: any = playersMap.get(sp.playerId)
          return {
            ...sp,
            player: player
              ? {
                  id: player.id,
                  name: player.name,
                  position: player.position,
                  club: player.club,
                  nationality: player.nationality,
                  basePrice: player.basePrice,
                  rarityTier: player.rarityTier,
                  photoUrl: player.photoUrl,
                }
              : null,
          }
        })

        res.json({
          session: result.session,
          picks: result.picks.map((p: any) => ({
            ...p,
            players: p.offeredPlayerIds
              .map((pid: string) => playersMap.get(pid))
              .filter(Boolean),
          })),
          squad: squadWithPlayers,
        })
      },
)

// ─── GET /api/draft/:sessionId/next-round (§1.10) ──────


openapiRegistry.registerPath({
  method: 'get',
  path: '/:sessionId/next-round',
  responses: { 200: { description: 'Success' } }
})
router.get(
  '/:sessionId/next-round',
  async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
        const draftService = (req as any).container.resolve('draftService')
        const result = await draftService.getNextRound(req.params.sessionId as string, req.userId!)

        if (result.error) {
          const status = result.error === 'Session not found' ? 404 : 403
          return res.status(status).json({ error: { code: 'DRAFT_ERROR', message: result.error } })
        }

        if (result.complete && !result.round) {
          return res.json({ complete: true, session: result.session, round: null })
        }

        res.json({
          round: result.round,
          session: result.session,
          complete: false,
        })
      },
)

// ─── POST /api/draft/:sessionId/pick (§1.10) ───────────


openapiRegistry.registerPath({
  method: 'post',
  path: '/:sessionId/pick',
  request: { body: { content: { 'application/json': { schema: draftPickSchema } } } },
  responses: { 200: { description: 'Success' } }
})
router.post(
  '/:sessionId/pick',
  validate(draftPickSchema),
  async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const draftService = (req as any).container.resolve('draftService')
      const { slotIndex, pickedPlayerId } = req.body as { slotIndex: number; pickedPlayerId: string }

      const result = await draftService.processPick(
        req.params.sessionId as string,
        req.userId!,
        slotIndex,
        pickedPlayerId,
      )

      if (!result.success) {
        return res.status(400).json({
          error: { code: 'PICK_REJECTED', message: result.error || 'Pick rejected' },
        })
      }

      res.json({
        success: true,
        nextRound: result.nextRound,
        session: result.session,
        complete: result.complete ?? false,
      })
    },
)

// ─── POST /api/draft/:sessionId/commit (§1.10) ─────────


openapiRegistry.registerPath({
  method: 'post',
  path: '/:sessionId/commit',
  responses: { 200: { description: 'Success' } }
})
router.post(
  '/:sessionId/commit',
  async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
        const draftService = (req as any).container.resolve('draftService')
        const result = await draftService.commitSquad(req.params.sessionId as string, req.userId!)

        if (!result.success) {
          return res.status(400).json({
            error: { code: 'COMMIT_FAILED', message: result.error || 'Failed to commit squad' },
          })
        }

        logger.info({
          event: 'draft.squad_committed_api',
          sessionId: req.params.sessionId,
          userId: req.userId,
          synergyScore: result.synergyScore,
          formationBonus: result.formationBonus,
        })

        res.json({
          success: true,
          session: result.session,
          synergyScore: result.synergyScore,
          formationBonus: result.formationBonus,
          squad: result.squad,
        })
      },
)

// ─── POST /api/draft/:sessionId/enter-run (§2.1) ──────


openapiRegistry.registerPath({
  method: 'post',
  path: '/:sessionId/enter-run',
  responses: { 200: { description: 'Success' } }
})
router.post(
  '/:sessionId/enter-run',
  async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
        const draftService = (req as any).container.resolve('draftService')
        const result = await draftService.enterRun(req.params.sessionId as string, req.userId!)

        if (!result.success) {
          return res.status(400).json({
            error: { code: 'ENTER_RUN_FAILED', message: result.error || 'Failed to enter Draft Run' },
          })
        }

        logger.info({
          event: 'draft_run.entered_api',
          sessionId: req.params.sessionId,
          userId: req.userId,
        })

        res.status(201).json({
          success: true,
          result: result.result,
        })
      },
)

// ─── GET /api/draft/:sessionId/run-status (§2.3) ──────


openapiRegistry.registerPath({
  method: 'get',
  path: '/:sessionId/run-status',
  responses: { 200: { description: 'Success' } }
})
router.get(
  '/:sessionId/run-status',
  async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
        const draftService = (req as any).container.resolve('draftService')
        const result = await draftService.getRunStatus(req.params.sessionId as string, req.userId!)

        if (!result.success) {
          const status = result.error?.includes('not found') ? 404 : 400
          return res.status(status).json({
            error: { code: 'RUN_STATUS_ERROR', message: result.error || 'Failed to get run status' },
          })
        }

        res.json(result.state)
      },
)

// ─── POST /api/draft/:sessionId/resolve-matchday (§2.2) ──


openapiRegistry.registerPath({
  method: 'post',
  path: '/:sessionId/resolve-matchday',
  responses: { 200: { description: 'Success' } }
})
router.post(
  '/:sessionId/resolve-matchday',
  async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
        const draftService = (req as any).container.resolve('draftService')
        const result = await draftService.resolveNextMatchday(req.params.sessionId as string, req.userId!)

        if (!result.success) {
          return res.status(400).json({
            error: { code: 'RESOLVE_FAILED', message: result.error || 'Failed to resolve matchday' },
          })
        }

        logger.info({
          event: 'draft_run.matchday_resolved',
          sessionId: req.params.sessionId,
          userId: req.userId,
          roundNumber: result.round?.roundNumber,
          outcome: result.round?.outcome,
        })

        res.json({
          success: true,
          round: result.round,
          state: result.state,
        })
      },
)

export default router
