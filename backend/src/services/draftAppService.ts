import { DatabaseClient } from '../repositories'
import {
  startDraft,
  getNextRound,
  processPick,
  commitSquad,
  getSessionState,
  listUserDrafts,
  loadFormations
} from './draftService'
import {
  enterRun,
  getRunStatus,
  resolveNextMatchday
} from './draftRunService'
import {
  consumeTicket,
  getTicketBalance
} from './draftTicketService'

export class DraftAppService {
  constructor(private opts: { prisma: DatabaseClient }) {}

  async startDraft(userId: string, tournamentId: string, formation: string, consumeTicketCb: () => Promise<any>) {
    return startDraft(this.opts.prisma, userId, tournamentId, formation, consumeTicketCb)
  }

  async getNextRound(sessionId: string, userId: string) {
    return getNextRound(this.opts.prisma, sessionId, userId)
  }

  async processPick(sessionId: string, userId: string, slotIndex: number, pickedPlayerId: string) {
    return processPick(this.opts.prisma, sessionId, userId, slotIndex, pickedPlayerId)
  }

  async commitSquad(sessionId: string, userId: string) {
    return commitSquad(this.opts.prisma, sessionId, userId)
  }

  async getSessionState(sessionId: string, userId: string) {
    return getSessionState(this.opts.prisma, sessionId, userId)
  }

  async listUserDrafts(userId: string) {
    return listUserDrafts(this.opts.prisma, userId)
  }

  loadFormations() {
    return loadFormations()
  }

  async enterRun(sessionId: string, userId: string) {
    return enterRun(this.opts.prisma, sessionId, userId)
  }

  async getRunStatus(sessionId: string, userId: string) {
    return getRunStatus(this.opts.prisma, sessionId, userId)
  }

  async resolveNextMatchday(sessionId: string, userId: string) {
    return resolveNextMatchday(this.opts.prisma, sessionId, userId)
  }

  async consumeTicket(userId: string, tournamentId: string, isPro: boolean) {
    return consumeTicket(this.opts.prisma, userId, tournamentId, isPro)
  }

  async getTicketBalance(userId: string, tournamentId: string, isPro: boolean) {
    return getTicketBalance(this.opts.prisma, userId, tournamentId, isPro)
  }
}
