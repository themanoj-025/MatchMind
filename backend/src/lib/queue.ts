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

export async function scheduleAuctionTimer(roomId: string, timerEndsAt: string) {
  const delay = new Date(timerEndsAt).getTime() - Date.now()
  if (delay > 0) {
    await auctionQueue.add('timerTick', { roomId }, { delay })
  }
}
