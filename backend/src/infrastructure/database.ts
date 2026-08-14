import { prisma } from '../lib/prisma'
import logger from '../utils/logger'

export let dbInitialized = false

export async function initDatabase(): Promise<void> {
  try {
    await prisma.$connect()
    dbInitialized = true
    logger.info({ event: 'database.initialized', dbType: 'postgres' }, 'MatchMind Postgres Database initialized')
  } catch (err: any) {
    logger.error(
      { event: 'database.initialization_failed', err: err instanceof Error ? (err as Error).message : String(err) },
      'Failed to connect to Postgres Database',
    )
    process.exit(1)
  }
}
