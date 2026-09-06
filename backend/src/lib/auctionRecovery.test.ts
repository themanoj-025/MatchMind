/**
 * Auction Timer Recovery Tests
 *
 * Covers the boot-time sweep that re-arms BullMQ timerTick jobs for
 * auctions that were PLAYER_LIVE before a (re)start:
 * - deterministic timer jobIds
 * - recoverability classification (future vs expired vs missing timer)
 * - re-arm behavior: correct jobId + delay, deduped by BullMQ
 * - resilience: loader failure and per-room queue failure don't throw
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./queue', () => ({
  auctionQueue: { add: vi.fn().mockResolvedValue({}) },
  auctionTimerJobId: (roomId: string, timerEndsAt: string) => `timer:${roomId}:${timerEndsAt}`,
}))

import { auctionQueue, auctionTimerJobId } from './queue'
import {
  recoverAuctionTimers,
  isRecoverable,
  RECOVERY_MIN_DELAY_MS,
  type RecoverableAuction,
} from './auctionRecovery'

const addMock = vi.mocked(auctionQueue.add)

function futureIso(msFromNow: number, now: number = Date.now()): string {
  return new Date(now + msFromNow).toISOString()
}

function auction(overrides: Partial<RecoverableAuction> = {}, now: number = Date.now()): RecoverableAuction {
  return { roomId: 'room-1', timerEndsAt: new Date(now + 10_000), ...overrides }
}

describe('auctionTimerJobId (via queue module)', () => {
  it('is deterministic per (roomId, timerEndsAt)', () => {
    const a = auctionTimerJobId('room-1', '2026-01-01T00:00:00.000Z')
    const b = auctionTimerJobId('room-1', '2026-01-01T00:00:00.000Z')
    expect(a).toBe(b)
    expect(a).toBe('timer:room-1:2026-01-01T00:00:00.000Z')
  })
})

describe('isRecoverable', () => {
  const now = 1_000_000

  it('true for a future timer', () => {
    expect(isRecoverable({ roomId: 'r', timerEndsAt: new Date(now + 1) }, now)).toBe(true)
  })

  it('false for an expired timer', () => {
    expect(isRecoverable({ roomId: 'r', timerEndsAt: new Date(now - 1) }, now)).toBe(false)
  })

  it('false for a missing timer', () => {
    expect(isRecoverable({ roomId: 'r', timerEndsAt: null }, now)).toBe(false)
  })
})

describe('recoverAuctionTimers', () => {
  beforeEach(() => {
    addMock.mockClear()
    addMock.mockResolvedValue({} as never)
  })

  it('re-arms future timers with the deterministic jobId and correct delay', async () => {
    const now = Date.now()
    const result = await recoverAuctionTimers(
      async () => [auction({ roomId: 'r-1', timerEndsAt: new Date(now + 30_000) }, now)],
      now,
    )

    expect(result).toEqual({ roomsChecked: 1, timersReArmed: 1, timersExpiredSkipped: 0 })
    expect(addMock).toHaveBeenCalledTimes(1)
    const [name, data, opts] = addMock.mock.calls[0]!
    expect(name).toBe('timerTick')
    expect(data).toEqual({ roomId: 'r-1' })
    expect(opts?.jobId).toBe(`timer:r-1:${new Date(now + 30_000).toISOString()}`)
    // Delay ≈ 30s (≥ min delay, within jitter bounds)
    expect(opts?.delay).toBeGreaterThanOrEqual(RECOVERY_MIN_DELAY_MS)
    expect(opts?.delay).toBeLessThanOrEqual(30_000)
  })

  it('skips expired timers without scheduling', async () => {
    const now = Date.now()
    const result = await recoverAuctionTimers(
      async () => [
        auction({ roomId: 'r-past', timerEndsAt: new Date(now - 5_000) }, now),
        auction({ roomId: 'r-null', timerEndsAt: null }, now),
      ],
      now,
    )

    expect(result.roomsChecked).toBe(2)
    expect(result.timersReArmed).toBe(0)
    expect(result.timersExpiredSkipped).toBe(2)
    expect(addMock).not.toHaveBeenCalled()
  })

  it('mixed batch re-arms only future timers', async () => {
    const now = Date.now()
    const result = await recoverAuctionTimers(
      async () => [
        auction({ roomId: 'r-live', timerEndsAt: new Date(now + 10_000) }, now),
        auction({ roomId: 'r-old', timerEndsAt: new Date(now - 10_000) }, now),
      ],
      now,
    )

    expect(result.timersReArmed).toBe(1)
    expect(result.timersExpiredSkipped).toBe(1)
    expect(addMock).toHaveBeenCalledTimes(1)
    expect(addMock.mock.calls[0]![2]?.jobId).toContain('r-live')
  })

  it('clamps sub-second delays to RECOVERY_MIN_DELAY_MS', async () => {
    const now = Date.now()
    await recoverAuctionTimers(
      async () => [auction({ roomId: 'r-soon', timerEndsAt: new Date(now + 50) }, now)],
      now,
    )
    expect(addMock.mock.calls[0]![2]?.delay).toBe(RECOVERY_MIN_DELAY_MS)
  })

  it('does not throw when the loader fails', async () => {
    const result = await recoverAuctionTimers(async () => {
      throw new Error('db down')
    })
    expect(result).toEqual({ roomsChecked: 0, timersReArmed: 0, timersExpiredSkipped: 0 })
    expect(addMock).not.toHaveBeenCalled()
  })

  it('continues re-arming remaining rooms when one add() fails', async () => {
    const now = Date.now()
    addMock.mockImplementationOnce(() => Promise.reject(new Error('redis down')))
    const result = await recoverAuctionTimers(
      async () => [
        auction({ roomId: 'r-fail', timerEndsAt: new Date(now + 10_000) }, now),
        auction({ roomId: 'r-ok', timerEndsAt: new Date(now + 20_000) }, now),
      ],
      now,
    )
    expect(result.timersReArmed).toBe(1)
    expect(addMock.mock.calls[1]![1]).toEqual({ roomId: 'r-ok' })
  })

  it('logs nothing and checks nothing for an empty room set', async () => {
    const result = await recoverAuctionTimers(async () => [])
    expect(result).toEqual({ roomsChecked: 0, timersReArmed: 0, timersExpiredSkipped: 0 })
    expect(addMock).not.toHaveBeenCalled()
  })
})
