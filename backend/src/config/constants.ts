/**
 * Application Constants
 *
 * Magic numbers and configuration values extracted from route handlers
 * and scoring logic. Single source of truth for scoring points,
 * pagination defaults, retry configs, rate-limit tiers, and Draft Mode config.
 */

// ─── Scoring Points ────────────────────────────────────
export const SCORING = {
  BASE: 5,
  EXACT_SCORE: 50,
  RESULT_AND_GD: 35,
  RESULT_ONLY: 25,
  WRONG_RESULT: 0,
  BTTS: 10,
  OVER_UNDER: 10,
} as const

// ─── Pagination Defaults ───────────────────────────────
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const

// ─── Rate-Limit Tiers ──────────────────────────────────
export const RATE_LIMIT = {
  AUTH_WINDOW_MS: 15 * 60 * 1000,       // 15 minutes
  AUTH_MAX: 5,
  PASSWORD_RESET_WINDOW_MS: 60 * 60 * 1000, // 1 hour
  PASSWORD_RESET_MAX: 3,
  PREDICTION_WINDOW_MS: 60 * 1000,      // 1 minute
  PREDICTION_MAX: 30,
  GLOBAL_WINDOW_MS: 60 * 1000,          // 1 minute
  GLOBAL_MAX: 100,
} as const

// ─── BullMQ Retry Config ──────────────────────────────
export const BULLMQ = {
  SCORE_ATTEMPTS: 3,
  SCORE_BACKOFF_DELAY: 2000,
  SCORE_REMOVE_ON_COMPLETE: 100,
  SCORE_REMOVE_ON_FAIL: 50,
  RESET_ATTEMPTS: 2,
  RESET_BACKOFF_DELAY: 5000,
  RESET_REMOVE_ON_COMPLETE: 10,
  RESET_REMOVE_ON_FAIL: 10,
  RANK_ATTEMPTS: 2,
  RANK_BACKOFF_DELAY: 3000,
} as const

// ─── Match Scoring ─────────────────────────────────────
export const MATCH = {
  LOCK_STATUSES: ['PENDING', 'LOCKED'] as const,
  LOCKED_AT: new Date(),
  FINISHED_MINUTE: 90,
} as const

// ─── Chat Limits ───────────────────────────────────────
export const CHAT = {
  MAX_TEXT_LENGTH: 500,
} as const

// ─── Draft Mode — Rarity Tiers (§1.3) ─────────────────
export interface RarityTier {
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'ICON'
  maxPercentile: number
  packWeight: number
  badgeColor: string
}

export const RARITY_TIERS: readonly RarityTier[] = [
  { tier: 'BRONZE', maxPercentile: 60, packWeight: 0.55, badgeColor: '#CD7F32' },
  { tier: 'SILVER', maxPercentile: 85, packWeight: 0.30, badgeColor: '#C0C0C0' },
  { tier: 'GOLD',   maxPercentile: 97, packWeight: 0.13, badgeColor: '#FFD700' },
  { tier: 'ICON',   maxPercentile: 100, packWeight: 0.02, badgeColor: 'linear-gradient(135deg,#FFD700,#FFFFFF)' },
] as const

export type RarityTierName = (typeof RARITY_TIERS)[number]['tier']

// ─── Draft Mode — Core Config (§1) ────────────────────
export const DRAFT = {
  PICK_TIMER_SECONDS: 20,
  OFFERED_PLAYERS_PER_ROUND: 3,
  MAX_WINS: 5,
  MAX_LOSSES: 3,
  SYNERGY_NATIONALITY_THRESHOLD: 3,
  SYNERGY_CLUB_THRESHOLD: 2,
  SYNERGY_NATIONALITY_BONUS_PER: 1,   // +1% per player beyond threshold
  SYNERGY_CLUB_BONUS_PER: 2,           // +2% per player beyond threshold
  SYNERGY_MAX_BONUS: 15,               // cap at +15%
  FORMATION_FILL_BONUS: 5,             // flat +5% for filling all slots
  BENCH_SLOTS: 7,                      // max bench size
  MIN_PLAYERS_PER_POSITION_RARITY: 8,  // floor for seeding gate (§6.3)
  ICON_MIN_PER_POSITION: 1,            // exempt from 8-min, but need at least 1
  FREE_TICKETS_PER_TOURNAMENT: 1,      // free tier ticket allowance per 7d
  PRO_TICKETS_PER_DAY: 5,              // Pro tier ticket allowance per day
  TICKET_RESET_DAYS: 7,                // rolling window for free ticket reset
} as const

// ─── Draft Run — Reward Tiers (§2.4) ────────────────────
export const RUN_REWARD_TIERS = [
  { id: 'participant', name: 'Participant', description: 'Entered your first Draft Run', badgeColor: '#6B7280', minWins: 0 },
  { id: 'bronze-run', name: 'Bronze Contender', description: 'Survived 1 matchday', badgeColor: '#CD7F32', minWins: 1 },
  { id: 'silver-run', name: 'Silver Challenger', description: 'Survived 2 matchdays', badgeColor: '#C0C0C0', minWins: 2 },
  { id: 'gold-run', name: 'Gold Warrior', description: 'Survived 3 matchdays', badgeColor: '#FFD700', minWins: 3 },
  { id: 'elite-run', name: 'Elite Tactician', description: 'Survived 4 matchdays', badgeColor: '#8B5CF6', minWins: 4 },
  { id: 'icon-run', name: 'Draft Icon 🏆', description: 'Full clear — 5 wins!', badgeColor: 'linear-gradient(135deg,#FFD700,#FFFFFF)', minWins: 5 },
] as const

export type RunRewardTierId = (typeof RUN_REWARD_TIERS)[number]['id']

