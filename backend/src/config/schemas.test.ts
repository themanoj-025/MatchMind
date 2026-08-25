import { describe, it, expect } from 'vitest'
import {
  signupSchema,
  loginSchema,
  createRoomSchema,
  joinRoomSchema,
  sendMessageSchema,
  searchQuerySchema,
  paginationQuerySchema,
  draftStartSchema,
  draftPickSchema,
  enterRunSchema,
} from './schemas'

describe('signupSchema', () => {
  it('accepts valid signup data', () => {
    const result = signupSchema.safeParse({
      username: 'alice123',
      email: 'alice@example.com',
      password: 'securepass123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = signupSchema.safeParse({
      username: 'alice',
      email: 'not-an-email',
      password: 'securepass123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short password', () => {
    const result = signupSchema.safeParse({
      username: 'alice',
      email: 'alice@example.com',
      password: 'short',
    })
    expect(result.success).toBe(false)
  })

  it('rejects username with special chars', () => {
    const result = signupSchema.safeParse({
      username: 'alice@123',
      email: 'alice@example.com',
      password: 'securepass123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects extra fields (strict)', () => {
    const result = signupSchema.safeParse({
      username: 'alice',
      email: 'alice@example.com',
      password: 'securepass123',
      extra: 'field',
    })
    expect(result.success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('accepts valid login', () => {
    const result = loginSchema.safeParse({
      email: 'alice@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'alice@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('createRoomSchema', () => {
  it('accepts valid room data', () => {
    const result = createRoomSchema.safeParse({
      name: 'My Room',
      tournamentId: 'fifa-wc-2026',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createRoomSchema.safeParse({
      name: '',
      tournamentId: 'fifa-wc-2026',
    })
    expect(result.success).toBe(false)
  })
})

describe('joinRoomSchema', () => {
  it('accepts valid invite code (8 chars)', () => {
    const result = joinRoomSchema.safeParse({ inviteCode: 'ABCDEFGH' })
    expect(result.success).toBe(true)
  })

  it('rejects short invite code', () => {
    const result = joinRoomSchema.safeParse({ inviteCode: 'ABC' })
    expect(result.success).toBe(false)
  })
})

describe('sendMessageSchema', () => {
  it('accepts a text message', () => {
    const result = sendMessageSchema.safeParse({ text: 'Hello!' })
    expect(result.success).toBe(true)
  })

  it('accepts a gif URL', () => {
    const result = sendMessageSchema.safeParse({ gifUrl: 'https://example.com/fun.gif' })
    expect(result.success).toBe(true)
  })

  it('rejects empty text without gif', () => {
    const result = sendMessageSchema.safeParse({ text: '' })
    expect(result.success).toBe(false)
  })
})

describe('searchQuerySchema', () => {
  it('accepts valid search query', () => {
    const result = searchQuerySchema.safeParse({ q: 'hello' })
    expect(result.success).toBe(true)
  })

  it('rejects single char query', () => {
    const result = searchQuerySchema.safeParse({ q: 'a' })
    expect(result.success).toBe(false)
  })
})

describe('paginationQuerySchema', () => {
  it('applies defaults', () => {
    const result = paginationQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it('coerces string numbers', () => {
    const result = paginationQuerySchema.safeParse({ page: '3', limit: '50' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(50)
    }
  })

  it('rejects limit > 100', () => {
    const result = paginationQuerySchema.safeParse({ limit: '200' })
    expect(result.success).toBe(false)
  })
})

describe('draftStartSchema', () => {
  it('accepts valid draft start', () => {
    const result = draftStartSchema.safeParse({
      tournamentId: 'fifa-wc-2026',
      formation: '4-3-3',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid formation', () => {
    const result = draftStartSchema.safeParse({
      tournamentId: 'fifa-wc-2026',
      formation: '2-2-2',
    })
    expect(result.success).toBe(false)
  })
})

describe('draftPickSchema', () => {
  it('accepts valid pick', () => {
    const result = draftPickSchema.safeParse({
      slotIndex: 0,
      pickedPlayerId: 'player-123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative slot index', () => {
    const result = draftPickSchema.safeParse({
      slotIndex: -1,
      pickedPlayerId: 'player-123',
    })
    expect(result.success).toBe(false)
  })
})

describe('enterRunSchema', () => {
  it('accepts valid session ID', () => {
    const result = enterRunSchema.safeParse({ sessionId: 'session-abc' })
    expect(result.success).toBe(true)
  })

  it('rejects empty session ID', () => {
    const result = enterRunSchema.safeParse({ sessionId: '' })
    expect(result.success).toBe(false)
  })
})
