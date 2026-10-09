/**
 * DraftAppService Tests — MatchMind
 *
 * Tests DraftAppService facade:
 * - Delegates to draftService functions
 * - Delegates to draftRunService functions
 * - Delegates to draftTicketService functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DraftAppService } from './draftAppService'

// Mock all delegated modules
vi.mock('./draftService', () => ({
  startDraft: vi.fn().mockResolvedValue({ sessionId: 'session-1' }),
  getNextRound: vi.fn().mockResolvedValue({ round: 1, players: [] }),
  processPick: vi.fn().mockResolvedValue({ success: true }),
  commitSquad: vi.fn().mockResolvedValue({ committed: true }),
  getSessionState: vi.fn().mockResolvedValue({ status: 'DRAFTING' }),
  listUserDrafts: vi.fn().mockResolvedValue([]),
  loadFormations: vi.fn().mockReturnValue([{ name: '4-4-2', slots: 11 }]),
}))

vi.mock('./draftRunService', () => ({
  enterRun: vi.fn().mockResolvedValue({ entered: true }),
  getRunStatus: vi.fn().mockResolvedValue({ status: 'PENDING' }),
  resolveNextMatchday: vi.fn().mockResolvedValue({ matchday: 1 }),
}))

vi.mock('./draftTicketService', () => ({
  consumeTicket: vi.fn().mockResolvedValue({ success: true, remaining: 0 }),
  getTicketBalance: vi.fn().mockResolvedValue({ remaining: 1, resetsAt: null, isPro: false }),
}))

describe('DraftAppService', () => {
  let service: DraftAppService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DraftAppService({ prisma: {} as unknown as import('../repositories').DatabaseClient })
  })

  describe('startDraft', () => {
    it('should delegate to draftService.startDraft', async () => {
      const { startDraft } = await import('./draftService')
      const consumeTicketCb = vi.fn().mockResolvedValue({ success: true, remaining: 0 })

      const result = await service.startDraft('user-1', 'tournament-1', '4-4-2', consumeTicketCb)

      expect(startDraft).toHaveBeenCalled()
      expect(result).toHaveProperty('sessionId')
    })
  })

  describe('getNextRound', () => {
    it('should delegate to draftService.getNextRound', async () => {
      const { getNextRound } = await import('./draftService')

      const result = await service.getNextRound('session-1', 'user-1')

      expect(getNextRound).toHaveBeenCalledWith(expect.anything(), 'session-1', 'user-1')
      expect(result).toHaveProperty('round')
    })
  })

  describe('processPick', () => {
    it('should delegate to draftService.processPick', async () => {
      const { processPick } = await import('./draftService')

      const result = await service.processPick('session-1', 'user-1', 0, 'player-1')

      expect(processPick).toHaveBeenCalled()
      expect(result).toHaveProperty('success')
    })
  })

  describe('commitSquad', () => {
    it('should delegate to draftService.commitSquad', async () => {
      const { commitSquad } = await import('./draftService')

      const result = await service.commitSquad('session-1', 'user-1')

      expect(commitSquad).toHaveBeenCalled()
      expect(result).toHaveProperty('committed')
    })
  })

  describe('getSessionState', () => {
    it('should delegate to draftService.getSessionState', async () => {
      const { getSessionState } = await import('./draftService')

      const result = await service.getSessionState('session-1', 'user-1')

      expect(getSessionState).toHaveBeenCalled()
      expect(result).toHaveProperty('status')
    })
  })

  describe('listUserDrafts', () => {
    it('should delegate to draftService.listUserDrafts', async () => {
      const { listUserDrafts } = await import('./draftService')

      const result = await service.listUserDrafts('user-1')

      expect(listUserDrafts).toHaveBeenCalled()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('loadFormations', () => {
    it('should delegate to draftService.loadFormations', async () => {
      const { loadFormations } = await import('./draftService')

      const result = service.loadFormations()

      expect(loadFormations).toHaveBeenCalled()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('enterRun', () => {
    it('should delegate to draftRunService.enterRun', async () => {
      const { enterRun } = await import('./draftRunService')

      const result = await service.enterRun('session-1', 'user-1')

      expect(enterRun).toHaveBeenCalled()
      expect(result).toHaveProperty('entered')
    })
  })

  describe('getRunStatus', () => {
    it('should delegate to draftRunService.getRunStatus', async () => {
      const { getRunStatus } = await import('./draftRunService')

      const result = await service.getRunStatus('session-1', 'user-1')

      expect(getRunStatus).toHaveBeenCalled()
      expect(result).toHaveProperty('status')
    })
  })

  describe('resolveNextMatchday', () => {
    it('should delegate to draftRunService.resolveNextMatchday', async () => {
      const { resolveNextMatchday } = await import('./draftRunService')

      const result = await service.resolveNextMatchday('session-1', 'user-1')

      expect(resolveNextMatchday).toHaveBeenCalled()
      expect(result).toHaveProperty('matchday')
    })
  })

  describe('consumeTicket', () => {
    it('should delegate to draftTicketService.consumeTicket', async () => {
      const { consumeTicket } = await import('./draftTicketService')

      const result = await service.consumeTicket('user-1', 'tournament-1', false)

      expect(consumeTicket).toHaveBeenCalled()
      expect(result).toHaveProperty('success')
    })
  })

  describe('getTicketBalance', () => {
    it('should delegate to draftTicketService.getTicketBalance', async () => {
      const { getTicketBalance } = await import('./draftTicketService')

      const result = await service.getTicketBalance('user-1', 'tournament-1', false)

      expect(getTicketBalance).toHaveBeenCalled()
      expect(result).toHaveProperty('remaining')
      expect(result).toHaveProperty('isPro')
    })
  })
})
