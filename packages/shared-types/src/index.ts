import { z } from 'zod';

// ==========================================
// Prisma Enums Equivalent
// ==========================================

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export enum UserTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM'
}

export enum TournamentStatus {
  UPCOMING = 'UPCOMING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED'
}

export enum PlayerPosition {
  GK = 'GK',
  DEF = 'DEF',
  MID = 'MID',
  FWD = 'FWD'
}

export enum RoomStatus {
  LOBBY = 'LOBBY',
  DRAFTING = 'DRAFTING',
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED'
}

export enum RoomMemberRole {
  MEMBER = 'member',
  ADMIN = 'admin'
}

export enum AuctionPhase {
  IDLE = 'IDLE',
  NOMINATING = 'NOMINATING',
  BIDDING = 'BIDDING',
  RESOLVED = 'RESOLVED'
}

export enum FixtureStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PLAY = 'IN_PLAY',
  PAUSED = 'PAUSED',
  FINISHED = 'FINISHED'
}

export enum PredictionStatus {
  PENDING = 'PENDING',
  CORRECT = 'CORRECT',
  INCORRECT = 'INCORRECT'
}

export enum ChatMessageType {
  USER = 'user',
  SYSTEM = 'system'
}

export enum ReportStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  RESOLVED = 'RESOLVED'
}

export enum DraftTicketStatus {
  AVAILABLE = 'AVAILABLE',
  USED = 'USED'
}

export enum DraftSessionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum DraftRunResultStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ELIMINATED = 'ELIMINATED'
}

// ==========================================
// Shared Zod Schemas
// ==========================================

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  take: z.coerce.number().min(1).max(100).default(50),
});

export type PaginationParams = z.infer<typeof paginationSchema>;
export type CursorPaginationParams = z.infer<typeof cursorPaginationSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}

