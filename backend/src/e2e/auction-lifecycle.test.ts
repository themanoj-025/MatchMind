/**
 * E2E Test — REST API Lifecycle
 *
 * Tests the REST API flows:
 * - Room CRUD (create, get, list mine)
 * - Host auction controls (start, force-sold, next-player, force-unsold)
 * - Franchise (roster view, set captain/VC)
 * - Error handling (404, validation)
 *
 * Note: Bids are processed via WebSocket, not REST — tested in socket integration tests.
 * Note: jsonDb.findUnique doesn't process include/select — use dedicated endpoints for state.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, type Server } from 'http'
import jwt from 'jsonwebtoken'
import { createTestApp, cleanupDir } from '../test-utils/e2e-setup'

process.env.JWT_SECRET = 'test-jwt-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'

const TEST_USER_ID = 'test-user-1'
const OTHER_USER_ID = 'other-user-2'
const TEST_AUTH_TOKEN = jwt.sign({ userId: TEST_USER_ID }, process.env.JWT_SECRET, { expiresIn: '1h' })

let app: any
let prisma: any
let dataDir: string
let server: Server
let baseUrl: string

const shared = {
  roomId: '' as string,
  inviteCode: '' as string,
  playerId: '' as string,
}

// ─── fetch wrapper ──────────────────────────────────────

async function api(method: string, path: string, opts: { body?: any; auth?: boolean } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.auth !== false) {
    headers['Authorization'] = `Bearer ${TEST_AUTH_TOKEN}`
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })

  const ct = res.headers.get('content-type') || ''
  const body = ct.includes('application/json') ? await res.json() : await res.text()
  return { status: res.status, body }
}

// ─── Setup / Teardown ───────────────────────────────────

beforeAll(async () => {
  const testEnv = await createTestApp()
  app = testEnv.app
  prisma = testEnv.prisma
  dataDir = testEnv.dataDir

  // Clear DB before tests
  await prisma.bid.deleteMany()
  await prisma.roster.deleteMany()
  await prisma.roomMember.deleteMany()
  await prisma.auctionState.deleteMany()
  await prisma.room.deleteMany()
  await prisma.player.deleteMany()
  await prisma.tournament.deleteMany()
  await prisma.room.deleteMany()
  await prisma.user.deleteMany()

  // Create test users
  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      username: 'test',
      email: 'test@test.com',
      displayName: 'Test User',
      passwordHash: '$2a$10$testhashedpassword',
      tier: 'BRONZE',
      isPro: false,
      totalPoints: 0,
    },
  })
  await prisma.user.create({
    data: {
      id: OTHER_USER_ID,
      username: 'other',
      email: 'other@test.com',
      displayName: 'Other User',
      passwordHash: '$2a$10$testhashedpassword',
      tier: 'BRONZE',
      isPro: false,
      totalPoints: 0,
    },
  })

  // Seed tournament so POST /api/rooms doesn't fail on foreign key constraint
  await prisma.tournament.upsert({
    where: { id: 'fifa-wc-2026' },
    update: {},
    create: {
      id: 'fifa-wc-2026',
      name: 'FIFA World Cup 2026',
      shortName: 'WC 2026',
      status: 'UPCOMING',
      confederation: 'FIFA',
      gender: 'men',
      format: 'international',
      teamCount: 48,
      squadSize: 26,
      launchPhase: 1,
    },
  })

  // Seed players
  await prisma.player.createMany({
    data: [
      {
        id: 'player-1',
        tournamentId: 'fifa-wc-2026',
        name: 'Lionel Messi',
        club: 'Inter Miami',
        nationality: 'Argentina',
        position: 'FWD',
        basePrice: 50,
      },
      {
        id: 'player-2',
        tournamentId: 'fifa-wc-2026',
        name: 'Kylian Mbappe',
        club: 'Real Madrid',
        nationality: 'France',
        position: 'FWD',
        basePrice: 60,
      },
      {
        id: 'player-3',
        tournamentId: 'fifa-wc-2026',
        name: 'Kevin De Bruyne',
        club: 'Man City',
        nationality: 'Belgium',
        position: 'MID',
        basePrice: 45,
      },
    ],
    skipDuplicates: true,
  })

  server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const addr = server.address()
  if (typeof addr === 'object' && addr !== null) {
    baseUrl = `http://localhost:${addr.port}`
  }

  // Seed users
  await prisma.user.createMany({
    data: [
      { id: TEST_USER_ID, email: 'test@example.com', username: 'testuser', role: 'USER' },
      { id: OTHER_USER_ID, email: 'other@example.com', username: 'otheruser', role: 'USER' },
    ],
    skipDuplicates: true,
  })
})

afterAll(() => {
  server?.close()
  cleanupDir(dataDir)
})

// ─── Tests ──────────────────────────────────────────────

describe('Room CRUD', () => {
  it('GET /api/health returns ok', async () => {
    const { status, body } = await api('GET', '/api/health', { auth: false })
    expect(status).toBe(200)
    expect(body.status).toBe('healthy')
  })

  it('POST /api/rooms creates a room with invite code', async () => {
    const res = await api('POST', '/api/rooms', {
      body: {
        name: 'E2E Test Draft',
        tournamentId: 'fifa-wc-2026',
        totalBudget: 500,
      },
    })

    if (res.status !== 201) {
      throw new Error(`POST /api/rooms FAILED: ${res.status} ${JSON.stringify(res.body)}`)
    }

    const { status, body } = res
    expect(status).toBe(201)
    expect(body.id).toBeDefined()
    expect(body.name).toBe('E2E Test Draft')
    expect(body.status).toBe('LOBBY')
    expect(body.inviteCode).toBeDefined()
    expect(body.inviteCode).toHaveLength(8)

    shared.roomId = body.id
    shared.inviteCode = body.inviteCode
  })

  it('GET /api/rooms/:id returns the room object', async () => {
    const { status, body } = await api('GET', `/api/rooms/${shared.roomId}`, { auth: false })
    expect(status).toBe(200)
    expect(body.id).toBe(shared.roomId)
    expect(body.name).toBe('E2E Test Draft')
    expect(body.hostId).toBe(TEST_USER_ID)
  })

  it('GET /api/rooms/:id/state returns the auction state', async () => {
    const { status, body } = await api('GET', `/api/rooms/${shared.roomId}/state`)
    expect(status).toBe(200)
    expect(body.phase).toBe('IDLE')
    expect(body.currentBid).toBe(0)
    expect(body.version).toBe(1)
  })
})

describe('Auction Host Controls', () => {
  let currentPlayerId: string

  it('adds the other user as a room member', async () => {
    await prisma.roomMember.create({
      data: {
        roomId: shared.roomId,
        userId: OTHER_USER_ID,
        remainingBudget: 500,
      },
    })

    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: shared.roomId, userId: TEST_USER_ID } },
    })
    expect(member).toBeDefined()
    expect(member.remainingBudget).toBe(500)
  })

  it('POST /api/rooms/:roomId/start begins auction in PLAYER_LIVE phase', async () => {
    const { status, body } = await api('POST', `/api/rooms/${shared.roomId}/start`)
    expect(status).toBe(200)

    // Verify state via dedicated endpoint
    const stateRes = await api('GET', `/api/rooms/${shared.roomId}/state`)
    expect(stateRes.body.phase).toBe('PLAYER_LIVE')
    expect(stateRes.body.currentPlayerId).toBeDefined()
    expect(stateRes.body.currentBid).toBe(0)
    expect(stateRes.body.timerEndsAt).toBeDefined()

    currentPlayerId = stateRes.body.currentPlayerId
    shared.playerId = currentPlayerId
  })

  it('POST /api/rooms/:roomId/force-sold sells the current player', async () => {
    // First check the state has a current player
    const stateBefore = await api('GET', `/api/rooms/${shared.roomId}/state`)
    expect(stateBefore.body.currentPlayerId).toBeDefined()

    // Seed a bidder so force-sold creates a roster entry
    await prisma.auctionState.update({
      where: { roomId: shared.roomId },
      data: {
        currentBidderId: TEST_USER_ID,
        currentBid: 15,
      },
    })

    const { status } = await api('POST', `/api/rooms/${shared.roomId}/force-sold`)
    expect(status).toBe(200)
  })

  it('POST /api/rooms/:roomId/next-player advances to the next player', async () => {
    const { status, body } = await api('POST', `/api/rooms/${shared.roomId}/next-player`)
    expect(status).toBe(200)

    // The state should now have a new currentPlayerId
    const stateRes = await api('GET', `/api/rooms/${shared.roomId}/state`)
    expect(stateRes.body.phase).toBe('PLAYER_LIVE')
    expect(stateRes.body.currentPlayerId).not.toBeNull()

    // If the pool has exhausted, may be RE_AUCTION — acceptable
    shared.playerId = stateRes.body.currentPlayerId
  })

  it('GET /api/rooms/:roomId/franchises/:userId shows the sold player in roster', async () => {
    const { status, body } = await api('GET', `/api/rooms/${shared.roomId}/franchises/${TEST_USER_ID}`)
    expect(status).toBe(200)
    expect(body.roster).toBeDefined()
    expect(body.roster.length).toBeGreaterThanOrEqual(1)
    expect(body.remainingBudget).toBeLessThan(500)
  })

  it('POST /api/rooms/:roomId/force-unsold marks the current player as unsold', async () => {
    const stateBefore = await api('GET', `/api/rooms/${shared.roomId}/state`)
    expect(stateBefore.body.phase).toBe('PLAYER_LIVE')

    const { status } = await api('POST', `/api/rooms/${shared.roomId}/force-unsold`)
    expect(status).toBe(200)

    const stateAfter = await api('GET', `/api/rooms/${shared.roomId}/state`)
    expect(stateAfter.body.phase).toBe('UNSOLD')
  })

  it('advances past the unsold player to the next in queue', async () => {
    const { status } = await api('POST', `/api/rooms/${shared.roomId}/next-player`)
    expect(status).toBe(200)

    const stateRes = await api('GET', `/api/rooms/${shared.roomId}/state`)
    // May be PLAYER_LIVE, RE_AUCTION, or FINISHED depending on pool
    expect(['PLAYER_LIVE', 'RE_AUCTION', 'FINISHED']).toContain(stateRes.body.phase)
  })
})

describe('Franchise Captain/VC', () => {
  it('sets captain and vice-captain on roster', async () => {
    // Get current roster
    const rosterRes = await api('GET', `/api/rooms/${shared.roomId}/franchises/${TEST_USER_ID}`)
    expect(rosterRes.body.roster.length).toBeGreaterThanOrEqual(1)

    const playerId = rosterRes.body.roster[0].playerId

    // Set captain
    const captainRes = await api('PATCH', `/api/rooms/${shared.roomId}/franchises/me/captain`, {
      body: { playerId, isViceCaptain: false },
    })
    expect(captainRes.status).toBe(200)
    const captainEntry = captainRes.body.find((r: any) => r.playerId === playerId)
    expect(captainEntry).toBeDefined()
    expect(captainEntry.isCaptain).toBe(true)

    // Set VC on a different player if available
    if (rosterRes.body.roster.length >= 2) {
      const vcPlayerId = rosterRes.body.roster[1].playerId
      const vcRes = await api('PATCH', `/api/rooms/${shared.roomId}/franchises/me/captain`, {
        body: { playerId: vcPlayerId, isViceCaptain: true },
      })
      expect(vcRes.status).toBe(200)
      const vcEntry = vcRes.body.find((r: any) => r.playerId === vcPlayerId)
      expect(vcEntry?.isViceCaptain).toBe(true)
    }
  })
})

describe('API Error Handling', () => {
  it('returns 404 for non-existent room', async () => {
    const { status, body } = await api('GET', '/api/rooms/non-existent-id', { auth: false })
    expect(status).toBe(404)
    expect(body.error).toBeDefined()
  })

  it('returns validation error for invalid room creation', async () => {
    const { status, body } = await api('POST', '/api/rooms', { body: {} })
    expect(status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('returns 404 for non-existent player', async () => {
    const { status } = await api('GET', '/api/players/non-existent', { auth: false })
    expect(status).toBe(404)
  })

  it('rejects non-host from starting auction', async () => {
    const otherRoom = await prisma.room.create({
      data: {
        name: 'Other Room',
        tournamentId: 'fifa-wc-2026',
        hostId: 'other-user',
        inviteCode: `TEST-OTHER-${Date.now()}`,
        status: 'LOBBY',
        totalBudget: 500,
      },
    })

    const { status, body } = await api('POST', `/api/rooms/${otherRoom.id}/start`)
    expect(status).toBe(403)
    expect(body.error?.code).toBe('NOT_HOST')
  })
})
