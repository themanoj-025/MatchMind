/**
 * Auction Engine Tests — MatchMind
 *
 * Tests the core bidding/timer/anti-snipe FSM:
 * - `requiredIncrement()` boundaries
 * - `validateBudgetForRemainingSlots()` — various roster scenarios
 * - `processBid()` — happy path, rejections, anti-snipe, concurrency
 * - FSM transitions: SOLD → next, UNSOLD → next, re-auction, finished
 * - `checkAuctionTimer()` — timer auto-expiry
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redis } from '../lib/redis'

vi.mock('../lib/redis', () => ({
  redis: {
    rpush: vi.fn(),
    lpop: vi.fn(),
    llen: vi.fn(),
    lrange: vi.fn(),
    del: vi.fn(),
  },
}))
import { requiredIncrement, validateBudgetForRemainingSlots, AuctionState } from './auctionEngine'

// ─── Mock dependencies ──────────────────────────────────

const DEFAULT_ROSTER_RULES = { GK: 2, DEF: 5, MID: 5, FWD: 3, total: 15 }

function createMockState(overrides: Partial<AuctionState> = {}): AuctionState {
  return {
    roomId: 'room-1',
    phase: 'PLAYER_LIVE',
    currentPlayerId: 'player-1',
    currentBid: 0,
    currentBidderId: null,
    timerEndsAt: new Date(Date.now() + 15000).toISOString(),
    poolQueue: ['player-2', 'player-3', 'player-4'],
    unsoldPlayerIds: [],
    version: 1,
    ...overrides,
  }
}

function createMockRoom(overrides: any = {}) {
  return {
    id: 'room-1',
    tournamentId: 'fifa-wc-2026',
    hostId: 'host-1',
    name: 'Test Room',
    status: 'DRAFTING',
    rosterRules: DEFAULT_ROSTER_RULES,
    totalBudget: 500,
    ...overrides,
  }
}

function createMockPlayer(overrides: any = {}) {
  return {
    id: 'player-1',
    tournamentId: 'fifa-wc-2026',
    name: 'Test Player',
    position: 'MID',
    basePrice: 10,
    ...overrides,
  }
}

function createMockMember(overrides: any = {}) {
  return {
    roomId: 'room-1',
    userId: 'user-1',
    remainingBudget: 500,
    role: 'member',
    ...overrides,
  }
}

// ─── requiredIncrement ───────────────────────────────────

describe('requiredIncrement()', () => {
  it('returns 5 for bids below 50', () => {
    expect(requiredIncrement(0)).toBe(5)
    expect(requiredIncrement(10)).toBe(5)
    expect(requiredIncrement(49)).toBe(5)
  })

  it('returns 10 for bids between 50 and 99', () => {
    expect(requiredIncrement(50)).toBe(10)
    expect(requiredIncrement(75)).toBe(10)
    expect(requiredIncrement(99)).toBe(10)
  })

  it('returns 25 for bids between 100 and 199', () => {
    expect(requiredIncrement(100)).toBe(25)
    expect(requiredIncrement(150)).toBe(25)
    expect(requiredIncrement(199)).toBe(25)
  })

  it('returns 50 for bids of 200 or more', () => {
    expect(requiredIncrement(200)).toBe(50)
    expect(requiredIncrement(500)).toBe(50)
    expect(requiredIncrement(1000)).toBe(50)
  })
})

// ─── validateBudgetForRemainingSlots ─────────────────────

describe('validateBudgetForRemainingSlots()', () => {
  it('accepts a bid when enough budget and slots remain', () => {
    const result = validateBudgetForRemainingSlots(
      500, // remainingBudget
      50, // bidAmount
      'MID', // playerPosition
      DEFAULT_ROSTER_RULES,
      [], // currentRoster (empty — all slots open)
      [], // playerPool
    )
    expect(result.valid).toBe(true)
  })

  it('rejects a bid when the position slot is full', () => {
    // Fill all MID slots (5)
    const roster = Array.from({ length: 5 }, (_, i) => ({
      position: 'MID' as const,
      soldPrice: 20 + i * 5,
    }))

    const result = validateBudgetForRemainingSlots(500, 50, 'MID', DEFAULT_ROSTER_RULES, roster, [])
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('ROSTER_SLOT_FULL')
    expect(result.reason).toContain('MID')
  })

  it('rejects a bid that would leave insufficient budget for remaining slots', () => {
    // User has 70 budget, bids 60, leaving 10 — but needs 50 for remaining 10 slots at 5 each
    const result = validateBudgetForRemainingSlots(
      70, // remainingBudget (can afford 60+10=70)
      60, // bidAmount (leaves 10)
      'FWD', // playerPosition
      DEFAULT_ROSTER_RULES,
      [], // empty roster — 15 slots total, 1 being filled = 14 remaining
      [],
      5, // minPlayerPrice
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('INSUFFICIENT_BUDGET')
    // After bidding 60, 10 remains. Need 14 * 5 = 70 reserve. 10 < 70
    expect(result.reason).toContain('70 reserve')
  })

  it('accepts a bid when exactly enough budget for remaining slots', () => {
    // User has 135, bids 50, leaving 85. Need 17 remaining slots * 5 = 85. 85 >= 85 ✓
    const result = validateBudgetForRemainingSlots(135, 50, 'MID', DEFAULT_ROSTER_RULES, [], [], 5)
    expect(result.valid).toBe(true)
  })

  it('allows the last slot to be filled regardless of remaining budget', () => {
    // Fill 14 of 15 slots — 1 DEF slot remaining, bidding on DEF
    // 2 GK + 4 DEF + 5 MID + 3 FWD = 14 filled
    const roster = [
      ...Array.from({ length: 2 }, (_, i) => ({ position: 'GK' as const, soldPrice: 10 + i * 5 })),
      ...Array.from({ length: 4 }, (_, i) => ({ position: 'DEF' as const, soldPrice: 10 + i * 5 })),
      ...Array.from({ length: 5 }, (_, i) => ({ position: 'MID' as const, soldPrice: 10 + i * 5 })),
      ...Array.from({ length: 3 }, (_, i) => ({ position: 'FWD' as const, soldPrice: 10 + i * 5 })),
    ]
    // 1 DEF slot remains. Bidding full budget: 90 - 90 = 0. No reserve needed since 0 remaining slots after this bid.
    const result = validateBudgetForRemainingSlots(90, 90, 'DEF', DEFAULT_ROSTER_RULES, roster, [], 5)
    expect(result.valid).toBe(true)
  })

  it('handles GK position correctly', () => {
    const roster = [{ position: 'GK' as const, soldPrice: 10 }]
    // 2 GK slots total, 1 filled, can add another
    const result = validateBudgetForRemainingSlots(500, 30, 'GK', DEFAULT_ROSTER_RULES, roster, [])
    expect(result.valid).toBe(true)

    // Now fill both GK slots
    const fullRoster = [...roster, { position: 'GK' as const, soldPrice: 15 }]
    const result2 = validateBudgetForRemainingSlots(500, 30, 'GK', DEFAULT_ROSTER_RULES, fullRoster, [])
    expect(result2.valid).toBe(false)
    expect(result2.reason).toContain('ROSTER_SLOT_FULL')
  })
})

// ─── processBid ─────────────────────────────────────

describe('processBid() — unit tests with mocked DB accessors', () => {
  let state: AuctionState

  beforeEach(() => {
    state = createMockState()
  })

  it('accepts a valid first bid', async () => {
    const { processBid } = await import('./auctionEngine')

    const mockGetRoom = vi.fn().mockResolvedValue(createMockRoom())
    const mockGetPlayer = vi.fn().mockResolvedValue(createMockPlayer())
    const mockGetMember = vi.fn().mockResolvedValue(createMockMember())
    const mockGetRoster = vi.fn().mockResolvedValue([])
    const mockGetAuctionState = vi.fn().mockResolvedValue(state)
    const mockSaveState = vi.fn().mockResolvedValue(undefined)
    const mockSaveBid = vi.fn().mockResolvedValue(undefined)
    const mockGetPool = vi.fn().mockResolvedValue([])

    const result = await processBid(
      { roomId: 'room-1', playerId: 'player-1', amount: 10, userId: 'user-1', expectedVersion: 1 },
      mockGetRoom,
      mockGetPlayer,
      mockGetMember,
      mockGetRoster,
      mockGetAuctionState,
      mockSaveState,
      mockSaveBid,
      mockGetPool,
    )

    expect(result.accepted).toBe(true)
    expect(result.newState).toBeDefined()
    expect(result.newState!.currentBid).toBe(10)
    expect(result.newState!.currentBidderId).toBe('user-1')
    expect(result.newState!.version).toBe(2)
    expect(mockSaveState).toHaveBeenCalledTimes(1)
    expect(mockSaveBid).toHaveBeenCalledTimes(1)
  })

  it('rejects bid when state version mismatch', async () => {
    const { processBid } = await import('./auctionEngine')

    const result = await processBid(
      { roomId: 'room-1', playerId: 'player-1', amount: 10, userId: 'user-1', expectedVersion: 999 },
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn().mockResolvedValue(state),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    )
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('BID_STALE_STATE')
  })

  it('rejects bid when room is not DRAFTING', async () => {
    const { processBid } = await import('./auctionEngine')

    const result = await processBid(
      { roomId: 'room-1', playerId: 'player-1', amount: 10, userId: 'user-1', expectedVersion: 1 },
      vi.fn().mockResolvedValue(createMockRoom({ status: 'LOBBY' })),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn().mockResolvedValue(state),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    )
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('ROOM_NOT_ACTIVE')
  })

  it('rejects bid when no player is live', async () => {
    const { processBid } = await import('./auctionEngine')

    const idleState = createMockState({ phase: 'IDLE', currentPlayerId: null })
    const result = await processBid(
      { roomId: 'room-1', playerId: 'player-1', amount: 10, userId: 'user-1', expectedVersion: 1 },
      vi.fn().mockResolvedValue(createMockRoom()),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn().mockResolvedValue(idleState),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    )
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('NO_PLAYER_LIVE')
  })

  it('rejects bid for wrong player under hammer', async () => {
    const { processBid } = await import('./auctionEngine')

    const result = await processBid(
      { roomId: 'room-1', playerId: 'player-999', amount: 10, userId: 'user-1', expectedVersion: 1 },
      vi.fn().mockResolvedValue(createMockRoom()),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn().mockResolvedValue(state),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    )
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('WRONG_PLAYER_UNDER_HAMMER')
  })

  it('rejects bid when bidder is not a room member', async () => {
    const { processBid } = await import('./auctionEngine')

    const result = await processBid(
      { roomId: 'room-1', playerId: 'player-1', amount: 10, userId: 'non-member', expectedVersion: 1 },
      vi.fn().mockResolvedValue(createMockRoom()),
      vi.fn(),
      vi.fn().mockResolvedValue(null), // member not found
      vi.fn(),
      vi.fn().mockResolvedValue(state),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    )
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('NOT_ROOM_MEMBER')
  })

  it('rejects bid below minimum increment', async () => {
    const { processBid } = await import('./auctionEngine')

    // Current bid is 0, min increment is 5, so min bid is 5
    // Bidder tries 3 which is below min
    const result = await processBid(
      { roomId: 'room-1', playerId: 'player-1', amount: 3, userId: 'user-1', expectedVersion: 1 },
      vi.fn().mockResolvedValue(createMockRoom()),
      vi.fn().mockResolvedValue(createMockPlayer()),
      vi.fn().mockResolvedValue(createMockMember()),
      vi.fn().mockResolvedValue([]),
      vi.fn().mockResolvedValue(state),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    )
    expect(result.accepted).toBe(false)
    expect(result.reason).toContain('BID_TOO_LOW')
  })

  it('rejects bid when player not found', async () => {
    const { processBid } = await import('./auctionEngine')

    const result = await processBid(
      { roomId: 'room-1', playerId: 'player-1', amount: 10, userId: 'user-1', expectedVersion: 1 },
      vi.fn().mockResolvedValue(createMockRoom()),
      vi.fn().mockResolvedValue(null), // player not found
      vi.fn().mockResolvedValue(createMockMember()),
      vi.fn().mockResolvedValue([]),
      vi.fn().mockResolvedValue(state),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    )
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('PLAYER_NOT_FOUND')
  })

  it('accepts bid and applies anti-snipe timer reset when placed in last 5 seconds', async () => {
    const { processBid } = await import('./auctionEngine')

    // Timer ends 2 seconds from now (within anti-snipe window of 5s)
    const closeToExpiry = new Date(Date.now() + 2000).toISOString()
    const nearExpiryState = createMockState({ timerEndsAt: closeToExpiry })

    const mockGetRoom = vi.fn().mockResolvedValue(createMockRoom())
    const mockGetPlayer = vi.fn().mockResolvedValue(createMockPlayer())
    const mockGetMember = vi.fn().mockResolvedValue(createMockMember())
    const mockGetRoster = vi.fn().mockResolvedValue([])
    const mockGetAuctionState = vi.fn().mockResolvedValue(nearExpiryState)
    const mockSaveState = vi.fn().mockResolvedValue(undefined)
    const mockSaveBid = vi.fn().mockResolvedValue(undefined)
    const mockGetPool = vi.fn().mockResolvedValue([])

    const result = await processBid(
      { roomId: 'room-1', playerId: 'player-1', amount: 10, userId: 'user-1', expectedVersion: 1 },
      mockGetRoom,
      mockGetPlayer,
      mockGetMember,
      mockGetRoster,
      mockGetAuctionState,
      mockSaveState,
      mockSaveBid,
      mockGetPool,
    )

    expect(result.accepted).toBe(true)
    expect(result.newState).toBeDefined()
    // The new timer should be ~10 seconds from now (anti-snipe reset)
    const newTimerEnd = new Date(result.newState!.timerEndsAt!).getTime()
    const now = Date.now()
    const remainingSeconds = (newTimerEnd - now) / 1000
    // Allow 2s tolerance for test execution time
    expect(remainingSeconds).toBeGreaterThanOrEqual(8)
    expect(remainingSeconds).toBeLessThanOrEqual(12)
  })
})

// ─── FSM Transitions ─────────────────────────────────

describe('FSM transitions', () => {
  it('sellCurrentPlayer transitions from PLAYER_LIVE to SOLD', async () => {
    const { sellCurrentPlayer } = await import('./auctionEngine')
    const state = createMockState()

    const result = await sellCurrentPlayer(
      'room-1',
      vi.fn().mockResolvedValue(state),
      vi.fn().mockResolvedValue(undefined),
    )

    expect(result).not.toBeNull()
    expect(result!.phase).toBe('SOLD')
    expect(result!.version).toBe(2)
  })

  it('sellCurrentPlayer returns null if not in PLAYER_LIVE', async () => {
    const { sellCurrentPlayer } = await import('./auctionEngine')
    const idleState = createMockState({ phase: 'IDLE' })

    const result = await sellCurrentPlayer('room-1', vi.fn().mockResolvedValue(idleState), vi.fn())
    expect(result).toBeNull()
  })

  it('unsoldCurrentPlayer transitions to UNSOLD and adds to unsold pool', async () => {
    const { unsoldCurrentPlayer } = await import('./auctionEngine')
    const state = createMockState({ currentPlayerId: 'player-1' })

    const result = await unsoldCurrentPlayer(
      'room-1',
      vi.fn().mockResolvedValue(state),
      vi.fn().mockResolvedValue(undefined),
    )

    expect(result).not.toBeNull()
    expect(result!.phase).toBe('UNSOLD')
    expect(result!.currentPlayerId).toBeNull()
    expect(redis.rpush).toHaveBeenCalledWith('auction:room-1:unsold', 'player-1')
    expect(result!.version).toBe(2)
  })

  it('moveToNextPlayer advances to next player in queue', async () => {
    const { moveToNextPlayer } = await import('./auctionEngine')
    const state = createMockState()
    vi.mocked(redis.lpop).mockResolvedValueOnce('player-2')

    const result = await moveToNextPlayer(
      'room-1',
      vi.fn().mockResolvedValue(state),
      vi.fn().mockResolvedValue(undefined),
    )

    expect(result).not.toBeNull()
    expect(result!.phase).toBe('PLAYER_LIVE')
    expect(result!.currentPlayerId).toBe('player-2')
    expect(redis.lpop).toHaveBeenCalledWith('auction:room-1:pool')
    expect(result!.currentBid).toBe(0)
    expect(result!.timerEndsAt).not.toBeNull()
    expect(result!.version).toBe(2)
  })

  it('moveToNextPlayer transitions to RE_AUCTION when pool exhausted but unsold remain', async () => {
    const { moveToNextPlayer } = await import('./auctionEngine')
    const state = createMockState()
    vi.mocked(redis.lpop).mockResolvedValueOnce(null)
    vi.mocked(redis.llen).mockResolvedValueOnce(2)

    const result = await moveToNextPlayer(
      'room-1',
      vi.fn().mockResolvedValue(state),
      vi.fn().mockResolvedValue(undefined),
    )

    expect(result).not.toBeNull()
    expect(result!.phase).toBe('RE_AUCTION')
    expect(result!.currentPlayerId).toBeNull()
  })

  it('moveToNextPlayer transitions to FINISHED when everything exhausted', async () => {
    const { moveToNextPlayer } = await import('./auctionEngine')
    const state = createMockState()
    vi.mocked(redis.lpop).mockResolvedValueOnce(null)
    vi.mocked(redis.llen).mockResolvedValueOnce(0)

    const result = await moveToNextPlayer(
      'room-1',
      vi.fn().mockResolvedValue(state),
      vi.fn().mockResolvedValue(undefined),
    )

    expect(result).not.toBeNull()
    expect(result!.phase).toBe('FINISHED')
    expect(result!.currentPlayerId).toBeNull()
  })

  it('startReAuction moves unsold pool into PLAYER_LIVE queue', async () => {
    const { startReAuction } = await import('./auctionEngine')
    const state = createMockState({ phase: 'RE_AUCTION' })
    vi.mocked(redis.lrange).mockResolvedValueOnce(['player-2', 'player-5', 'player-8'])

    const result = await startReAuction(
      'room-1',
      vi.fn().mockResolvedValue(state),
      vi.fn().mockResolvedValue(undefined),
    )

    expect(result).not.toBeNull()
    expect(result!.phase).toBe('PLAYER_LIVE')
    expect(redis.rpush).toHaveBeenCalledWith('auction:room-1:pool', 'player-2', 'player-5', 'player-8')
    expect(redis.del).toHaveBeenCalledWith('auction:room-1:unsold')
    expect(result!.currentPlayerId).toBeNull() // host must trigger NEXT_PLAYER
    expect(result!.currentBid).toBe(0)
    expect(result!.currentBidderId).toBeNull()
    expect(result!.timerEndsAt).toBeNull()
  })
})

// ─── checkAuctionTimer ─────────────────────────────

describe('checkAuctionTimer()', () => {
  it('returns null when timer is still running', async () => {
    const { checkAuctionTimer } = await import('./auctionEngine')
    const state = createMockState({
      timerEndsAt: new Date(Date.now() + 30000).toISOString(), // 30s remaining
    })

    const result = await checkAuctionTimer('room-1', vi.fn().mockResolvedValue(state), vi.fn(), vi.fn(), vi.fn())

    expect(result).toBeNull()
  })

  it('returns null when not in PLAYER_LIVE phase', async () => {
    const { checkAuctionTimer } = await import('./auctionEngine')
    const state = createMockState({ phase: 'IDLE' })

    const result = await checkAuctionTimer('room-1', vi.fn().mockResolvedValue(state), vi.fn(), vi.fn(), vi.fn())
    expect(result).toBeNull()
  })

  it('resolves with SOLD_AND_NEXT when timer expired with a bidder', async () => {
    const { checkAuctionTimer } = await import('./auctionEngine')
    const expiredState = createMockState({
      currentBid: 50,
      currentBidderId: 'user-1',
      currentPlayerId: 'player-1',
      timerEndsAt: new Date(Date.now() - 1000).toISOString(), // 1s ago (expired)
    })
    vi.mocked(redis.lpop).mockResolvedValueOnce('player-2')

    const deductBudget = vi.fn().mockResolvedValue(undefined)
    const createRoster = vi.fn().mockResolvedValue(undefined)
    const saveState = vi.fn().mockResolvedValue(undefined)
    const getState = vi.fn().mockResolvedValue(expiredState)

    const result = await checkAuctionTimer('room-1', getState, saveState, deductBudget, createRoster)

    expect(result).not.toBeNull()
    expect(result!.action).toBe('SOLD_AND_NEXT')
    expect(deductBudget).toHaveBeenCalledWith('room-1', 'user-1', 50)
    expect(createRoster).toHaveBeenCalledWith({
      roomId: 'room-1',
      userId: 'user-1',
      playerId: 'player-1',
      soldPrice: 50,
    })
  })

  it('resolves with UNSOLD_AND_NEXT when timer expired with no bidder', async () => {
    const { checkAuctionTimer } = await import('./auctionEngine')
    const expiredState = createMockState({
      currentBid: 0,
      currentBidderId: null,
      currentPlayerId: 'player-1',
      timerEndsAt: new Date(Date.now() - 1000).toISOString(),
    })
    vi.mocked(redis.lpop).mockResolvedValueOnce('player-2')

    const result = await checkAuctionTimer(
      'room-1',
      vi.fn().mockResolvedValue(expiredState),
      vi.fn().mockResolvedValue(undefined),
      vi.fn(),
      vi.fn(),
    )

    expect(result).not.toBeNull()
    expect(result!.action).toBe('UNSOLD_AND_NEXT')
    // Next player should be from poolQueue
    expect(result!.state?.currentPlayerId).toBe('player-2')
  })

  it('returns FINISHED when timer expired and all pools exhausted', async () => {
    const { checkAuctionTimer } = await import('./auctionEngine')
    const expiredState = createMockState({
      currentBid: 50,
      currentBidderId: 'user-1',
      currentPlayerId: 'player-1',
      timerEndsAt: new Date(Date.now() - 1000).toISOString(),
    })
    vi.mocked(redis.lpop).mockResolvedValueOnce(null)
    vi.mocked(redis.llen).mockResolvedValueOnce(0)

    const deductBudget = vi.fn().mockResolvedValue(undefined)
    const createRoster = vi.fn().mockResolvedValue(undefined)

    const result = await checkAuctionTimer(
      'room-1',
      vi.fn().mockResolvedValue(expiredState),
      vi.fn().mockResolvedValue(undefined),
      deductBudget,
      createRoster,
    )

    // Should sell player-1, then discover no more players → FINISHED
    expect(result).not.toBeNull()
    expect(deductBudget).toHaveBeenCalled()
    expect(createRoster).toHaveBeenCalled()
    expect(result!.state?.phase).toBe('FINISHED')
  })
})
