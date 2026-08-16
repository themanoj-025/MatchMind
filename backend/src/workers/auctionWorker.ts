import { Worker, Job, type ConnectionOptions } from 'bullmq'
import { redis } from '../lib/redis'
import { container } from '../container'
import type { ExtendedPrismaClient } from '../lib/prisma'
import logger from '../utils/logger'
import { checkAuctionTimer, type AuctionState } from '../services/auctionEngine'
import { app } from '../app'
import { ConcurrencyError } from '../errors/DomainError'
import { RoomStatus } from '@matchmind/shared-types'

const QUEUE_NAME = 'auction-timer'
const prisma: ExtendedPrismaClient = container.resolve('prisma')

function auctionTimerDeps(prisma: ExtendedPrismaClient) {
  return {
    getState: async (id: string) => {
      const state = await prisma.auctionState.findUnique({ where: { roomId: id } })
      return state ? (state as AuctionState) : null
    },
    saveState: async (id: string, state: AuctionState) => {
      const expectedVersion = state.version - 1
      const updateRes = await prisma.auctionState.updateMany({
        where: { roomId: id, version: expectedVersion },
        data: { ...state },
      })
      if (updateRes.count === 0) {
        throw new ConcurrencyError()
      }
    },
    deductBudget: async (id: string, userId: string, amount: number) => {
      await prisma.roomMember.update({
        where: { roomId_userId: { roomId: id, userId } },
        data: { remainingBudget: { increment: -amount } },
      })
    },
    addRosterEntry: async (entry: { roomId: string; userId: string; playerId: string; soldPrice: number }) => {
      await prisma.roster.create({
        data: {
          ...entry,
          acquiredAt: new Date().toISOString(),
          isCaptain: false,
          isViceCaptain: false,
        },
      })
    },
  }
}

interface AuctionBroadcast {
  event: string
  payload: Record<string, unknown>
  logEvent: string
  markFinished?: boolean
}

function soldPayload(
  stateBefore: { currentPlayerId?: string | null; currentBidderId?: string | null; currentBid?: number } | null,
  roomId: string,
): Record<string, unknown> {
  return {
    roomId,
    playerId: stateBefore?.currentPlayerId,
    buyerId: stateBefore?.currentBidderId,
    price: stateBefore?.currentBid,
  }
}

function unsoldPayload(
  stateBefore: { currentPlayerId?: string | null } | null,
  roomId: string,
): Record<string, unknown> {
  return { roomId, playerId: stateBefore?.currentPlayerId }
}

function broadcastFor(
  result: { action: string; state: AuctionState | null },
  stateBefore: { currentPlayerId?: string | null; currentBidderId?: string | null; currentBid?: number } | null,
  roomId: string,
): AuctionBroadcast | null {
  if (result.action === 'SOLD_AND_NEXT') {
    return { event: 'PLAYER_SOLD', payload: soldPayload(stateBefore, roomId), logEvent: 'auction.timer_sold' }
  }
  if (result.action === 'UNSOLD_AND_NEXT') {
    return { event: 'PLAYER_UNSOLD', payload: unsoldPayload(stateBefore, roomId), logEvent: 'auction.timer_unsold' }
  }
  if (result.action === 'FINISHED' || result.state?.phase === 'FINISHED') {
    return { event: 'AUCTION_FINISHED', payload: { roomId }, logEvent: 'auction.timer_finished', markFinished: true }
  }
  if (result.state?.phase === 'RE_AUCTION') {
    return { event: 'RE_AUCTION_STARTED', payload: { roomId }, logEvent: 'auction.timer_re_auction' }
  }
  return null
}

async function rescheduleTimerIfNeeded(roomId: string, result: { action: string; state: AuctionState | null }): Promise<void> {
  // If a new player is live, we need to schedule a new timer
  if (result.state?.phase !== 'PLAYER_LIVE' || !result.state.timerEndsAt) {
    return
  }
  const delay = new Date(result.state.timerEndsAt).getTime() - Date.now()
  if (delay <= 0) {
    return
  }
  const { auctionQueue } = await import('../lib/queue')
  await auctionQueue.add('timerTick', { roomId }, { delay })
  logger.info({ event: 'auction.timer.rescheduled', roomId, delayMs: delay }, 'Scheduled next timer')
}

async function broadcastAuctionResult(
  io_instance: import('socket.io').Server,
  prisma: ExtendedPrismaClient,
  roomId: string,
  result: { action: string; state: AuctionState | null },
  stateBefore: { currentPlayerId?: string | null; currentBidderId?: string | null; currentBid?: number } | null,
): Promise<void> {
  // We broadcast based on the result action
  const broadcast = broadcastFor(result, stateBefore, roomId)
  if (broadcast) {
    if (broadcast.markFinished) {
      await prisma.room.update({ where: { id: roomId }, data: { status: RoomStatus.FINISHED } })
    }
    io_instance.to(`room:${roomId}`).emit(broadcast.event, broadcast.payload)
    logger.info({ event: broadcast.logEvent, roomId })
  }
  await rescheduleTimerIfNeeded(roomId, result)
}

export const auctionWorker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const { roomId } = job.data
    logger.info({ event: 'worker.auction.started', roomId, jobId: job.id }, 'Evaluating auction timer')

    try {
      // Execute the timer check logic that was previously in the polling loop
      const deps = auctionTimerDeps(prisma)
      const result = await checkAuctionTimer(roomId, deps.getState, deps.saveState, deps.deductBudget, deps.addRosterEntry)

      if (result) {
        // Retrieve socket.io instance
        const io_instance = app.get('io') as import('socket.io').Server | undefined
        if (!io_instance) {
          logger.error({ event: 'worker.auction.no_io', roomId }, 'Socket.io instance not found on app')
          return
        }

        const room = await prisma.room.findUnique({ where: { id: roomId } })
        if (!room) {return}

        const stateBefore = await prisma.auctionState.findUnique({ where: { roomId } })
        await broadcastAuctionResult(io_instance, prisma, roomId, result, stateBefore)
      }

    } catch (err: unknown) {
      const isConcurrency =
        err instanceof ConcurrencyError ||
        (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === 'CONCURRENCY_ERROR')
      if (isConcurrency) {
        logger.warn({ event: 'worker.auction.concurrency', roomId }, 'Concurrency conflict in worker, ignoring')
      } else {
        logger.error({ event: 'worker.auction.error', roomId, err: (err as Error).message }, 'Auction worker error')
        throw err
      }
    }
  },
  {
    connection: redis as unknown as ConnectionOptions,
  },
)

auctionWorker.on('failed', (job, err) => {
  logger.error(
    { event: 'worker.auction.job_failed', jobId: job?.id, err: (err as Error).message },
    'Auction timer job failed',
  )
})

logger.info({ event: 'worker.auction.started', queue: QUEUE_NAME }, 'Auction worker listening for jobs')
