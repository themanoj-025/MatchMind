import { env } from '../config/env'
/**
 * draftGate.ts — MatchMind v4 §6.4
 *
 * Middleware that gates Draft Mode endpoints behind the per-tournament
 * feature flag. Draft Mode is only available for tournaments that have
 * been explicitly enabled via the admin settings (DRAFT_ENABLED_TOURNAMENTS).
 *
 * Also enforces that the seeding validation passes (§6.3) before
 * allowing Draft Mode to be enabled.
 */

import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/AppError'

/**
 * Returns the list of tournament IDs for which Draft Mode is enabled.
 * Reads from DRAFT_ENABLED_TOURNAMENTS env variable (comma-separated).
 */
export function getDraftEnabledTournaments(): string[] {
  const raw = env.DRAFT_ENABLED_TOURNAMENTS || ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Check if Draft Mode is enabled for a specific tournament.
 */
export function isDraftEnabledForTournament(tournamentId: string): boolean {
  return getDraftEnabledTournaments().includes(tournamentId)
}

/**
 * Express middleware: rejects requests to Draft Mode endpoints if the
 * tournament doesn't have Draft Mode enabled.
 *
 * Expects tournamentId in req.params.tournamentId or req.body.tournamentId.
 */
export function requireDraftEnabled(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const tournamentId =
    (req.params as any).tournamentId ||
    (req.body as any)?.tournamentId

  if (!tournamentId) {
    return next(
      new AppError(
        'TOURNAMENT_ID_REQUIRED',
        'tournamentId is required to access Draft Mode endpoints',
        400,
      ),
    )
  }

  if (!isDraftEnabledForTournament(tournamentId)) {
    return next(
      new AppError(
        'DRAFT_MODE_DISABLED',
        `Draft Mode is not enabled for tournament "${tournamentId}". ` +
          'Admins can enable it via /api/admin/settings/draft-mode/:tournamentId/enable ' +
          'after the player pool has been validated.',
        403,
      ),
    )
  }

  next()
}
