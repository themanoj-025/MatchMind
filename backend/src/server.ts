import { env } from './config/env'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { prisma } from './lib/prisma'
import logger from './utils/logger'
import { app } from './app'
import { configurePassport } from './config/passport'
import { setupSocket } from './socket'
import { createAdapter } from '@socket.io/redis-adapter'
import { redis } from './lib/redis'
import { errorHandler } from './middleware/errorHandler'
import { initDatabase } from './infrastructure/database'
import { healthRouter } from './infrastructure/health'
import { setupGracefulShutdown } from './infrastructure/shutdown'
import './workers'

// Initialize Passport strategies
configurePassport(prisma)

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  adapter: createAdapter(redis, redis.duplicate())
})

// Make prisma and io accessible in app context
app.set('prisma', prisma)
app.set('io', io)

// Mount health check
app.use('/api/health', healthRouter)

// Error handler MUST be last
app.use(errorHandler)

// Setup Socket.io
setupSocket(io, prisma)

const PORT = parseInt(env.PORT || '5000', 10)

// Start database then server
initDatabase().then(() => {
  httpServer.listen(PORT, () => {
    logger.info(
      { event: 'server.start', port: PORT, env: env.NODE_ENV || 'development' },
      `MatchMind API server running on port ${PORT}`,
    )
  })
})

// Setup Graceful Shutdown
setupGracefulShutdown(httpServer)

