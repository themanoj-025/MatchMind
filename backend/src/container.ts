import { createContainer, asClass, asValue, InjectionMode } from 'awilix'
import { prisma } from './lib/prisma'
import { AuthService } from './services/authService'
import { UserService } from './services/userService'
import { RoomService } from './services/roomService'
import { MatchService } from './services/matchService'
import { DraftAppService } from './services/draftAppService'
import { StripeService } from './services/stripeService'
import { MessageService } from './services/messageService'
import { CacheService } from './services/cacheService'

import { createRepositories } from './repositories'
import { redis } from './lib/redis'

// Initialize container with PROXY mode (classic DI behavior)
export const container = createContainer({
  injectionMode: InjectionMode.PROXY
})

// Register Prisma and Redis
container.register({
  prisma: asValue(prisma),
  redis: asValue(redis)
})

// Create repositories
const repositories = createRepositories(prisma)

// Register Repositories
container.register({
  userRepository: asValue(repositories.userRepository),
  // tournamentRepository: asValue(repositories.tournamentRepository),
  // roomRepository: asValue(repositories.roomRepository),
  // bidRepository: asValue(repositories.bidRepository),
  // rosterRepository: asValue(repositories.rosterRepository),
  // auctionStateRepository: asValue(repositories.auctionStateRepository),
  // chatMessageRepository: asValue(repositories.chatMessageRepository),
  predictionRepository: asValue(repositories.predictionRepository),
})

// Register Services
container.register({
  authService: asClass(AuthService).singleton(),
  userService: asClass(UserService).singleton(),
  roomService: asClass(RoomService).singleton(),
  matchService: asClass(MatchService).singleton(),
  draftService: asClass(DraftAppService).singleton(),

  cacheService: asClass(CacheService).singleton(),
  stripeService: asClass(StripeService).singleton(),
  messageService: asClass(MessageService).singleton(),
})
