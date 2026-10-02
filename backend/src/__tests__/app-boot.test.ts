/**
 * App Boot Smoke Test (audit 9.1)
 *
 * Imports the real src/app (the same thing `server.ts` mounts) and asserts
 * that the full middleware + route stack constructs without crashing, and
 * that infrastructure endpoints answer. This is the "does the app even boot"
 * net that previously did not exist.
 */
import { describe, it, expect } from 'vitest'
import request from 'supertest'

// Must be set BEFORE importing src/app: app.ts fails fast on identical JWT
// secrets, and env.ts validates the schema at import time.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-64-chars-minimum-for-testing-purposes-only'
process.env.JWT_RESET_SECRET = 'test-reset-secret-64-chars-minimum-for-testing-purposes-only'
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380'

// Import after env setup (side-effectful module: builds middleware + routes).
import { app } from '../app'

describe('app boot smoke', () => {
  it('constructs an Express app and answers a request end-to-end', async () => {
    // Behavioral smoke: the real app object builds its full middleware/route
    // stack (CORS, Helmet, compression, DI scope, rate limiter, routes) and
    // completes a request round-trip. Intentionally framework-version agnostic:
    // Express 5 hides router internals, so we assert behavior, not structure.
    expect(app).toBeDefined()
    expect(typeof app.use).toBe('function')
    const res = await request(app).get('/openapi.json')
    expect(res.status).toBe(200)
  })

  it('serves the OpenAPI document on GET /openapi.json', async () => {
    const res = await request(app).get('/openapi.json')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('openapi')
    expect(res.body).toHaveProperty('paths')
  })

  it('exposes the Prometheus metrics endpoint', async () => {
    const res = await request(app).get('/api/metrics')
    expect(res.status).toBe(200)
    expect(res.text).toContain('# ')
  })

  it('answers unknown API routes with a well-formed 404 JSON shape', async () => {
    const res = await request(app).get('/api/v1/definitely-not-a-route')
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toContain('application/json')
  })
})
