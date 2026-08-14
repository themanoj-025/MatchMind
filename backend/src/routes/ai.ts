import { env } from '../config/env'
/**
 * AI Auction Advisor — MatchMind
 *
 * Claude-powered draft strategy hints for Pro users.
 * Analyzes a franchise's current roster + remaining budget + remaining pool
 * and suggests undervalued targets.
 *
 * Security: Requires authentication + Pro check + rate limiting.
 */

import crypto from 'crypto'
import express from 'express'
import { openapiRegistry } from '../config/openapi'
import { authenticateToken } from '../middleware/auth'
import { aiPredictionLimiter } from '../middleware/rateLimiter'
import logger from '../utils/logger'
import type { AuthenticatedRequest } from '../middleware/auth'
import CircuitBreaker from 'opossum'

const aiBreaker = new CircuitBreaker(getAnthropicAdvice, {
  timeout: 10000, // If Anthropic takes >10s, trigger failure
  errorThresholdPercentage: 50, // When 50% of requests fail, trip breaker
  resetTimeout: 30000, // Try again after 30s
})

aiBreaker.fallback((...args: any[]) => {
  logger.warn({ event: 'ai.circuit_breaker_fallback' }, 'AI Circuit Breaker tripped, returning heuristic advice')
  return null
})

const router = express.Router()

/**
 * POST /api/ai/auction-advice
 * Returns AI-powered draft strategy advice for a room/user
 * Pro-gated: only Pro users can access this.
 */
openapiRegistry.registerPath({
  method: 'post',
  path: '/auction-advice',
  responses: { 200: { description: 'Success' } },
})
router.post('/auction-advice', authenticateToken, aiPredictionLimiter, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
  const prisma = (req as any).container.resolve('prisma')
  // @ts-ignore
  const cacheService = (req as any).container.resolve('cacheService')
  const { roomId } = req.body as { roomId: string }

  if (!roomId) {
    return res.status(400).json({ error: { code: 'MISSING_ROOM_ID', message: 'roomId is required' } })
  }

  // Verify room membership
  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: req.userId } },
  })
  if (!member) {
    return res.status(403).json({ error: { code: 'NOT_MEMBER', message: 'You are not a member of this room' } })
  }

  // Pro check
  const isPro = await checkProStatus(prisma, req.userId!)
  if (!isPro) {
    return res.json({
      isProFeature: true,
      advice: null,
      message: 'AI Auction Advisor is a Pro feature. Upgrade to unlock.',
    })
  }

  const room = await prisma.room.findUnique({ where: { id: roomId } })
  if (!room) {
    return res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
  }

  // Gather context for the AI
  const roster = await prisma.roster.findMany({
    where: { roomId, userId: req.userId },
    include: { player: { select: { id: true, name: true, position: true, basePrice: true, club: true } } },
  })

  // Removed redis lrange. Instead, we query remaining pool players efficiently.
  // We can fetch players not in any roster for this tournament.
  const poolPlayers = await prisma.player.findMany({
    where: {
      tournamentId: room.tournamentId,
      rosters: {
        none: { roomId },
      },
    },
  })

  const rosterPositions: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  for (const entry of roster) {
    if (entry.player?.position) {
      // @ts-ignore
      rosterPositions[entry.player.position]++
    }
  }

  const positionNeeds: Record<string, number> = {}
  const defaultRosterRules: Record<string, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3, total: 15 }
  for (const [pos, limit] of Object.entries(defaultRosterRules)) {
    if (pos === 'total') {
      continue
    }
    const filled = rosterPositions[pos] || 0
    const need = (limit as number) - filled
    if (need > 0) {
      positionNeeds[pos] = need
    }
  }

  // Try Anthropic SDK if configured (with Redis caching)

  const rosterStr = JSON.stringify(roster.map((r: any) => `${r.playerId || r.id}:${r.soldPrice}`))
  const poolStr = JSON.stringify(poolPlayers.map((p: any) => p.id).sort())
  const hashInput = `${rosterStr}:${member.remainingBudget}:${poolStr}`
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16)
  const cacheKey = `ai:advice:${roomId}:${req.userId}:${hash}`

  let cacheHit = false

  let finalAdvice = await cacheService.get(cacheKey)
  if (finalAdvice) {
    cacheHit = true
  } else {
    finalAdvice = await cacheService.getOrFetch(cacheKey, 600, async () => {
      let freshAdvice: any = null

      if (env.ANTHROPIC_API_KEY) {
        try {
          freshAdvice = await aiBreaker.fire(
            roster,
            member.remainingBudget,
            positionNeeds,
            poolPlayers,
            defaultRosterRules,
          )
        } catch (err: any) {
          logger.error(
            { event: 'ai.anthropic_advice_error', roomId, err: (err as Error).message },
            'Anthropic API error',
          )
        }
      }

      if (!freshAdvice) {
        freshAdvice = generateHeuristicAdvice(roster, member.remainingBudget, positionNeeds, poolPlayers)
      }

      return freshAdvice
    })
  }

  res.json({
    isProFeature: false,
    advice: finalAdvice,
    cacheHit,
  })
})

