/**
 * API Route Validation Tests (audit 9.1 / 9.2)
 *
 * Unit tests (supertest, mocked container — no DB/Redis) for route behavior
 * that had no coverage:
 *   - GET /api/players     → 200 + cache wiring (route file previously untested)
 *   - GET /api/admin/users → admin gating + pagination + safeParse 400s
 *
 * The safeParse migration (audit 9.2) turns malformed query input into a
 * 400 VALIDATION_ERROR (DomainError) instead of an unhandled ZodError → 500.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only'

import playersRouter from '../routes/players'
import adminRouter from '../routes/admin'

type Cradle = Record<string, unknown>

function mount(router: express.Router, cradle: Cradle, mountPath: string) {
  const app = express()
  app.use(express.json())
  app.use((req: Request, _res: Response, next: NextFunction) => {
    ;(req as Request & { container: { cradle: Cradle } }).container = { cradle }
    next()
  })
  app.use(mountPath, router)
  // Mirror app.ts: DomainError → 400 with the standard error envelope.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const isDomain = (err as { name?: string }).name === 'DomainError'
    const status = isDomain ? ((err as { statusCode?: number }).statusCode ?? 400) : 500
    res.status(status).json({
      error: {
        code: isDomain ? ((err as { code?: string }).code ?? 'DOMAIN_ERROR') : 'INTERNAL_SERVER_ERROR',
        message: (err as Error).message,
      },
    })
  })
  return app
}

function signToken(userId: string, tokenVersion = 0): string {
  return jwt.sign({ userId, tokenVersion }, process.env.JWT_SECRET!, { expiresIn: '1h' })
}

// ─── GET /api/players ────────────────────────────────────────────────
describe('GET /api/players (previously untested route)', () => {
  let cradle: Cradle

  beforeEach(() => {
    vi.clearAllMocks()
    cradle = {
      prisma: {
        player: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
        },
      },
      cacheService: {
        getOrFetch: vi.fn().mockImplementation((_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
        get: vi.fn().mockResolvedValue(null),
      },
    }
  })

  it('returns 200 with an empty list', async () => {
    const app = mount(playersRouter, cradle, '/api/players')
    const res = await request(app).get('/api/players')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ data: [], hasMore: false })
  })

  it('routes list reads through the cache service', async () => {
    const app = mount(playersRouter, cradle, '/api/players')
    await request(app).get('/api/players')
    expect(cradle.cacheService.getOrFetch).toHaveBeenCalled()
  })

  it('rejects a malformed cursor with 400 VALIDATION_ERROR (safeParse, not 500)', async () => {
    const app = mount(playersRouter, cradle, '/api/players')
    const res = await request(app).get('/api/players?take=not-a-number')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── GET /api/admin/users ────────────────────────────────────────────
describe('GET /api/admin/users (previously untested route)', () => {
  interface AdminCradle extends Cradle {
    prisma: {
      user: {
        findUnique: ReturnType<typeof vi.fn>
        findMany: ReturnType<typeof vi.fn>
        count: ReturnType<typeof vi.fn>
      }
      room?: { count: ReturnType<typeof vi.fn> }
    }
  }

  let cradle: AdminCradle

  beforeEach(() => {
    vi.clearAllMocks()
    cradle = {
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValue({ role: 'ADMIN' }),
          findMany: vi.fn().mockResolvedValue([{ id: 'u1', username: 'admin' }]),
          count: vi.fn().mockResolvedValue(1),
        },
      },
    }
  })

  function adminApp() {
    return mount(adminRouter, cradle as unknown as Cradle, '/api/admin')
  }

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(adminApp()).get('/api/admin/users')
    expect(res.status).toBe(401)
  })

  it('rejects non-admin users with 403 (requireAdmin)', async () => {
    cradle.prisma.user.findUnique.mockResolvedValue({ role: 'USER' })
    const res = await request(adminApp())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${signToken('u1')}`)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('returns a paginated user list for admins', async () => {
    const res = await request(adminApp())
      .get('/api/admin/users?page=2&limit=25')
      .set('Authorization', `Bearer ${signToken('u1')}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ users: [{ id: 'u1' }], total: 1, page: 2 })
    expect(cradle.prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 25, take: 25 }))
  })

  it('returns 400 VALIDATION_ERROR for a non-numeric page (safeParse)', async () => {
    const res = await request(adminApp())
      .get('/api/admin/users?page=banana')
      .set('Authorization', `Bearer ${signToken('u1')}`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})
