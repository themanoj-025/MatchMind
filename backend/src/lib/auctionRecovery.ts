/**
 * Auction timer recovery — MatchMind
 *
 * Auction state lives in Postgres (AuctionState rows) but the thing that
 * *fires* a timer expiry is a BullMQ delayed job in Redis. If Redis loses
 * that job (flush, eviction, failover, or a crash between
 * saveAuctionTimerEndsAt and scheduleAuctionTimer), an auction stuck in
 * PLAYER_LIVE never resolves: checkAuctionTimer is only ever invoked by a
 * job, and its own guard (`timerEndsAt > now → null`) no-ops forever.
 *
 * recoverAuctionTimers() runs once at boot: it re-arms a delayed timerTick
 * job for every auction still in PLAYER_LIVE with a timer in the future.
 * It reuses auctionTimerJobId(roomId, timerEndsAt), so:
 *   - jobs that survived the restart are deduped (add-script no-ops), and
 *   - jobs that were lost are recreated.
 * Either way, exactly one live timer per (room, timer window) exists.
 *
 * Safety: recovery only schedules future-dated timers. If timerEndsAt is
 * already in the past, we do NOT schedule — scheduleAuctionTimer would
 * ignore it, and firing a tick for an already-expired timer is the
 * worker's normal path anyway once any job exists; a stuck expired timer
 * is surfaced loudly via logs instead (host can force-advance via
 * HOST_ACTION, and a future sweep can enqueue immediate expiry jobs).
 */
import { env } from '../config/env'
import { RoomStatus } from '@matchmind/shared-types'
import logger from '../utils/logger'
import { auctionQueue, auctionTimerJobId } from './queue'

export interface RecoverableAuction {
  roomId: string
  timerEndsAt: Date | null
}

/** Query live auctions: defaults to Prisma, injectable for tests. */
export type RecoveryLoader = () => Promise<RecoverableAuction[]>

/**
 * Build the production loader (Prisma). Async so boot code awaits it once;
 * unit tests inject their own loader and never touch the database.
 */
export async function defaultRecoveryLoader(): Promise<RecoveryLoader> {
  const { prisma } = await import('../lib/prisma')
  return async (): Promise<RecoverableAuction[]> =>
    prisma.auctionState.findMany({
      where: {
        phase: 'PLAYER_LIVE',
        timerEndsAt: { not: null },
        room: { status: { in: [RoomStatus.DRAFTING, RoomStatus.ACTIVE] } },
      },
      select: { roomId: true, timerEndsAt: true },
    })
}

/** True when a room's timer should be re-armed at boot. */
export function isRecoverable(a: RecoverableAuction, now: number = Date.now()): boolean {
  if (!a.timerEndsAt) {return false}
  return new Date(a.timerEndsAt).getTime() > now
}

/** Minimum delay before a recovered timer fires (avoid hot-loop on clock skew). */
export const RECOVERY_MIN_DELAY_MS = 1000

export interface RecoveryResult {
  roomsChecked: number
  timersReArmed: number
  timersExpiredSkipped: number
}

/** Re-arm BullMQ timers for every live auction. Called once from server.ts. */
export async function recoverAuctionTimers(
  loader: RecoveryLoader,
  now: number = Date.now(),
): Promise<RecoveryResult> {
  let auctions: RecoverableAuction[]
  try {
    auctions = await loader()
  } catch (err) {
    logger.error(
      { event: 'auction.recovery.load_failed', err: (err as Error).message },
      'Auction recovery could not load live auctions — timers NOT re-armed',
    )
    return { roomsChecked: 0, timersReArmed: 0, timersExpiredSkipped: 0 }
  }

  let reArmed = 0
  let expiredSkipped = 0
  for (const a of auctions) {
    if (!isRecoverable(a, now)) {
      expiredSkipped++
      logger.warn(
        { event: 'auction.recovery.expired_timer', roomId: a.roomId, timerEndsAt: a.timerEndsAt },
        'Live auction has an expired timer at boot — NOT auto-resolved; force-advance via HOST_ACTION if stuck',
      )
      continue
    }
    const timerEndsAt = new Date(a.timerEndsAt!).toISOString()
    const delay = Math.max(RECOVERY_MIN_DELAY_MS, new Date(timerEndsAt).getTime() - now)
    try {
      await auctionQueue.add('timerTick', { roomId: a.roomId }, {
        delay,
        jobId: auctionTimerJobId(a.roomId, timerEndsAt),
      })
      reArmed++
    } catch (err) {
      logger.error(
        { event: 'auction.recovery.rearm_failed', roomId: a.roomId, err: (err as Error).message },
        'Failed to re-arm auction timer',
      )
    }
  }

  if (auctions.length > 0) {
    logger.info(
      { event: 'auction.recovery.done', roomsChecked: auctions.length, timersReArmed: reArmed, timersExpiredSkipped: expiredSkipped },
      'Auction timer recovery sweep complete',
    )
  }
  return { roomsChecked: auctions.length, timersReArmed: reArmed, timersExpiredSkipped: expiredSkipped }
}

/** Guard so tests (or multiple imports) never start the sweep twice. */
let recoveryStarted = false

/** Fire-and-forget boot hook used by server.ts. */
export async function startAuctionRecovery(): Promise<void> {
  if (recoveryStarted) {return}
  recoveryStarted = true
  if (process.env.NODE_ENV === 'test' && !env.REDIS_URL) {
    logger.warn({ event: 'auction.recovery.skipped_test' }, 'Auction recovery skipped (test env, no Redis)')
    return
  }
  try {
    await recoverAuctionTimers(await defaultRecoveryLoader())
  } catch (err: unknown) {
    logger.error(
      { event: 'auction.recovery.unhandled', err: (err as Error).message },
      'Unhandled error in auction timer recovery',
    )
  }
}
