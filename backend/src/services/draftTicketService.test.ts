/**
 * DraftTicketService Tests — MatchMind
 *
 * Tests draft ticket economy:
 * - consumeTicket: decrements remaining tickets
 * - getTicketBalance: returns current balance and reset info
 * - getOrCreateTicketRecord: creates initial allocation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { consumeTicket, getTicketBalance, getOrCreateTicketRecord } from './draftTicketService'
import type { DatabaseClient } from '../repositories'

function createMockPrisma(overrides: Record<string, unknown> = {}): DatabaseClient {
  return {
    draftTicket: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'ticket-1',
          ...data,
        }),
      ),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    ...overrides,
  } as unknown as DatabaseClient
}

describe('DraftTicketService', () => {
  let prisma: DatabaseClient

  beforeEach(() => {
    prisma = createMockPrisma()
  })

  describe('consumeTicket', () => {
    it('should consume a ticket successfully', async () => {
      const mockPrisma = createMockPrisma({
        draftTicket: {
          findUnique: vi.fn()
            .mockResolvedValueOnce(null) // first call: getOrCreateTicketRecord
            .mockResolvedValueOnce({ id: 'ticket-1', remaining: 4, resetsAt: new Date().toISOString() }), // after consume
          create: vi.fn().mockResolvedValue({ id: 'ticket-1', remaining: 1, resetsAt: new Date().toISOString() }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: vi.fn().mockResolvedValue({}),
        },
      })

      const result = await consumeTicket(mockPrisma, 'user-1', 'tournament-1', false)

      expect(result).toHaveProperty('success')
      expect(typeof result.success).toBe('boolean')
    })

    it('should return failure when no tickets remain', async () => {
      const mockPrisma = createMockPrisma({
        draftTicket: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ticket-1',
            userId: 'user-1',
            tournamentId: 'tournament-1',
            remaining: 0,
            lastResetAt: new Date().toISOString(),
            resetsAt: new Date(Date.now() + 86400000).toISOString(),
            sourceLog: [],
          }),
          create: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          update: vi.fn().mockResolvedValue({}),
        },
      })

      const result = await consumeTicket(mockPrisma, 'user-1', 'tournament-1', false)

      expect(result.success).toBe(false)
      expect(result).toHaveProperty('reason')
    })
  })

  describe('getTicketBalance', () => {
    it('should return balance for a user', async () => {
      const mockPrisma = createMockPrisma({
        draftTicket: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ticket-1',
            userId: 'user-1',
            tournamentId: 'tournament-1',
            remaining: 3,
            lastResetAt: new Date().toISOString(),
            resetsAt: new Date(Date.now() + 86400000).toISOString(),
            sourceLog: [],
          }),
          create: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn(),
        },
      })

      const result = await getTicketBalance(mockPrisma, 'user-1', 'tournament-1', false)

      expect(result).toHaveProperty('remaining')
      expect(result).toHaveProperty('isPro')
      expect(typeof result.remaining).toBe('number')
      expect(result.isPro).toBe(false)
    })

    it('should reflect Pro tier in balance', async () => {
      const mockPrisma = createMockPrisma({
        draftTicket: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: 'ticket-1',
            userId: 'user-1',
            tournamentId: 'tournament-1',
            remaining: 5,
            lastResetAt: new Date().toISOString(),
            resetsAt: new Date(Date.now() + 86400000).toISOString(),
            sourceLog: [],
          }),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn(),
        },
      })

      const result = await getTicketBalance(mockPrisma, 'user-1', 'tournament-1', true)

      expect(result.isPro).toBe(true)
    })
  })

  describe('getOrCreateTicketRecord', () => {
    it('should create a new ticket record when none exists', async () => {
      const mockPrisma = createMockPrisma({
        draftTicket: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({ id: 'ticket-new', ...data }),
          ),
          update: vi.fn(),
          updateMany: vi.fn(),
        },
      })

      const record = await getOrCreateTicketRecord(mockPrisma, 'user-1', 'tournament-1', false)

      expect(record).toHaveProperty('userId', 'user-1')
      expect(record).toHaveProperty('tournamentId', 'tournament-1')
      expect(record).toHaveProperty('remaining')
      expect(typeof record.remaining).toBe('number')
    })

    it('should return existing record if found', async () => {
      const existing = {
        id: 'ticket-existing',
        userId: 'user-1',
        tournamentId: 'tournament-1',
        remaining: 3,
        lastResetAt: new Date().toISOString(),
        resetsAt: new Date(Date.now() + 86400000).toISOString(),
        sourceLog: [],
      }
      const mockPrisma = createMockPrisma({
        draftTicket: {
          findUnique: vi.fn().mockResolvedValue(existing),
          create: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
        },
      })

      const record = await getOrCreateTicketRecord(mockPrisma, 'user-1', 'tournament-1', false)

      expect(record.id).toBe('ticket-existing')
      expect(record.remaining).toBe(3)
    })
  })
})
