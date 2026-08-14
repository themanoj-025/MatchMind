const fs = require('fs')
const path = require('path')

const schemaPath = path.join(__dirname, 'backend', 'prisma', 'schema.prisma')
let schema = fs.readFileSync(schemaPath, 'utf8')

const enumDefinitions = `
enum UserRole {
  USER
  ADMIN
}

enum UserTier {
  BRONZE
  SILVER
  GOLD
  PLATINUM
}

enum TournamentStatus {
  UPCOMING
  ACTIVE
  COMPLETED
}

enum PlayerPosition {
  GK
  DEF
  MID
  FWD
}

enum RoomStatus {
  LOBBY
  DRAFTING
  ACTIVE
  FINISHED
}

enum RoomMemberRole {
  member
  admin
}

enum AuctionPhase {
  IDLE
  NOMINATING
  BIDDING
  RESOLVED
}

enum FixtureStatus {
  SCHEDULED
  IN_PLAY
  PAUSED
  FINISHED
}

enum PredictionStatus {
  PENDING
  CORRECT
  INCORRECT
}

enum ChatMessageType {
  user
  system
}

enum ReportStatus {
  PENDING
  REVIEWED
  RESOLVED
}

enum DraftTicketStatus {
  AVAILABLE
  USED
}

enum DraftSessionStatus {
  ACTIVE
  COMPLETED
  CANCELLED
}

enum DraftRunResultStatus {
  IN_PROGRESS
  COMPLETED
  ELIMINATED
}
`

// Insert enums at the top before models
schema = schema.replace('model User {', enumDefinitions + '\nmodel User {')

// Replace field types
schema = schema.replace(/role\s+String\s+@default\("USER"\)/g, 'role UserRole @default(USER)')
schema = schema.replace(/tier\s+String\s+@default\("BRONZE"\)/g, 'tier UserTier @default(BRONZE)')
schema = schema.replace(/status\s+String/g, (match, offset, full) => {
  if (full.substring(offset - 20, offset).includes('Tournament')) return 'status TournamentStatus'
  if (full.substring(offset - 20, offset).includes('Subscription')) return 'status String // Needs SubscriptionStatus enum'
  if (full.substring(offset - 20, offset).includes('DraftSession')) return 'status DraftSessionStatus'
  if (full.substring(offset - 20, offset).includes('DraftRunResult')) return 'status DraftRunResultStatus'
  return match
})

schema = schema.replace(/status\s+String\s+@default\("LOBBY"\)/g, 'status RoomStatus @default(LOBBY)')
schema = schema.replace(/role\s+String\s+@default\("member"\)/g, 'role RoomMemberRole @default(member)')
schema = schema.replace(/phase\s+String\s+@default\("IDLE"\)/g, 'phase AuctionPhase @default(IDLE)')
schema = schema.replace(/status\s+String\s+@default\("SCHEDULED"\)/g, 'status FixtureStatus @default(SCHEDULED)')
schema = schema.replace(/status\s+String\s+@default\("PENDING"\)/g, (match, offset, full) => {
  if (full.substring(offset - 40, offset).includes('Prediction')) return 'status PredictionStatus @default(PENDING)'
  if (full.substring(offset - 40, offset).includes('Report')) return 'status ReportStatus @default(PENDING)'
  return match
})
schema = schema.replace(/type\s+String\s+@default\("user"\)/g, 'type ChatMessageType @default(user)')
schema = schema.replace(/status\s+String\s+@default\("AVAILABLE"\)/g, 'status DraftTicketStatus @default(AVAILABLE)')

schema = schema.replace(/position\s+String/g, (match, offset, full) => {
  if (full.substring(offset - 30, offset).includes('Player')) return 'position PlayerPosition'
  if (full.substring(offset - 30, offset).includes('DraftPick')) return 'position PlayerPosition'
  return match
})


fs.writeFileSync(schemaPath, schema, 'utf8')
console.log('Schema updated successfully.')
