/** Auction room interfaces and async processing logic. */

import type { AuctionState, BidRequest, BidResult } from './auction_types'
export interface AuctionRoomLike {
  status: string
}

export interface AuctionPlayerLike {
  position: string
}

export interface AuctionMemberLike {
  remainingBudget: number
}

export interface AuctionRosterEntryLike {
  position?: string
  soldPrice: number
}

export interface AuctionBidRecord {
  roomId: string
  playerId: string
  userId: string
  amount: number
  timestamp: string
  version: number
}

export interface AuctionPlayerPoolEntryLike {
  id: string
  position: string
  basePrice: number
}

export interface AuctionDeps {
  getRoom: (roomId: string) => Promise<AuctionRoomLike | null>
  getPlayer: (playerId: string) => Promise<AuctionPlayerLike | null>
  getRoomMember: (roomId: string, userId: string) => Promise<AuctionMemberLike | null>
  getRoster: (roomId: string, userId: string) => Promise<AuctionRosterEntryLike[]>
  getAuctionState: (roomId: string) => Promise<AuctionState | null>
  saveAuctionState: (roomId: string, state: AuctionState) => Promise<void>
  saveBid: (bid: AuctionBidRecord) => Promise<void>
  getPlayerPool: (roomId: string) => Promise<AuctionPlayerPoolEntryLike[]>
}

type BidValidation =
  | { ok: false; reason: string }
  | { ok: true; state: AuctionState; member: AuctionMemberLike; player: AuctionPlayerLike }

/** Validate the auction/room state and optimistic concurrency (steps 1–3). */
async function validateAuctionContext(
  bid: BidRequest,
  deps: AuctionDeps,
): Promise<{ ok: false; reason: string } | { ok: true; state: AuctionState }> {
  const { getRoom, getAuctionState } = deps

  // 1. Re-read state fresh from DB (never trust in-memory cache)
  const state = await getAuctionState(bid.roomId)
  if (!state) {
    return { ok: false, reason: 'ROOM_NOT_FOUND' }
  }

  // 2. Optimistic concurrency check
  if (state.version !== bid.expectedVersion) {
    return { ok: false, reason: 'BID_STALE_STATE' }
  }

  // 3. Validate room state
  const room = await getRoom(bid.roomId)
  if (!room || (room.status !== 'DRAFTING' && room.status !== 'LIVE')) {
    return { ok: false, reason: 'ROOM_NOT_ACTIVE' }
  }
  if (state.phase !== 'PLAYER_LIVE') {
    return { ok: false, reason: 'NO_PLAYER_LIVE' }
  }
  if (state.currentPlayerId !== bid.playerId) {
    return { ok: false, reason: 'WRONG_PLAYER_UNDER_HAMMER' }
  }

  return { ok: true, state }
}

/** Validate the bidder, minimum bid amount, and pool membership (steps 4–6). */
async function validateBidder(
  bid: BidRequest,
  deps: AuctionDeps,
  state: AuctionState,
): Promise<{ ok: false; reason: string } | { ok: true; member: AuctionMemberLike; player: AuctionPlayerLike }> {
  const { getPlayer, getRoomMember } = deps

  // 4. Validate bidder is active member
  const member = await getRoomMember(bid.roomId, bid.userId)
  if (!member) {
    return { ok: false, reason: 'NOT_ROOM_MEMBER' }
  }

  // 5. Validate minimum bid amount
  const minBid = state.currentBid + requiredIncrement(state.currentBid)
  if (bid.amount < minBid) {
    return { ok: false, reason: `BID_TOO_LOW: Minimum bid is ${minBid}` }
  }

  // 6. Validate bidder has an entry in the pool
  const player = await getPlayer(bid.playerId)
  if (!player) {
    return { ok: false, reason: 'PLAYER_NOT_FOUND' }
  }

  return { ok: true, member, player }
}

/** Validate a bid against the current auction state (steps 1–6 of processBid). */
async function validateBid(bid: BidRequest, deps: AuctionDeps): Promise<BidValidation> {
  const context = await validateAuctionContext(bid, deps)
  if (!context.ok) {
    return context
  }
  const bidder = await validateBidder(bid, deps, context.state)
  if (!bidder.ok) {
    return bidder
  }
  return { ok: true, state: context.state, member: bidder.member, player: bidder.player }
}

export async function processBid(bid: BidRequest, deps: AuctionDeps): Promise<BidResult> {
  return runWithLock(bid.roomId, async () => {
    const validation = await validateBid(bid, deps)
    if (!validation.ok) {
      return { accepted: false, reason: validation.reason }
    }
    // 7. Apply bid — update state and persist
    return applyBid(deps, bid, validation.state, validation.member, validation.player)
  })
}

function nextTimerEnd(state: AuctionState, now: Date): Date {
  const timerMs = state.timerEndsAt ? new Date(state.timerEndsAt).getTime() - now.getTime() : 0
  const timerSeconds = timerMs / 1000
  // Anti-snipe: if bid is placed in last anti-snipe seconds, reset timer
  if (timerSeconds <= AUCTION_ANTI_SNIPE_SECONDS) {
    return new Date(now.getTime() + AUCTION_ANTI_SNIPE_RESET_SECONDS * 1000)
  }
  return new Date(now.getTime() + AUCTION_DEFAULT_TIMER_SECONDS * 1000)
}

async function applyBid(
  deps: AuctionDeps,
  bid: BidRequest,
  state: AuctionState,
  member: AuctionMemberLike,
  player: AuctionPlayerLike,
): Promise<BidResult> {
  const roster = await deps.getRoster(bid.roomId, bid.userId)
  const budgetValidation = validateBudgetForRemainingSlots({
    remainingBudget: member.remainingBudget,
    bidAmount: bid.amount,
    playerPosition: player.position,
    rosterRules: DEFAULT_ROSTER_RULES,
    currentRoster: roster.map((r) => ({ position: r.position || player.position, soldPrice: r.soldPrice })),
  })
  if (!budgetValidation.valid) {
    return { accepted: false, reason: budgetValidation.reason! }
  }

  const now = new Date()
  const newTimerEnd = nextTimerEnd(state, now)
  const newState: AuctionState = {
    ...state,
    currentBid: bid.amount,
    currentBidderId: bid.userId,
    timerEndsAt: newTimerEnd.toISOString(),
    version: state.version + 1,
  }

  // Save updated state
  await deps.saveAuctionState(bid.roomId, newState)

  // Save bid record (append-only audit log)
  await deps.saveBid({
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
