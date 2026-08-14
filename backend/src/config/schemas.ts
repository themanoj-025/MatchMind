/**
 * Zod validation schemas for MatchMind API.
 * All POST / PATCH / PUT route bodies are defined here.
 */

import { z } from 'zod'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'

extendZodWithOpenApi(z)
import { isValidTournamentId, POSITIONS } from './tournaments'

// ─── Auth ───────────────────────────────────────────────

const email = z.string().email('Invalid email format').max(255)
const password = z.string().min(8, 'Password must be at least 8 characters').max(128)
const username = z.string().min(3, 'Username must be at least 3 characters').max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')

export const signupSchema = z.object({ username, email, password }).strict()
export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required') }).strict()
export const forgotPasswordSchema = z.object({ email }).strict()
export const resetPasswordSchema = z.object({ token: z.string().min(1, 'Token is required'), password }).strict()
export const verifyEmailSchema = z.object({ token: z.string().min(1, 'Token is required') }).strict()

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>

// ─── Rooms ──────────────────────────────────────────────

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(100),
  tournamentId: z.string().refine(isValidTournamentId, { message: 'Invalid tournament ID — must match a known tournament in the registry (e.g. fifa-wc-2026, uefa-ucl-2026-27, etc.)' }),
  totalBudget: z.number().int().positive().default(500),
  format: z.string().optional(),
  rosterRules: z.object({
    GK: z.number().int().min(1).max(5).default(2),
    DEF: z.number().int().min(1).max(8).default(5),
    MID: z.number().int().min(1).max(8).default(5),
    FWD: z.number().int().min(1).max(5).default(3),
    total: z.number().int().min(11).max(25).default(15),
  }).optional(),
}).strict()

export const joinRoomSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required').length(8),
}).strict()

export const setCaptainSchema = z.object({
  captainId: z.string().min(1, 'captainId is required').optional(),
  viceCaptainId: z.string().min(1, 'viceCaptainId is required').optional(),
}).strict()

export type CreateRoomInput = z.infer<typeof createRoomSchema>
export type JoinRoomInput = z.infer<typeof joinRoomSchema>
export type SetCaptainInput = z.infer<typeof setCaptainSchema>

// ─── Users ──────────────────────────────────────────────

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatar: z.string().url('Invalid avatar URL').max(500).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
}).strict()

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

// ─── Stripe ────────────────────────────────────────────

export const createCheckoutSchema = z.object({
  plan: z.enum(['monthly', 'annual']),
}).strict()

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>

// ─── Messages ──────────────────────────────────────────

export const sendMessageSchema = z.object({
  text: z.string().max(1000, 'Message must be under 1000 characters').optional().nullable(),
  gifUrl: z.string().url('Invalid GIF URL').max(500).optional().nullable(),
}).strict().refine(
  (data) => data.text?.trim() || data.gifUrl,
  { message: 'Message text or GIF URL is required' }
)

export type SendMessageInput = z.infer<typeof sendMessageSchema>

// ─── Admin ──────────────────────────────────────────────

export const adminUpdateUserSchema = z.object({
  role: z.enum(['USER', 'MODERATOR', 'ADMIN', 'SUPERADMIN']).optional(),
  username: username.optional(),
  email: email.optional(),
  displayName: z.string().min(1).max(100).optional(),
}).strict()

export const adminUpdateReportSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
}).strict()

export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>
export type AdminUpdateReportInput = z.infer<typeof adminUpdateReportSchema>

// ─── Query Schemas ─────────────────────────────────────

export const searchQuerySchema = z.object({
  q: z.string().min(2, 'Search query must be at least 2 characters').max(100),
})

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
})

export type SearchQueryInput = z.infer<typeof searchQuerySchema>
export type PaginationInput = z.infer<typeof paginationQuerySchema>

// ─── Player Stats (admin) ──────────────────────────────

export const playerStatSchema = z.object({
  playerId: z.string().min(1),
  minutesPlayed: z.number().int().min(0).max(120),
  goals: z.number().int().min(0),
  assists: z.number().int().min(0),
  cleanSheet: z.boolean(),
  saves: z.number().int().min(0),
  penaltiesSaved: z.number().int().min(0),
  yellowCards: z.number().int().min(0).max(2),
  redCards: z.number().int().min(0).max(1),
  penaltiesMissed: z.number().int().min(0),
  ownGoals: z.number().int().min(0),
  goalsConceded: z.number().int().min(0),
})

export const enterPlayerStatsSchema = z.object({
  playerStats: z.array(playerStatSchema).min(1),
}).strict()

// ─── Draft Mode — Schemas (§1.9) ───────────────────────

export const RARITY_TIER_NAMES = ['BRONZE', 'SILVER', 'GOLD', 'ICON'] as const
export type RarityTierName = (typeof RARITY_TIER_NAMES)[number]

export const FORMATION_NAMES = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2'] as const
export type FormationName = (typeof FORMATION_NAMES)[number]

export const DRAFT_SESSION_STATUSES = ['DRAFTING', 'SQUAD_COMPLETE', 'RUN_IN_PROGRESS', 'RUN_COMPLETE', 'ABANDONED'] as const
export type DraftSessionStatus = (typeof DRAFT_SESSION_STATUSES)[number]

export const draftStartSchema = z.object({
  tournamentId: z.string().min(1, 'Tournament ID is required'),
  formation: z.enum(FORMATION_NAMES, { message: 'Invalid formation — must be one of: 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2' }),
}).strict()

export const draftPickSchema = z.object({
  slotIndex: z.number().int().min(0),
  pickedPlayerId: z.string().min(1, 'Player ID is required'),
}).strict()

// ─── Draft Run — Schemas (§2) ───────────────────────────

export const enterRunSchema = z.object({
  sessionId: z.string().min(1, 'Draft session ID is required'),
}).strict()

export const getRunStatusSchema = z.object({
  sessionId: z.string().min(1, 'Draft session ID is required'),
}).strict()

export type DraftStartInput = z.infer<typeof draftStartSchema>
export type DraftPickInput = z.infer<typeof draftPickSchema>
export type EnterRunInput = z.infer<typeof enterRunSchema>
export type GetRunStatusInput = z.infer<typeof getRunStatusSchema>
