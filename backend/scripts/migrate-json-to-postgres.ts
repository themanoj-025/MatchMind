import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import logger from '../src/utils/logger'

const prisma = new PrismaClient()
const DATA_DIR = path.join(__dirname, '..', 'src', 'data')

const MODELS_IN_ORDER = [
  'user',
  'tournament',
  'player',
  'room',
  'roomMember',
  'bid',
  'roster',
  'auctionState',
  'fixture',
  'playerMatchStat',
  'prediction',
  'follow',
  'chatMessage',
  'notification',
  'report',
  'adminLog',
  'subscription',
  'session',
  'starredPlayer',
  'leaderboardSnapshot',
  'achievement',
  'userAchievement',
  'draftSession',
  'draftPick',
  'draftRunResult',
  'draftTicket',
  'draftRewardsCatalog',
  'playerRarityCache',
  'roomTemplate',
  'fantasyPointsLedger',
]

async function migrateData() {
  logger.info({ event: 'migration.start' }, 'Starting JSON to PostgreSQL data migration...')

  try {
    for (const modelName of MODELS_IN_ORDER) {
      const filePath = path.join(DATA_DIR, `${modelName}.json`)

      if (fs.existsSync(filePath)) {
        const rawData = fs.readFileSync(filePath, 'utf-8')
        const records = JSON.parse(rawData)

        if (records.length > 0) {
          logger.info(
            { event: 'migration.model_start', model: modelName, count: records.length },
            `Migrating ${modelName}...`,
          )

          // Using Prisma's model delegation dynamically
          const modelDelegate = (prisma as any)[modelName]
          if (modelDelegate) {
            // We use upsert or createMany? createMany is safer but doesn't ignore duplicates on SQLite.
            // On Postgres, createMany(skipDuplicates) exists.
            try {
              await modelDelegate.createMany({
                data: records,
                skipDuplicates: true,
              })
              logger.info({ event: 'migration.model_success', model: modelName }, `Successfully migrated ${modelName}`)
            } catch (err: any) {
              logger.error(
                { event: 'migration.model_error', model: modelName, error: err.message },
                `Failed to migrate ${modelName}`,
              )
            }
          }
        }
      }
    }

    logger.info({ event: 'migration.complete' }, 'Migration complete!')
  } catch (err: any) {
    logger.error({ event: 'migration.fatal_error', error: err.message }, 'Fatal error during migration')
  } finally {
    await prisma.$disconnect()
  }
}

migrateData()
