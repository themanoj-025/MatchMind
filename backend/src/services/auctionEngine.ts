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
    // @ts-ignore
    if (currentBid >= BID_INCREMENTS[i].threshold) {
      // @ts-ignore
      return BID_INCREMENTS[i].increment
    }
  }
  return BID_INCREMENTS[0].increment
}

// ─── Validate Budget for Remaining Slots ─────────────────

export function validateBudgetForRemainingSlots(
  remainingBudget: number,
  bidAmount: number,
  playerPosition: string,
  rosterRules: { GK: number; DEF: number; MID: number; FWD: number; total: number },
  currentRoster: Array<{ position: string; soldPrice: number }>,
  _playerPool: Array<{ id: string; position: string; basePrice: number }>,
  minPlayerPrice: number = 5,
): { valid: boolean; reason?: string } {
  // Calculate remaining slots per position
  const positionCounts: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  for (const entry of currentRoster) {
    if (positionCounts[entry.position] !== undefined) {
      // @ts-ignore
      positionCounts[entry.position]++
    }
  }

  // Check if bidder has an open slot in the player's position
  const positionLimits: Record<string, number> = {
    GK: rosterRules.GK,
    DEF: rosterRules.DEF,
    MID: rosterRules.MID,
    FWD: rosterRules.FWD,
  }

  // @ts-ignore
  if (positionCounts[playerPosition] >= positionLimits[playerPosition]) {
    return { valid: false, reason: `ROSTER_SLOT_FULL: No remaining ${playerPosition} slots` }
  }

  // Calculate remaining budget after this bid
  const budgetAfterBid = remainingBudget - bidAmount

  // Calculate minimum needed for remaining mandatory slots
  const remainingSlotsPerPosition: Record<string, number> = {}
  for (const pos of ['GK', 'DEF', 'MID', 'FWD']) {
    // @ts-ignore
    remainingSlotsPerPosition[pos] = positionLimits[pos] - positionCounts[pos]
  }

  // Subtract the current player's position slot (they'll fill it)
  // @ts-ignore
  remainingSlotsPerPosition[playerPosition] = Math.max(0, remainingSlotsPerPosition[playerPosition] - 1)

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

export async function processBid(
  bid: BidRequest,
  getRoom: (roomId: string) => Promise<any>,
  getPlayer: (playerId: string) => Promise<any>,
  getRoomMember: (roomId: string, userId: string) => Promise<any>,
  getRoster: (roomId: string, userId: string) => Promise<any[]>,
  getAuctionState: (roomId: string) => Promise<AuctionState | null>,
  saveAuctionState: (roomId: string, state: AuctionState) => Promise<void>,
  saveBid: (bid: any) => Promise<void>,
  getPlayerPool: (roomId: string) => Promise<any[]>,
): Promise<BidResult> {
  return runWithLock(bid.roomId, async () => {
    // 1. Re-read state fresh from DB (never trust in-memory cache)
    const state = await getAuctionState(bid.roomId)
    if (!state) {
      return { accepted: false, reason: 'ROOM_NOT_FOUND' }
    }

    // 2. Optimistic concurrency check
    if (state.version !== bid.expectedVersion) {
      return { accepted: false, reason: 'BID_STALE_STATE' }
    }

    // 3. Validate room state
    const room = await getRoom(bid.roomId)
    if (!room || (room.status !== 'DRAFTING' && room.status !== 'LIVE')) {
      return { accepted: false, reason: 'ROOM_NOT_ACTIVE' }
    }
    if (state.phase !== 'PLAYER_LIVE') {
      return { accepted: false, reason: 'NO_PLAYER_LIVE' }
    }
    if (state.currentPlayerId !== bid.playerId) {
      return { accepted: false, reason: 'WRONG_PLAYER_UNDER_HAMMER' }
    }

    // 4. Validate bidder is active member
    const member = await getRoomMember(bid.roomId, bid.userId)
    if (!member) {
      return { accepted: false, reason: 'NOT_ROOM_MEMBER' }
    }

    // 5. Validate minimum bid amount
    const minBid = state.currentBid + requiredIncrement(state.currentBid)
    if (bid.amount < minBid) {
      return { accepted: false, reason: `BID_TOO_LOW: Minimum bid is ${minBid}` }
    }

    // 6. Validate budget + roster slot constraints
    const player = await getPlayer(bid.playerId)
    if (!player) {
      return { accepted: false, reason: 'PLAYER_NOT_FOUND' }
    }

    const roster = await getRoster(bid.roomId, bid.userId)
    const playerPool = await getPlayerPool(bid.roomId)
    const budgetValidation = validateBudgetForRemainingSlots(
      member.remainingBudget,
      bid.amount,
      player.position,
      DEFAULT_ROSTER_RULES,
      roster.map((r: any) => ({ position: r.position || player.position, soldPrice: r.soldPrice })),
      playerPool,
    )
    if (!budgetValidation.valid) {
      return { accepted: false, reason: budgetValidation.reason! }
    }

    // 7. Apply bid — update state and persist
    const now = new Date()
    const timerMs = state.timerEndsAt ? new Date(state.timerEndsAt).getTime() - now.getTime() : 0
    const timerSeconds = timerMs / 1000

    // Anti-snipe: if bid is placed in last anti-snipe seconds, reset timer
    let newTimerEnd = new Date(now.getTime() + AUCTION_DEFAULT_TIMER_SECONDS * 1000)
    if (timerSeconds <= AUCTION_ANTI_SNIPE_SECONDS) {
      newTimerEnd = new Date(now.getTime() + AUCTION_ANTI_SNIPE_RESET_SECONDS * 1000)
    }

    const newState: AuctionState = {
      ...state,
      currentBid: bid.amount,
      currentBidderId: bid.userId,
      timerEndsAt: newTimerEnd.toISOString(),
      version: state.version + 1,
    }

    // Save updated state
    await saveAuctionState(bid.roomId, newState)

    // Save bid record (append-only audit log)
    await saveBid({
      roomId: bid.roomId,
      playerId: bid.playerId,
      userId: bid.userId,
      amount: bid.amount,
      timestamp: now.toISOString(),
      version: newState.version,
    })

    logger.info({
      event: 'auction.bid_placed',
      roomId: bid.roomId,
      playerId: bid.playerId,
      userId: bid.userId,
      amount: bid.amount,
      version: newState.version,
    })

    return { accepted: true, newState }
  })
}

// ─── Sell Current Player ─────────────────────────────────

export async function sellCurrentPlayer(
  roomId: string,
  getAuctionState: (roomId: string) => Promise<AuctionState | null>,
  saveAuctionState: (roomId: string, state: AuctionState) => Promise<void>,
): Promise<AuctionState | null> {
  return runWithLock(roomId, async () => {
    const state = await getAuctionState(roomId)
    if (!state || state.phase !== 'PLAYER_LIVE') {
      return null
    }

    const newState: AuctionState = {
      ...state,
      phase: 'SOLD',
      version: state.version + 1,
    }

    await saveAuctionState(roomId, newState)
    return newState
  })
}

// ─── Mark Current Player Unsold ──────────────────────────

export async function unsoldCurrentPlayer(
  roomId: string,
  getAuctionState: (roomId: string) => Promise<AuctionState | null>,
  saveAuctionState: (roomId: string, state: AuctionState) => Promise<void>,
): Promise<AuctionState | null> {
  return runWithLock(roomId, async () => {
    const state = await getAuctionState(roomId)
    if (!state || state.phase !== 'PLAYER_LIVE') {
      return null
    }

    const currentPlayerId = state.currentPlayerId
    const newState: AuctionState = {
      ...state,
      phase: 'UNSOLD',
      currentPlayerId: null,
      currentBid: 0,
      currentBidderId: null,
      timerEndsAt: null,
      version: state.version + 1,
    }

    if (currentPlayerId) {
      await redis.rpush(`auction:${roomId}:unsold`, currentPlayerId)
    }

    await saveAuctionState(roomId, newState)
    return newState
  })
}

// ─── Move to Next Player ─────────────────────────────────

export async function moveToNextPlayer(
  roomId: string,
  getAuctionState: (roomId: string) => Promise<AuctionState | null>,
  saveAuctionState: (roomId: string, state: AuctionState) => Promise<void>,
): Promise<AuctionState | null> {
  return runWithLock(roomId, async () => {
    const state = await getAuctionState(roomId)
    if (!state) {
      return null
    }

    const nextPlayerId = await redis.lpop(`auction:${roomId}:pool`)

    if (!nextPlayerId) {
      // Pool is exhausted
      const unsoldLen = await redis.llen(`auction:${roomId}:unsold`)
      if (unsoldLen > 0) {
        // Switch to re-auction mode
        const newState: AuctionState = {
          ...state,
          phase: 'RE_AUCTION',
          currentPlayerId: null,
          currentBid: 0,
          currentBidderId: null,
          timerEndsAt: null,
          version: state.version + 1,
        }
        await saveAuctionState(roomId, newState)
        return newState
      }

      // Everything exhausted — auction finished
      const newState: AuctionState = {
        ...state,
        phase: 'FINISHED',
        currentPlayerId: null,
        currentBid: 0,
        currentBidderId: null,
        timerEndsAt: null,
        version: state.version + 1,
      }
      await saveAuctionState(roomId, newState)
      return newState
    }

    const newState: AuctionState = {
      ...state,
      phase: 'PLAYER_LIVE',
      currentPlayerId: nextPlayerId,
      currentBid: 0,
      currentBidderId: null,
      timerEndsAt: new Date(Date.now() + AUCTION_DEFAULT_TIMER_SECONDS * 1000).toISOString(),
      version: state.version + 1,
    }

    await saveAuctionState(roomId, newState)
    return newState
  })
}

// ─── Timer Expiry Check ──────────────────────────────

/**
 * Check if the current player's timer has expired and auto-advance if so.
 * Called from a setInterval in the server startup, and also after every bid.
 *
 * Returns { action, state } where action is one of:
 *   'SOLD_AND_NEXT' — timer expired with a bidder → sold + move to next
 *   'UNSOLD_AND_NEXT' — timer expired with no bidder → unsold + move to next
 *   'RE_AUCTION' — pool exhausted → entered re-auction phase
 *   'FINISHED' — everything exhausted → auction complete
 *   null — no action needed (timer still running, or not in PLAYER_LIVE)
 */
export async function checkAuctionTimer(
  roomId: string,
  getAuctionState: (roomId: string) => Promise<AuctionState | null>,
  saveAuctionState: (roomId: string, state: AuctionState) => Promise<void>,
  deductBudget: (roomId: string, userId: string, amount: number) => Promise<void>,
  createRosterEntry: (entry: { roomId: string; userId: string; playerId: string; soldPrice: number }) => Promise<void>,
): Promise<{ action: string; state: AuctionState | null } | null> {
  return runWithLock(roomId, async () => {
    const state = await getAuctionState(roomId)
    if (!state || state.phase !== 'PLAYER_LIVE') {
      return null
    }
    if (!state.timerEndsAt) {
      return null
    }

    const now = Date.now()
    const timerEnd = new Date(state.timerEndsAt).getTime()

    // Timer still running
    if (timerEnd > now) {
      return null
    }

    // Timer expired — resolve current player
    if (state.currentBidderId && state.currentPlayerId && state.currentBid > 0) {
      // Player is SOLD to the current bidder
      await deductBudget(roomId, state.currentBidderId, state.currentBid)
      await createRosterEntry({
        roomId,
        userId: state.currentBidderId,
        playerId: state.currentPlayerId,
        soldPrice: state.currentBid,
      })

      // Mark as SOLD, then advance to next player
      const soldState: AuctionState = {
        ...state,
        phase: 'SOLD',
        version: state.version + 1,
      }
      await saveAuctionState(roomId, soldState)

      // Move to next player
      const nextState = await moveToNextPlayerInternal(roomId, getAuctionState, saveAuctionState)
      return { action: 'SOLD_AND_NEXT', state: nextState }
    } else {
      // No bidder or no bid — player is UNSOLD
      const unsoldState = await unsoldCurrentPlayerInternal(roomId, state, getAuctionState, saveAuctionState)

      // Move to next player
      const nextState = unsoldState ? await moveToNextPlayerInternal(roomId, getAuctionState, saveAuctionState) : null
      return { action: 'UNSOLD_AND_NEXT', state: nextState }
    }
  })
}

// ─── Internal helpers (no mutex — caller must already hold the mutex) ──

async function moveToNextPlayerInternal(
  roomId: string,
  getAuctionState: (roomId: string) => Promise<AuctionState | null>,
  saveAuctionState: (roomId: string, state: AuctionState) => Promise<void>,
): Promise<AuctionState | null> {
  const state = await getAuctionState(roomId)
  if (!state) {
    return null
  }

  const nextPlayerId = await redis.lpop(`auction:${roomId}:pool`)

  if (!nextPlayerId) {
    // Pool is exhausted
    const unsoldLen = await redis.llen(`auction:${roomId}:unsold`)
    if (unsoldLen > 0) {
      // Switch to re-auction mode
      const newState: AuctionState = {
        ...state,
        phase: 'RE_AUCTION',
        currentPlayerId: null,
        currentBid: 0,
        currentBidderId: null,
        timerEndsAt: null,
        version: state.version + 1,
      }
      await saveAuctionState(roomId, newState)
      return newState
    }
    // Everything exhausted — auction finished
    const newState: AuctionState = {
      ...state,
      phase: 'FINISHED',
      currentPlayerId: null,
      currentBid: 0,
      currentBidderId: null,
      timerEndsAt: null,
      version: state.version + 1,
    }
    await saveAuctionState(roomId, newState)
    return newState
  }

  const newState: AuctionState = {
    ...state,
    phase: 'PLAYER_LIVE',
    currentPlayerId: nextPlayerId,
    currentBid: 0,
    currentBidderId: null,
    timerEndsAt: new Date(Date.now() + AUCTION_DEFAULT_TIMER_SECONDS * 1000).toISOString(),
    version: state.version + 1,
  }
  await saveAuctionState(roomId, newState)
  return newState
}

async function unsoldCurrentPlayerInternal(
  roomId: string,
  state: AuctionState,
  getAuctionState: (roomId: string) => Promise<AuctionState | null>,
  saveAuctionState: (roomId: string, state: AuctionState) => Promise<void>,
): Promise<AuctionState | null> {
  const currentPlayerId = state.currentPlayerId
  const newState: AuctionState = {
    ...state,
    phase: 'UNSOLD',
    currentPlayerId: null,
    currentBid: 0,
    currentBidderId: null,
    timerEndsAt: null,
    version: state.version + 1,
  }

  if (currentPlayerId) {
    await redis.rpush(`auction:${roomId}:unsold`, currentPlayerId)
  }

  await saveAuctionState(roomId, newState)
  return newState
}

// ─── Start Re-Auction ────────────────────────────────────

export async function startReAuction(
  roomId: string,
  getAuctionState: (roomId: string) => Promise<AuctionState | null>,
  saveAuctionState: (roomId: string, state: AuctionState) => Promise<void>,
): Promise<AuctionState | null> {
  return runWithLock(roomId, async () => {
    const state = await getAuctionState(roomId)
    if (!state || state.phase !== 'RE_AUCTION') {
      return null
    }

    // Move all unsold to pool queue in Redis
    const unsoldPlayers = await redis.lrange(`auction:${roomId}:unsold`, 0, -1)
    if (unsoldPlayers.length > 0) {
      await redis.rpush(`auction:${roomId}:pool`, ...unsoldPlayers)
      await redis.del(`auction:${roomId}:unsold`)
    }

    const newState: AuctionState = {
      ...state,
      phase: 'PLAYER_LIVE',
      currentPlayerId: null,
      currentBid: 0,
      currentBidderId: null,
      timerEndsAt: null,
      version: state.version + 1,
    }

    await saveAuctionState(roomId, newState)
    return newState
  })
}
