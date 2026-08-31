/** Auction types, state interfaces, and pure validation functions. */

/**
 * Auction Engine — MatchMind
 *
 * Core bidding/timer/anti-snipe state machine.
 * All state mutations happen inside per-room AsyncMutex critical sections.
 *
 * State machine per room:
 *   IDLE → PLAYER_LIVE → SOLD/UNSOLD → PLAYER_LIVE (next player)
 *   (pool exhausted + unsold exhausted) → FINISHED
 */

import { acquireLock } from './lockService'
import {
  BID_INCREMENTS,
  AUCTION_DEFAULT_TIMER_SECONDS,
  AUCTION_ANTI_SNIPE_SECONDS,
  AUCTION_ANTI_SNIPE_RESET_SECONDS,
  DEFAULT_ROSTER_RULES,
} from '../config/tournaments'
import logger from '../utils/logger'
import { redis } from '../lib/redis'

// ─── Types ───────────────────────────────────────────────

export type AuctionPhase = 'IDLE' | 'PLAYER_LIVE' | 'SOLD' | 'UNSOLD' | 'RE_AUCTION' | 'FINISHED'

export interface AuctionState {
  roomId: string
  phase: AuctionPhase
  currentPlayerId: string | null
  currentBid: number
  currentBidderId: string | null
  timerEndsAt: string | null
  version: number
}

export interface BidRequest {
  roomId: string
  playerId: string
  amount: number
  userId: string
  expectedVersion: number
}

export interface BidResult {
  accepted: boolean
  reason?: string
  newState?: AuctionState
}

// ─── Lock Helper ─────────────────────────────────────────

async function runWithLock<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
  const lock = await acquireLock(`lock:auction:${roomId}`)
  try {
    return await fn()
  } finally {
    await lock.release()
  }
}

// ─── Required Increment ──────────────────────────────────

export function requiredIncrement(currentBid: number): number {
  for (let i = BID_INCREMENTS.length - 1; i >= 0; i--) {
    if (currentBid >= BID_INCREMENTS[i]!.threshold) {
      return BID_INCREMENTS[i]!.increment
    }
  }
  return BID_INCREMENTS[0].increment
}

// ─── Validate Budget for Remaining Slots ─────────────────

export function validateBudgetForRemainingSlots(args: {
  remainingBudget: number
  bidAmount: number
  playerPosition: string
  rosterRules: { GK: number; DEF: number; MID: number; FWD: number; total: number }
  currentRoster: Array<{ position: string; soldPrice: number }>
  minPlayerPrice?: number
}): { valid: boolean; reason?: string } {
  const { remainingBudget, bidAmount, playerPosition, rosterRules, currentRoster } = args
  const minPlayerPrice = args.minPlayerPrice ?? 5
  // Calculate remaining slots per position
  const positionCounts: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  for (const entry of currentRoster) {
    if (positionCounts[entry.position] !== undefined) {
      positionCounts[entry.position]!++
    }
  }

  // Check if bidder has an open slot in the player's position
  const positionLimits: Record<string, number> = {
    GK: rosterRules.GK,
    DEF: rosterRules.DEF,
    MID: rosterRules.MID,
    FWD: rosterRules.FWD,
  }

  if (positionCounts[playerPosition]! >= positionLimits[playerPosition]!) {
    return { valid: false, reason: `ROSTER_SLOT_FULL: No remaining ${playerPosition} slots` }
  }

  // Calculate remaining budget after this bid
  const budgetAfterBid = remainingBudget - bidAmount

  // Calculate minimum needed for remaining mandatory slots
  const remainingSlotsPerPosition: Record<string, number> = {}
  for (const pos of ['GK', 'DEF', 'MID', 'FWD']) {
    remainingSlotsPerPosition[pos] = positionLimits[pos]! - positionCounts[pos]!
  }

  // Subtract the current player's position slot (they'll fill it)
  remainingSlotsPerPosition[playerPosition] = Math.max(0, remainingSlotsPerPosition[playerPosition]! - 1)

  const totalRemainingSlots = Object.values(remainingSlotsPerPosition).reduce((a, b) => a + b, 0)
  if (totalRemainingSlots === 0) {
    return { valid: true }
  } // All slots filled

  // Need at least minPlayerPrice per remaining slot
  const minimumReserve = totalRemainingSlots * minPlayerPrice

  if (budgetAfterBid < minimumReserve) {
    return {
      valid: false,
      reason: `INSUFFICIENT_BUDGET: Bidding ${bidAmount} would leave ${budgetAfterBid}, but need ${minimumReserve} reserve for ${totalRemainingSlots} remaining slots`,
    }
  }

  return { valid: true }
}

// ─── Process Bid ─────────────────────────────────────────
