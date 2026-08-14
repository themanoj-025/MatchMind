# MatchMind Schema Discovery

This document outlines the reverse-engineered schema from the legacy `jsonDb.ts` and `types.ts` definitions. This serves as the blueprint for `prisma/schema.prisma`.

## Core Entities

### User

- **Fields**: id (String, UUID), username (String, Unique), email (String, Unique), emailVerified (Boolean), passwordHash (String?), displayName (String?), avatar (String?), bannerImage (String?), bio (String?), countryCode (String?), role (String), tier (String), totalPoints (Int), weeklyPoints (Int), globalRank (Int?), predAccuracy (Float), totalPredictions (Int), correctPredictions (Int), streakCurrent (Int), streakBest (Int), isPro (Boolean), proExpiresAt (DateTime?), createdAt (DateTime), updatedAt (DateTime), lastActiveAt (DateTime?)
- **Relations**:
  - `notifications` (HasMany -> Notification)
  - `chatMessages` (HasMany -> ChatMessage)
  - `reports` (HasMany -> Report)
  - `following` (HasMany -> Follow as follower)
  - `followers` (HasMany -> Follow as following)
  - `subscriptions` (HasMany -> Subscription)
  - `userAchievements` (HasMany -> UserAchievement)
  - `sessions` (HasMany -> Session)
  - `roomMembers` (HasMany -> RoomMember)
  - `rosters` (HasMany -> Roster)
  - `bids` (HasMany -> Bid)

### Tournament

- **Fields**: id (String, UUID), name (String), shortName (String), status (String), confederation (String), gender (String), format (String), teamCount (Int), squadSize (Int), launchPhase (Int), startDate (DateTime?), endDate (DateTime?)

### Player

- **Fields**: id (String, UUID), tournamentId (String), name (String), club (String), nationality (String), position (String), basePrice (Float), photoUrl (String?), rarityTier (String?), isEligibleForIcon (Boolean)
- **Relations**:
  - `rosters` (HasMany -> Roster)
  - `starredBy` (HasMany -> StarredPlayer)

### Room

- **Fields**: id (String, UUID), tournamentId (String), hostId (String), name (String), inviteCode (String), totalBudget (Float), status (String), createdAt (DateTime)
- **Relations**:
  - `members` (HasMany -> RoomMember)
  - `auctionState` (HasOne -> AuctionState)
  - `bids` (HasMany -> Bid)
  - `rosters` (HasMany -> Roster)

### RoomMember

- **Fields**: id (String, UUID), roomId (String), userId (String), role (String), remainingBudget (Float), isReady (Boolean)
- **Relations**:
  - `room` (BelongsTo -> Room)
  - `user` (BelongsTo -> User)

### Bid

- **Fields**: id (String, UUID), roomId (String), playerId (String), userId (String), amount (Float), timestamp (DateTime), version (Int)
- **Relations**:
  - `room` (BelongsTo -> Room)
  - `user` (BelongsTo -> User)

### Roster (RosterEntry)

- **Fields**: id (String, UUID), roomId (String), userId (String), playerId (String), soldPrice (Float), acquiredAt (DateTime), isCaptain (Boolean), isViceCaptain (Boolean)
- **Relations**:
  - `room` (BelongsTo -> Room)
  - `user` (BelongsTo -> User)
  - `player` (BelongsTo -> Player)

### AuctionState

- **Fields**: id (String, UUID), roomId (String, Unique), phase (String), currentPlayerId (String?), currentBid (Float), currentBidderId (String?), timerEndsAt (DateTime?), poolQueue (String[] / JSON), unsoldPlayerIds (String[] / JSON), version (Int)
- **Relations**:
  - `room` (BelongsTo -> Room)

### Fixture / Match

- **Fields**: id (String, UUID), tournamentId (String), stage (String), round (Int?), homeTeamId (String), awayTeamId (String), homeTeam (String), awayTeam (String), venueId (String?), homeScore (Int?), awayScore (Int?), status (String), scheduledAt (DateTime), kickoffAt (DateTime?)
- **Relations**:
  - `playerMatchStats` (HasMany -> PlayerMatchStat)

### PlayerMatchStat

- **Fields**: id (String, UUID), fixtureId (String), playerId (String), minutesPlayed (Int), goals (Int), assists (Int), cleanSheet (Boolean), saves (Int), penaltiesSaved (Int), yellowCards (Int), redCards (Int), penaltiesMissed (Int), ownGoals (Int), goalsConceded (Int)
- **Relations**:
  - `fixture` (BelongsTo -> Fixture)

### Prediction

- **Fields**: id (String, UUID), userId (String), matchId (String), homeGoals (Int), awayGoals (Int), status (String), pointsEarned (Float?), pointsBreakdown (JSON?), lockedAt (DateTime?), scoredAt (DateTime?), createdAt (DateTime), btts (Boolean?), totalGoalsOU (String?), totalGoalsLine (Float?), firstScorerId (String?)
- **Relations**:
  - `user` (BelongsTo -> User)
  - `fixture` (BelongsTo -> Fixture)

### Follow

- **Fields**: id (String, UUID), followerId (String), followingId (String), createdAt (DateTime)
- **Relations**:
  - `follower` (BelongsTo -> User)
  - `following` (BelongsTo -> User)

### ChatMessage

- **Fields**: id (String, UUID), userId (String), roomId (String), text (String), timestamp (DateTime), gifUrl (String?), type (String), reactions (JSON?), isPinned (Boolean), isDeleted (Boolean), isSystem (Boolean)
- **Relations**:
  - `user` (BelongsTo -> User)
  - `reports` (HasMany -> Report)

### Notification

- **Fields**: id (String, UUID), userId (String), type (String), title (String), message (String), isRead (Boolean), createdAt (DateTime), data (JSON?)
- **Relations**:
  - `user` (BelongsTo -> User)

### Report

- **Fields**: id (String, UUID), reporterId (String), messageId (String), reason (String), status (String), createdAt (DateTime)
- **Relations**:
  - `reporter` (BelongsTo -> User)
  - `message` (BelongsTo -> ChatMessage)

### AdminLog

- **Fields**: id (String, UUID), adminId (String), action (String), targetId (String?), targetType (String?), detail (JSON?), createdAt (DateTime)

### DraftSession, DraftPick, DraftRunResult, DraftTicket, DraftRewardsCatalog, PlayerRarityCache, RoomTemplate, Session, StarredPlayer, LeaderboardSnapshot, Achievement, UserAchievement, Subscription, FantasyPointsLedger

- These models follow standard patterns. The Draft structures manage the drafting mini-game lifecycle.
- `Session` is used by Passport/Express sessions if applicable.
- `LeaderboardSnapshot` stores historical ranks.

## Relationship Mapping

All relationships defined in `jsonDb.ts` will map to explicit `@relation` fields in Prisma with appropriate `fields` and `references`.

- **User 1:N RoomMember**
- **Room 1:N RoomMember**
- **User 1:N ChatMessage**
- **User 1:N Report**
- **ChatMessage 1:N Report**
- **User 1:N Follow (as Follower)**
- **User 1:N Follow (as Following)**
- **User 1:N Roster**
- **Room 1:N Roster**
- **Player 1:N Roster**
- **User 1:N Bid**
- **Room 1:N Bid**
- **Room 1:1 AuctionState**
- **Fixture 1:N PlayerMatchStat**

This completes the schema discovery for Phase 1.
