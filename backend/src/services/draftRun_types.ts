/** Draft run types and state interfaces. */

/**
 * Draft Run Service — MatchMind v4 §2
 *
 * Post-draft competitive phase: takes a committed squad through matchday
 * rounds where fantasy points are compared against a benchmark. Tracks
 * wins/losses/ties, enforces 3-loss elimination, and awards cosmetic
 * reward tiers for 5-win full clears.
 *
 * Matchday resolution flow:
 *   1. Admin finalizes a fixture → `playerMatchStat` records are created
 *   2. System detects completed fixtures for the squad's tournament
 *   3. Computes fantasy points for each squad player from real match stats
 *   4. Compares total squad fantasy points against a benchmark score
 *   5. Records win/loss/tie, advances the DraftRun state
 *
 * If no fixture data exists yet, the run returns a "WAITING_FOR_MATCHDAY"
 * status — the user polls later when real matches have been played.
 */

import { DRAFT, RUN_REWARD_TIERS } from '../config/constants'
import { DatabaseClient } from '../repositories'
import type { DraftSession, DraftPick, SquadPlayer } from './draftService'
import { computeApproximatePoints, type ApproxStats } from './draftScoring'
import logger from '../utils/logger'

// ─── Types ───────────────────────────────────────────────

export type DraftRunStatus = 'IN_PROGRESS' | 'WAITING_FOR_MATCHDAY' | 'COMPLETE'
export type RunOutcome = 'WIN' | 'LOSS' | 'TIE'

export interface DraftRunResult {
  id: string
  draftSessionId: string
  userId: string
  tournamentId: string
  currentRound: number // which matchday round (0-indexed)
  totalWins: number
  totalLosses: number
  totalTies: number
  status: DraftRunStatus
  rewards: string[] // cosmetic reward IDs earned
  rounds: DraftRunRound[] // resolved round history (sub-document)
  eliminatedAt: string | null // date when 3rd loss occurred
  clearedAt: string | null // date when 5th win occurred
  createdAt: string
  updatedAt: string
}

export interface DraftRunRound {
  roundNumber: number
  matchdayId: string | null // the fixture/matchday ID (null if no real match yet)
  matchdayName: string | null // e.g. "Matchday 1"
  outcome: RunOutcome | null // null if matchday not yet resolved
  userPoints: number
  benchmarkPoints: number
  breakdown: Record<string, number> // per-player fantasy point breakdown
}

export interface DraftRunState {
  result: DraftRunResult
  rounds: DraftRunRound[]
  squad: SquadPlayer[]
  currentRound: DraftRunRound | null
  isEliminated: boolean
  isFullClear: boolean
  nextMatchdayLabel: string | null
}

const BENCHMARK_SCORE_BASE = 45 // average fantasy points for a full squad
const BENCHMARK_VARIANCE = 15 // ± random variance

// ─── Enter Run (§2.1) ───────────────────────────────────
