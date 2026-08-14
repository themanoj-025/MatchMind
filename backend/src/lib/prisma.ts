import { PrismaClient } from '@prisma/client'
import { uuidv7 } from 'uuidv7'
import { env } from '../config/env'

const dbUrl = new URL(env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test')
if (!dbUrl.searchParams.has('connection_limit')) {
  dbUrl.searchParams.set('connection_limit', '20')
}
if (!dbUrl.searchParams.has('pool_timeout')) {
  dbUrl.searchParams.set('pool_timeout', '10')
}
if (!dbUrl.searchParams.has('statement_timeout')) {
  dbUrl.searchParams.set('statement_timeout', '10000')
} // 10s

const rawPrisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl.toString(),
    },
  },
})

import logger from '../utils/logger'

// Prisma Client Extension for UUIDv7 and Soft Deletes
const prismaWithSoftDelete = rawPrisma.$extends({
  query: {
    $allModels: {
      async create({ model, operation, args, query }: any) {
        // Inject UUIDv7 for ID if not provided
        if (!args.data.id) {
          args.data.id = uuidv7()
        }
        return query(args)
      },
      async createMany({ model, operation, args, query }: any) {
        if (Array.isArray(args.data)) {
          for (const item of args.data) {
            if (!item.id) {
              item.id = uuidv7()
            }
          }
        } else {
          if (!args.data.id) {
            args.data.id = uuidv7()
          }
        }
        return query(args)
      },
    },
    user: {
      async delete({ model, operation, args, query }: any) {
        return rawPrisma.user.update({
          where: args.where,
          data: { deletedAt: new Date() },
        }) as unknown
      },
      async deleteMany({ model, operation, args, query }: any) {
        return rawPrisma.user.updateMany({
          where: args.where,
          data: { deletedAt: new Date() },
        }) as unknown
      },
      async findMany({ model, operation, args, query }: any) {
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async count({ model, operation, args, query }: any) {
        args = args || {}
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async findFirst({ model, operation, args, query }: any) {
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async findUnique({ model, operation, args, query }: any) {
        // findUnique requires unique criteria, we can't just inject deletedAt: null into where.
        // Instead, we convert to findFirst if we want to filter by deletedAt.
        // However, standard soft delete practice often skips this for findUnique if finding by ID.
        // For strictness:
        const result = await query(args)
        if (result && (result as any).deletedAt) {
          return null
        }
        return result
      },
    },
    room: {
      async delete({ model, operation, args, query }: any) {
        return rawPrisma.room.update({
          where: args.where,
          data: { deletedAt: new Date() },
        }) as unknown
      },
      async deleteMany({ model, operation, args, query }: any) {
        return rawPrisma.room.updateMany({
          where: args.where,
          data: { deletedAt: new Date() },
        }) as unknown
      },
      async findMany({ model, operation, args, query }: any) {
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async count({ model, operation, args, query }: any) {
        args = args || {}
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async findFirst({ model, operation, args, query }: any) {
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async findUnique({ model, operation, args, query }: any) {
        const result = await query(args)
        if (result && (result as any).deletedAt) {
          return null
        }
        return result
      },
    },
    tournament: {
      async delete({ model, operation, args, query }: any) {
        return rawPrisma.tournament.update({
          where: args.where,
          data: { deletedAt: new Date() },
        }) as unknown
      },
      async deleteMany({ model, operation, args, query }: any) {
        return rawPrisma.tournament.updateMany({
          where: args.where,
          data: { deletedAt: new Date() },
        }) as unknown
      },
      async findMany({ model, operation, args, query }: any) {
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async count({ model, operation, args, query }: any) {
        args = args || {}
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async findFirst({ model, operation, args, query }: any) {
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async findUnique({ model, operation, args, query }: any) {
        const result = await query(args)
        if (result && (result as any).deletedAt) {
          return null
        }
        return result
      },
    },
    chatMessage: {
      async delete({ model, operation, args, query }: any) {
        return rawPrisma.chatMessage.update({
          where: args.where,
          data: { deletedAt: new Date(), isDeleted: true },
        }) as unknown
      },
      async deleteMany({ model, operation, args, query }: any) {
        return rawPrisma.chatMessage.updateMany({
          where: args.where,
          data: { deletedAt: new Date(), isDeleted: true },
        }) as unknown
      },
      async findMany({ model, operation, args, query }: any) {
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async count({ model, operation, args, query }: any) {
        args = args || {}
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async findFirst({ model, operation, args, query }: any) {
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async findUnique({ model, operation, args, query }: any) {
        const result = await query(args)
        if (result && (result as any).deletedAt) {
          return null
        }
        return result
      },
    },
  },
})

export const prisma = prismaWithSoftDelete.$extends({
  query: {
    $allModels: {
      async findMany({ model, operation, args, query }: any) {
        const take = args?.take
        if (take === undefined || take > 500) {
          logger.warn({ event: 'db.unbounded_query', model, take }, `Unbounded findMany query on ${model}`)
        }
        return query(args)
      },
    },
  },
})

export type ExtendedPrismaClient = typeof prisma
