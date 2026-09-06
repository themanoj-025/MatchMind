import { Queue, QueueOptions } from 'bullmq'
import { env } from '../config/env'
import logger from '../utils/logger'

const redisOptions = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null, // Required by bullmq
}

export const auctionQueueOptions: QueueOptions = {
  connection: redisOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
}

// Queue for auction timer expiries
export const auctionQueue = new Queue('auction-timer', auctionQueueOptions)

auctionQueue.on('error', (err) => {
  logger.error({ event: 'queue.auction.error', err: (err as Error).message })
})

/**
 * Deterministic BullMQ jobId for an auction timer tick.
 *
 * The add-job script no-ops when a job with the same custom jobId still
 * exists (verified: `EXISTS jobIdKey` → handleDuplicatedJob in
 * addStandardJob-9.lua). Keying on (roomId, timerEndsAt) makes repeated
 * schedules idempotent: every bid on the same timer window reuses one job
 * instead of piling up duplicate delayed jobs, and the startup recovery
 * sweep can re-arm a lost timer without double-firing a live one.
 */
export function auctionTimerJobId(roomId: string, timerEndsAt: string): string {
  return `timer:${roomId}:${timerEndsAt}`
}

export async function scheduleAuctionTimer(roomId: string, timerEndsAt: string) {
  const delay = new Date(timerEndsAt).getTime() - Date.now()
  if (delay > 0) {
    await auctionQueue.add('timerTick', { roomId }, {
      delay,
      jobId: auctionTimerJobId(roomId, timerEndsAt),
    })
  }
}
