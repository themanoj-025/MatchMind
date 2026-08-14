/**
 * Draft Ticket Service — MatchMind v4 §4.1
 *
 * Manages the Draft Ticket economy:
 * - Free tier: 1 ticket per tournament per rolling 7 days, auto-refills
 * - Pro tier: 5 tickets per day per tournament
 *
 * Tickets are a first-party ledger (draftTickets.json), not a payment-processed
 * virtual currency. No in-app-purchase API needed; ticket allowance is simply
 * a Pro-tier gate, consistent with the existing Stripe subscription check.
 */

import logger from '../utils/logger'
import { DRAFT } from '../config/constants'

export interface TicketRecord {
  id: string
  userId: string
  tournamentId: string
  remaining: number
  lastResetAt: string
  resetsAt: string
  sourceLog: Array<{ reason: string; delta: number; at: string }>
}

// ─── Helpers ─────────────────────────────────────────────

function now(): string {
  return new Date().toISOString()
}

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function nextDayFromNow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// ─── Get or Create Ticket Record ────────────────────────

export async function getOrCreateTicketRecord(
  prisma: any,
  userId: string,
  tournamentId: string,
  isPro: boolean,
): Promise<TicketRecord> {
  const existing = await prisma.draftTicket.findUnique({
    where: { userId_tournamentId: { userId, tournamentId } },
  })

  if (existing) {
    return checkAndResetTickets(existing, isPro)
  }

  // Create new record
  const allowance = isPro ? DRAFT.PRO_TICKETS_PER_DAY : DRAFT.FREE_TICKETS_PER_TOURNAMENT
  const resetsAt = isPro ? nextDayFromNow() : daysFromNow(DRAFT.TICKET_RESET_DAYS)

  const record = await prisma.draftTicket.create({
    data: {
      userId,
      tournamentId,
      remaining: allowance,
      lastResetAt: now(),
      resetsAt,
      sourceLog: [{ reason: 'initial_allocation', delta: allowance, at: now() }],
    },
  })

  return record as TicketRecord
}

// ─── Check and Reset Tickets if Window Expired ──────────

function checkAndResetTickets(record: TicketRecord, isPro: boolean): TicketRecord {
  const now_time = Date.now()
  const resetsAtTime = new Date(record.resetsAt).getTime()

  if (now_time >= resetsAtTime) {
    // Reset tickets
    const allowance = isPro ? DRAFT.PRO_TICKETS_PER_DAY : DRAFT.FREE_TICKETS_PER_TOURNAMENT
    const newResetsAt = isPro ? nextDayFromNow() : daysFromNow(DRAFT.TICKET_RESET_DAYS)

    record.remaining = allowance
    record.lastResetAt = now()
    record.resetsAt = newResetsAt
    record.sourceLog.push({ reason: 'auto_reset', delta: allowance, at: now() })
  }

  return record
}

// ─── Consume a Ticket ───────────────────────────────────

export async function consumeTicket(
  prisma: any,
  userId: string,
  tournamentId: string,
  isPro: boolean,
): Promise<{ success: boolean; remaining: number; reason?: string }> {
  // Ensure ticket record exists (initializes allocations or resets window if expired)
  await getOrCreateTicketRecord(prisma, userId, tournamentId, isPro)

  // Atomic decrement check-and-decrement
  const updateResult = await prisma.draftTicket.updateMany({
    where: {
      userId,
      tournamentId,
      remaining: { gt: 0 },
    },
    data: {
      remaining: { decrement: 1 },
    },
  })

  if (updateResult.count === 0) {
    const record = await getOrCreateTicketRecord(prisma, userId, tournamentId, isPro)
    const resetsAt = new Date(record.resetsAt)
    const hoursLeft = Math.ceil((resetsAt.getTime() - Date.now()) / (1000 * 60 * 60))
    return {
      success: false,
      remaining: 0,
      reason: isPro
        ? `No tickets remaining. Resets in ${hoursLeft}h.`
        : `Free tier: 1 ticket per ${DRAFT.TICKET_RESET_DAYS} days. Resets in ${hoursLeft}h. Upgrade to Pro for ${DRAFT.PRO_TICKETS_PER_DAY} tickets/day.`,
    }
  }

  // Fetch updated record to get current balance
  const updated = await prisma.draftTicket.findUnique({
    where: { userId_tournamentId: { userId, tournamentId } },
  })

  logger.info({
    event: 'draft.ticket_consumed',
    userId,
    tournamentId,
    remaining: updated?.remaining ?? 0,
  })

  return { success: true, remaining: updated?.remaining ?? 0 }
}

// ─── Get Ticket Balance ─────────────────────────────────

export async function getTicketBalance(
  prisma: any,
  userId: string,
  tournamentId: string,
  isPro: boolean,
): Promise<{ remaining: number; resetsAt: string | null; isPro: boolean }> {
  const record = await getOrCreateTicketRecord(prisma, userId, tournamentId, isPro)

  // Persist any auto-reset that happened during getOrCreateTicketRecord
  await prisma.draftTicket.update({
    where: { userId_tournamentId: { userId, tournamentId } },
    data: {
      remaining: record.remaining,
      lastResetAt: record.lastResetAt,
      resetsAt: record.resetsAt,
    },
  }).catch(() => {/* record may not exist yet for brand new */})

  return {
    remaining: record.remaining,
    resetsAt: record.remaining <= 0 ? record.resetsAt : null,
    isPro,
  }
}
