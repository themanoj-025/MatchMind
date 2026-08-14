import { Worker, Job } from 'bullmq'
import { redis } from '../lib/redis'
import { container } from '../container'
import { PrismaClient } from '@prisma/client'
import logger from '../utils/logger'
import { checkAuctionTimer } from '../services/auctionEngine'
import { app } from '../app'
import { ConcurrencyError } from '../errors/DomainError'
import { RoomStatus } from '@matchmind/shared-types'

const QUEUE_NAME = 'auction-timer'
const prisma: PrismaClient = container.resolve('prisma')

export const auctionWorker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const { roomId } = job.data
    logger.info({ event: 'worker.auction.started', roomId, jobId: job.id }, 'Evaluating auction timer')

    try {
      // Execute the timer check logic that was previously in the polling loop
      const result = await checkAuctionTimer(
        roomId,
  // @ts-ignore
        async (id: string) => {
          const state = await prisma.auctionState.findUnique({ where: { roomId: id } })
          return state ? (state as unknown) : null
        },
        async (id: string, state: any) => {
          const expectedVersion = state.version - 1
          const updateRes = await prisma.auctionState.updateMany({
            where: { roomId: id, version: expectedVersion },
            data: { ...state },
          })
          if (updateRes.count === 0) {
            throw new ConcurrencyError()
          }
        },
        async (id: string, userId: string, amount: number) => {
          await prisma.roomMember.update({
            where: { roomId_userId: { roomId: id, userId } },
            data: { remainingBudget: { increment: -amount } },
          })
        },
        async (entry: { roomId: string; userId: string; playerId: string; soldPrice: number }) => {
          await prisma.roster.create({
            data: {
              ...entry,
              acquiredAt: new Date().toISOString(),
              isCaptain: false,
              isViceCaptain: false,
            },
          })
        },
      )

      if (result) {
        // Retrieve socket.io instance
        const io_instance: any = app.get('io')
        if (!io_instance) {
          logger.error({ event: 'worker.auction.no_io', roomId }, 'Socket.io instance not found on app')
          return
        }

        const room = await prisma.room.findUnique({ where: { id: roomId } })
        if (!room) return

        const stateBefore = await prisma.auctionState.findUnique({ where: { roomId } })
        
        // We broadcast based on the result action
        if (result.action === 'SOLD_AND_NEXT') {
          io_instance.to(`room:${roomId}`).emit('PLAYER_SOLD', {
            roomId: roomId,
            playerId: stateBefore?.currentPlayerId,
            buyerId: stateBefore?.currentBidderId,
            price: stateBefore?.currentBid,
          })
          logger.info({ event: 'auction.timer_sold', roomId })
        } else if (result.action === 'UNSOLD_AND_NEXT') {
          io_instance.to(`room:${roomId}`).emit('PLAYER_UNSOLD', {
            roomId: roomId,
            playerId: stateBefore?.currentPlayerId,
          })
          logger.info({ event: 'auction.timer_unsold', roomId })
        } else if (result.action === 'FINISHED' || result.state?.phase === 'FINISHED') {
          await prisma.room.update({ where: { id: roomId }, data: { status: RoomStatus.FINISHED } })
          io_instance.to(`room:${roomId}`).emit('AUCTION_FINISHED', { roomId })
          logger.info({ event: 'auction.timer_finished', roomId })
        } else if (result.state?.phase === 'RE_AUCTION') {
          io_instance
            .to(`room:${roomId}`)
            .emit('RE_AUCTION_STARTED', { roomId })
          logger.info({ event: 'auction.timer_re_auction', roomId })
        }
        
        // If a new player is live, we need to schedule a new timer
        if (result.state?.phase === 'PLAYER_LIVE' && result.state.timerEndsAt) {
          const delay = new Date(result.state.timerEndsAt).getTime() - Date.now()
          if (delay > 0) {
            const { auctionQueue } = await import('../lib/queue')
            await auctionQueue.add('timerTick', { roomId }, { delay })
            logger.info({ event: 'auction.timer.rescheduled', roomId, delayMs: delay }, 'Scheduled next timer')
          }
        }
      }

      return { success: true }
    } catch (err: any) {
  // @ts-ignore
      if (err instanceof ConcurrencyError || err.code === 'CONCURRENCY_ERROR') {
        logger.warn({ event: 'worker.auction.concurrency', roomId }, 'Concurrency conflict in worker, ignoring')
      } else {
        logger.error({ event: 'worker.auction.error', roomId, err: (err as Error).message }, 'Auction worker error')
        throw err
      }
    }
  },
  {
  // @ts-ignore
    connection: redis as unknown,
  }
)

auctionWorker.on('failed', (job, err) => {
  logger.error({ event: 'worker.auction.job_failed', jobId: job?.id, err: (err as Error).message }, 'Auction timer job failed')
})

logger.info({ event: 'worker.auction.started', queue: QUEUE_NAME }, 'Auction worker listening for jobs')
