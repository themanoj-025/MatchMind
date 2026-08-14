import logger from '../utils/logger'
import { prisma } from '../lib/prisma'
import { Server } from 'http'

export function setupGracefulShutdown(httpServer: Server): void {
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ event: 'server.shutdown', signal }, `${signal} received. Starting graceful shutdown...`)

    const forceExit = setTimeout(() => {
      logger.error({ event: 'server.shutdown_timeout' }, 'Graceful shutdown timed out after 10s. Force exiting.')
      process.exit(1)
    }, 10000)
    forceExit.unref()

    try {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()))
      logger.info({ event: 'server.http_closed' }, 'HTTP server closed')
      await prisma.$disconnect()
      logger.info({ event: 'server.db_closed' }, 'MatchMind Database persisted and closed')
    } catch (err: any) {
      logger.error(
        { event: 'server.shutdown_error', err: err instanceof Error ? (err as Error).message : String(err) },
        'Error during graceful shutdown'
      )
    }

    clearTimeout(forceExit)
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}
