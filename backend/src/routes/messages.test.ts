/**
 * Messages Routes Tests — MatchMind
 *
 * Tests the DM (direct message) endpoints:
 * - GET /api/messages/conversations (list conversations)
 * - GET /api/messages/:roomId (get messages in a room)
 * - POST /api/messages/:roomId (send a message)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only'

// ─── Mock MessageService ───────────────────────────────

const mockMessageService = {
  getUserDMMessages: vi.fn().mockResolvedValue([
    { id: 'msg-1', roomId: 'dm:user-1:user-2', userId: 'user-2', content: 'Hey there!', createdAt: '2026-01-01T10:00:00Z' },
    { id: 'msg-2', roomId: 'dm:user-1:user-2', userId: 'user-1', content: 'Hi!', createdAt: '2026-01-01T10:01:00Z' },
    { id: 'msg-3', roomId: 'dm:user-1:user-3', userId: 'user-3', content: 'Want to trade?', createdAt: '2026-01-01T11:00:00Z' },
  ]),
  getConversationPartners: vi.fn().mockImplementation((ids: string[]) => {
    return Promise.resolve(ids.map((id) => ({ id, username: `user_${id}`, displayName: `User ${id}` })))
  }),
  getRoomMessages: vi.fn().mockResolvedValue([
    { id: 'msg-1', roomId: 'dm:user-1:user-2', userId: 'user-2', content: 'Hey there!', createdAt: '2026-01-01T10:00:00Z' },
    { id: 'msg-2', roomId: 'dm:user-1:user-2', userId: 'user-1', content: 'Hi!', createdAt: '2026-01-01T10:01:00Z' },
  ]),
  sendMessage: vi.fn().mockResolvedValue({ id: 'msg-new', roomId: 'dm:user-1:user-2', userId: 'user-1', content: 'New message', createdAt: '2026-01-01T12:00:00Z' }),
}

vi.mock('../config/openapi', () => ({
  openapiRegistry: { registerPath: vi.fn() },
}))

vi.mock('../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// ─── Helpers ───────────────────────────────────────────

function createAuthToken(userId = 'user-1') {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '1h' })
}

async function createTestApp() {
  const app = express()
  app.use(express.json())

  app.use((req: express.Request & { container?: { cradle: Record<string, unknown> }; userId?: string }, _res, next) => {
    req.container = { cradle: { messageService: mockMessageService } }
    next()
  })

  const { default: messagesRouter } = await import('./messages')
  app.use('/api/messages', messagesRouter)

  return app
}

// ─── Tests ─────────────────────────────────────────────

describe('Messages Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/messages/conversations', () => {
    it('returns grouped conversations with partner info', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      // Should have 2 conversations (user-2 and user-3)
      expect(res.body).toHaveLength(2)
      // Each conversation should have the expected shape
      const conv = res.body.find((c: { otherUserId: string }) => c.otherUserId === 'user-2')
      expect(conv).toBeDefined()
      expect(conv.messageCount).toBe(2)
      expect(conv.lastMessage).toBeDefined()
    })

    it('rejects unauthenticated request', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/messages/conversations')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/messages/:roomId', () => {
    it('returns messages for a room', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .get('/api/messages/dm:user-1:user-2')
        .set('Authorization', `Bearer ${createAuthToken()}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
      expect(mockMessageService.getRoomMessages).toHaveBeenCalledWith('dm:user-1:user-2')
    })

    it('rejects unauthenticated request', async () => {
      const app = await createTestApp()
      const res = await request(app).get('/api/messages/dm:user-1:user-2')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/messages/:roomId', () => {
    it('sends a message', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .post('/api/messages/dm:user-1:user-2')
        .set('Authorization', `Bearer ${createAuthToken()}`)
        .send({ content: 'New message' })

      expect(res.status).toBe(201)
      expect(res.body.id).toBe('msg-new')
      expect(res.body.content).toBe('New message')
      expect(mockMessageService.sendMessage).toHaveBeenCalledWith('dm:user-1:user-2', 'user-1', 'New message')
    })

    it('rejects empty content', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .post('/api/messages/dm:user-1:user-2')
        .set('Authorization', `Bearer ${createAuthToken()}`)
        .send({ content: '' })

      expect(res.status).toBe(400)
    })

    it('rejects missing content', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .post('/api/messages/dm:user-1:user-2')
        .set('Authorization', `Bearer ${createAuthToken()}`)
        .send({})

      expect(res.status).toBe(400)
    })

    it('rejects unauthenticated request', async () => {
      const app = await createTestApp()
      const res = await request(app)
        .post('/api/messages/dm:user-1:user-2')
        .send({ content: 'Hello' })

      expect(res.status).toBe(401)
    })
  })
})
