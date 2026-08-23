/**
 * Match Routes Tests — MatchMind
 *
 * Tests match/fixture endpoints:
 * - GET /api/matches — returns list of fixtures
 * - GET /api/matches/:id — returns fixture by ID or 404
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Mock openapi registry
vi.mock('../config/openapi', () => ({
  openapiRegistry: { registerPath: vi.fn() },
}))

import matchesRouter from './matches'

function createApp() {
  const app = express()
  app.use(express.json())

  // Mock container middleware
  app.use((req: any, _res, next) => {
    req.container = {
      cradle: {
        matchService: {
          getMatches: vi.fn().mockResolvedValue([
            { id: 'fix-1', homeTeam: 'Team A', awayTeam: 'Team B', status: 'SCHEDULED' },
            { id: 'fix-2', homeTeam: 'Team C', awayTeam: 'Team D', status: 'FINISHED' },
          ]),
          getMatchById: vi.fn().mockImplementation((id: string) => {
            if (id === 'fix-1') {
              return Promise.resolve({ id: 'fix-1', homeTeam: 'Team A', awayTeam: 'Team B', status: 'SCHEDULED' })
            }
            return Promise.resolve(null)
          }),
        },
      },
    }
    next()
  })

  app.use('/api/matches', matchesRouter)
  return app
}

describe('Match Routes', () => {
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    app = createApp()
  })

  it('GET /api/matches returns list of fixtures', async () => {
    const res = await request(app).get('/api/matches')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].id).toBe('fix-1')
  })

  it('GET /api/matches/:id returns fixture by ID', async () => {
    const res = await request(app).get('/api/matches/fix-1')

    expect(res.status).toBe(200)
    expect(res.body.id).toBe('fix-1')
    expect(res.body.homeTeam).toBe('Team A')
  })

  it('GET /api/matches/:id returns 404 for unknown ID', async () => {
    const res = await request(app).get('/api/matches/unknown')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('FIXTURE_NOT_FOUND')
  })
})
