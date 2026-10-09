import type { AwilixContainer } from 'awilix'
import type { Redis } from 'ioredis'
import type { ExtendedPrismaClient } from '../lib/prisma'
import type { PrismaPredictionRepository, PrismaUserRepository } from '../repositories'
import type { AuthService } from '../services/authService'
import type { CacheService } from '../services/cacheService'
import type { DraftAppService } from '../services/draftAppService'
import type { MatchService } from '../services/matchService'
import type { MessageService } from '../services/messageService'
import type { RoomService } from '../services/roomService'
import type { StripeService } from '../services/stripeService'
import type { UserService } from '../services/userService'

/**
 * Everything registered in the Awilix container (see container.ts).
 * `container.cradle.<name>` resolves to these exact types at compile time.
 */
export interface Cradle {
  prisma: ExtendedPrismaClient
  redis: Redis
  userRepository: PrismaUserRepository
  predictionRepository: PrismaPredictionRepository
  authService: AuthService
  userService: UserService
  roomService: RoomService
  matchService: MatchService
  draftService: DraftAppService
  cacheService: CacheService
  stripeService: StripeService
  messageService: MessageService
}

declare global {
  namespace Express {
    interface Request {
      /** Per-request Awilix scope, attached by the `scopePerRequest` middleware. */
      container: AwilixContainer<Cradle>
      /** Set by `authenticateToken`; undefined on unauthenticated routes. */
      userId?: string
    }
  }
}
