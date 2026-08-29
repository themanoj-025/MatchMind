/**
 * Tournament Routes Tests — MatchMind
 *
 * Tests the read-only tournament endpoints:
 * - GET /api/tournaments (visible = LIVE + ANNOUNCED)
 * - GET /api/tournaments/live
 * - GET /api/tournaments/announced
 * - GET /api/tournaments/:id (single tournament or 404)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// ─── Mock tournaments config ───────────────────────────

const mockTournaments = [
  {
    id: 'fifa-wc-2026',
    name: 'FIFA World Cup 2026',
    sport: 'football',
    status: 'LIVE',
    startDate: '2026-06-11',
    endDate: '2026-07-19',
    draftEnabled: true,
  },
  {
    id: 'ucl-2025-26',
    name: 'UEFA Champions League 2025/26',
    sport: 'football',
    status: 'ANNOUNCED',
    startDate: '2025-09-16',
    endDate: '2026-05-30',
    draftEnabled: false,
  },
  {
    id: 'old-tournament',
    name: 'Past Tournament',
    sport: 'football',
    status: 'FINISHED',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    draftEnabled: false,
  },
]

vi.mock('../config/tournaments', () => ({
  getTournament: (id: string) => mockTournaments.find((t) => t.id === id) || null,
  listLive: () => mockTournaments.filter((t) => t.status === 'LIVE'),
  listAnnounced: () => mockTournaments.filter((t) => t.status === 'ANNOUNCED'),
  listVisible: () => mockTournaments.filter((t) => t.status === 'LIVE' || t.status === 'ANNOUNCED'),
}))

vi.mock('../config/openapi', () => ({
  openapiRegistry: { registerPath: vi.fn() },
}))

// ─── Test App Factory ──────────────────────────────────

async function createTestApp() {
  const app = express()
  const { default: tournamentsRouter } = await import('./tournaments')
  app.use('/api/tournaments', tournamentsRouter)
  return app
}

// ─── Tests ─────────────────────────────────────────────

describe('Tournament Routes', () => {
  describe('GET /api/tournaments', () => {
    it('returns LIVE and ANNOUNCED tournaments', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/tournaments')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body).toHaveLength(2) // fifa-wc-2026 (LIVE) + ucl-2025-26 (ANNOUNCED)
      expect(res.body.map((t: { id: string }) => t.id)).toContain('fifa-wc-2026')
      expect(res.body.map((t: { id: string }) => t.id)).toContain('ucl-2025-26')
      // FINISHED tournament should not be included
      expect(res.body.map((t: { id: string }) => t.id)).not.toContain('old-tournament')
    })
  })

  describe('GET /api/tournaments/live', () => {
    it('returns only LIVE tournaments', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/tournaments/live')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].id).toBe('fifa-wc-2026')
    })
  })

  describe('GET /api/tournaments/announced', () => {
    it('returns only ANNOUNCED tournaments', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/tournaments/announced')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].id).toBe('ucl-2025-26')
    })
  })

  describe('GET /api/tournaments/:id', () => {
    it('returns a single tournament by id', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/tournaments/fifa-wc-2026')

      expect(res.status).toBe(200)
      expect(res.body.id).toBe('fifa-wc-2026')
      expect(res.body.name).toBe('FIFA World Cup 2026')
    })

    it('returns 404 for non-existent tournament', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/tournaments/non-existent')

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('TOURNAMENT_NOT_FOUND')
    })

    it('returns 404 for FINISHED tournament', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/tournaments/old-tournament')

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('TOURNAMENT_NOT_FOUND')
    })
  })
})
