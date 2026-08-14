import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authenticateToken } from '../middleware/auth'
import { consumeTicket } from '../services/draftTicketService'
import express from 'express'
import request from 'supertest'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only'

describe('Remediation Phase 1 Tests', () => {
  describe('Token Verification Fail-Closed', () => {
    it('should reject authentication if database lookup fails (fail-closed)', async () => {
      const app = express()
      app.use(cookieParser())
      app.use(express.json())

      const prismaMock = {
        user: {
          findUnique: vi.fn().mockRejectedValue(new Error('Database offline')),
        },
      }

      app.use((req: any, _res, next) => {
        req.container = {
          resolve: (key: string) => {
            if (key === 'prisma') {
              return prismaMock
            }
            return null
          },
        }
        next()
      })

      app.get('/test-auth', authenticateToken, (req, res) => {
        res.json({ success: true, userId: req.userId })
      })

      const token = jwt.sign({ userId: 'user-1', tokenVersion: 1 }, process.env.JWT_SECRET!)

      const response = await request(app).get('/test-auth').set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(401)
      expect(response.body.error.code).toBe('TOKEN_REVOKED')
      expect((response.body.error as Error).message).toContain('revoked')
    })
  })

  describe('Atomic Ticket Consumption', () => {
    it('should handle zero balance or failed decrement correctly', async () => {
      const prismaMock = {
        draftTicket: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ticket-1',
            userId: 'user-1',
            tournamentId: 'tour-1',
            remaining: 0,
            resetsAt: new Date(Date.now() + 3600000).toISOString(),
            sourceLog: [],
          }),
          create: vi.fn().mockImplementation((opts) => Promise.resolve(opts.data)),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }

      const result = await consumeTicket(prismaMock, 'user-1', 'tour-1', false)
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.reason).toContain('Free tier')
    })

    it('should deduct ticket atomically when balance is available', async () => {
      const prismaMock = {
        draftTicket: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ticket-1',
            userId: 'user-1',
            tournamentId: 'tour-1',
            remaining: 2,
            resetsAt: new Date(Date.now() + 3600000).toISOString(),
            sourceLog: [],
          }),
          create: vi.fn().mockImplementation((opts) => Promise.resolve(opts.data)),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      }

      // After atomic update, it will findUnique to get the new count. We mock findUnique to return 1 now.
      prismaMock.draftTicket.findUnique = vi.fn().mockResolvedValue({
        id: 'ticket-1',
        userId: 'user-1',
        tournamentId: 'tour-1',
        remaining: 1,
        resetsAt: new Date(Date.now() + 3600000).toISOString(),
        sourceLog: [],
      })

      const result = await consumeTicket(prismaMock, 'user-1', 'tour-1', false)
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(1)
    })
  })
})