async function checkProStatus(prisma: any, userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPro: true, proExpiresAt: true },
  })
  if (!user) {
    return false
  }
  if (!user.isPro) {
    return false
  }
  if (user.proExpiresAt && new Date(user.proExpiresAt) < new Date()) {
    return false
  }
  return true
}

async function getAnthropicAdvice(
  roster: any[],
  remainingBudget: number,
  positionNeeds: Record<string, number>,
  poolPlayers: any[],
  rosterRules: any,
): Promise<any> {
  const Anthropic = require('@anthropic-ai/sdk')
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

  const currentRoster = roster
    .map((r: any) => `${r.player?.name} (${r.player?.position}, purchased for $${r.soldPrice})`)
    .join('\n')

  const availablePlayers = poolPlayers
    .map((p: any) => `${p.name} (${p.position}, base price $${p.basePrice}) - ${p.club}`)
    .join('\n')

  const msg = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `You are an auction draft advisor for fantasy football (soccer). Analyze this franchise's current roster and remaining budget. Provide draft strategy advice in exactly this JSON format:
{
  "summary": "<1-2 sentence overall strategy>",
  "positionNeeds": "<which positions need filling>",
  "targets": ["<player name>", "<player name>"] // Top 3-5 suggested targets from the available pool
  "budgetAdvice": "<how to allocate remaining budget>",
  "warning": "<any risks like overpaying for a position>"
}

Current Roster:\n${currentRoster || 'Empty - no players yet'}

Remaining Budget: $${remainingBudget}

Position Needs: ${JSON.stringify(positionNeeds)}

Available Players in Pool:\n${availablePlayers || 'No remaining players'}

Roster Rules: ${JSON.stringify(rosterRules)}

Only respond with valid JSON, no other text.`,
      },
    ],
  })

  try {
    // @ts-ignore
    const text = (msg.content[0] as unknown)?.text || '{}'
    return JSON.parse(text)
  } catch {
    return null
  }
}

function generateHeuristicAdvice(
  roster: any[],
  remainingBudget: number,
  positionNeeds: Record<string, number>,
  poolPlayers: any[],
): any {
  const totalNeeds = Object.values(positionNeeds).reduce((a: number, b: number) => a + b, 0)
  const budgetPerSlot = totalNeeds > 0 ? Math.floor(remainingBudget / totalNeeds) : remainingBudget

  // Sort pool players by value (basePrice vs position scarcity)
  const positionScarcity: Record<string, number> = { GK: 3, DEF: 4, MID: 4, FWD: 5 }
  const scored = poolPlayers
    .map((p: any) => ({
      ...p,
      score:
        (positionScarcity[p.position] || 3) * p.basePrice > 0
          ? (positionScarcity[p.position] || 3) / (p.basePrice || 50)
          : 0,
    }))
    .sort((a: any, b: any) => b.score - a.score)

  const targets = scored.slice(0, 5).map((p: any) => p.name)

  const positionSummary = Object.entries(positionNeeds)
    .map(([pos, count]) => `${count}x ${pos}`)
    .join(', ')

  return {
    summary:
      totalNeeds > 0
        ? `You need ${totalNeeds} more players. Focus on ${positionSummary}.`
        : 'Your roster is complete! Consider upgrading existing positions if budget allows.',
    positionNeeds,
    targets,
    budgetAdvice:
      totalNeeds > 0
        ? `Try to keep average spend under $${budgetPerSlot} per remaining slot.`
        : 'Budget no longer a concern for minimum roster requirements.',
    warning:
      remainingBudget < budgetPerSlot * totalNeeds
        ? 'Budget is tight — focus on base-price players to fill mandatory slots.'
        : 'Budget is sufficient for remaining needs.',
  }
}

export default router
