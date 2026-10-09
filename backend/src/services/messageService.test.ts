/**
 * MessageService Tests — MatchMind
 *
 * Tests MessageService:
 * - getUserDMMessages: returns DM messages for user
 * - getConversationPartners: returns user data for conversation partners
 * - getDMs: returns messages for a DM room
 * - sendMessage: creates a new message
 * - markAsRead: marks messages as read
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MessageService } from './messageService'

function createMockPrisma() {
  return {
    chatMessage: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  }
}

describe('MessageService', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let service: MessageService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = createMockPrisma()
    service = new MessageService({ prisma: prisma as never })
  })

  describe('getUserDMMessages', () => {
    it('returns DM messages for user', async () => {
      const mockMessages = [
        { id: 'msg-1', text: 'Hello', roomId: 'dm-user1-user2', userId: 'user-2' },
        { id: 'msg-2', text: 'Hi there', roomId: 'dm-user1-user2', userId: 'user-1' },
      ]
      prisma.chatMessage.findMany = vi.fn().mockResolvedValue(mockMessages)

      const result = await service.getUserDMMessages('user-1')

      expect(result).toEqual(mockMessages)
      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: {
          roomType: 'dm',
          roomId: { contains: 'user-1' },
          isDeleted: false,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatar: true, tier: true },
          },
        },
      })
    })
  })

  describe('getConversationPartners', () => {
    it('returns user data for given IDs', async () => {
      const mockUsers = [
        { id: 'user-1', username: 'alice', displayName: 'Alice', avatar: null, tier: 'GOLD', isPro: true },
        { id: 'user-2', username: 'bob', displayName: 'Bob', avatar: null, tier: 'BRONZE', isPro: false },
      ]
      prisma.user.findMany = vi.fn().mockResolvedValue(mockUsers)

      const result = await service.getConversationPartners(['user-1', 'user-2'])

      expect(result).toEqual(mockUsers)
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['user-1', 'user-2'] } },
        select: { id: true, username: true, displayName: true, avatar: true, tier: true, isPro: true },
      })
    })
  })

  describe('getDMs', () => {
    it('returns messages for a DM room', async () => {
      const mockMessages = [
        { id: 'msg-1', text: 'Hello', createdAt: new Date('2026-01-01') },
        { id: 'msg-2', text: 'Hi', createdAt: new Date('2026-01-02') },
      ]
      prisma.chatMessage.findMany = vi.fn().mockResolvedValue(mockMessages)

      const result = await service.getDMs('dm-room-1')

      expect(result).toEqual(mockMessages)
      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: {
          roomType: 'dm',
          roomId: 'dm-room-1',
          isDeleted: false,
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatar: true, tier: true },
          },
        },
      })
    })
  })

  describe('sendMessage', () => {
    it('creates a text message', async () => {
      const mockMessage = {
        id: 'msg-new',
        text: 'Hello world',
        type: 'text',
        userId: 'user-1',
      }
      prisma.chatMessage.create = vi.fn().mockResolvedValue(mockMessage)

      const result = await service.sendMessage('dm-room-1', 'user-1', 'Hello world', null)

      expect(result).toEqual(mockMessage)
      expect(prisma.chatMessage.create).toHaveBeenCalledWith({
        data: {
          roomType: 'dm',
          roomId: 'dm-room-1',
          userId: 'user-1',
          text: 'Hello world',
          gifUrl: null,
          type: 'text',
        },
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatar: true, tier: true, isPro: true },
          },
        },
      })
    })

    it('creates a GIF message', async () => {
      const mockMessage = {
        id: 'msg-gif',
        text: null,
        gifUrl: 'https://media.giphy.com/gif123',
        type: 'gif',
      }
      prisma.chatMessage.create = vi.fn().mockResolvedValue(mockMessage)

      const result = await service.sendMessage('dm-room-1', 'user-1', null, 'https://media.giphy.com/gif123')

      expect(result.type).toBe('gif')
      expect(prisma.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gifUrl: 'https://media.giphy.com/gif123',
            type: 'gif',
          }),
        }),
      )
    })

    it('trims whitespace from text', async () => {
      prisma.chatMessage.create = vi.fn().mockResolvedValue({})

      await service.sendMessage('dm-room-1', 'user-1', '  Hello  ', null)

      expect(prisma.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ text: 'Hello' }),
        }),
      )
    })
  })

  describe('markAsRead', () => {
    it('marks messages as read', async () => {
      prisma.chatMessage.updateMany = vi.fn().mockResolvedValue({ count: 3 })

      const result = await service.markAsRead('dm-room-1', 'user-2')

      expect(result.count).toBe(3)
      expect(prisma.chatMessage.updateMany).toHaveBeenCalledWith({
        where: {
          roomType: 'dm',
          roomId: 'dm-room-1',
          userId: 'user-2',
          isRead: false,
        },
        data: { isRead: true },
      })
    })
  })
})
