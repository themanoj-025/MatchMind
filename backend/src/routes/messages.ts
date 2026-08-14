import express from 'express'
import { authenticateToken } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { sendMessageSchema } from '../config/schemas'
import type { AuthenticatedRequest } from '../middleware/auth'
import { openapiRegistry } from "../config/openapi";

const router = express.Router()

/**
 * Helper: build a deterministic DM room ID from two user IDs.
 * Always sorted alphabetically so both users share the same room.
 */
function getDMRoomId(a: string, b: string): string {
  return `dm:${[a, b].sort().join(':')}`
}

/**
 * GET /api/messages/conversations
 * List all users the current user has DMed with, with the latest message preview.
 */

openapiRegistry.registerPath({
  method: 'get',
  path: '/conversations',
  responses: { 200: { description: 'Success' } }
})
router.get('/conversations', authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const messageService = (req as any).container.resolve('messageService')
      const userId = req.userId!

      // Get all DM rooms this user is part of
      const messages = await messageService.getUserDMMessages(userId)

      // Group by roomId and get latest message per conversation
      const roomMap = new Map<string, any>()
      for (const msg of messages) {
        if (!roomMap.has(msg.roomId)) {
          const participants = msg.roomId.replace('dm:', '').split(':')
          const otherUserId = participants.find((id: string) => id !== userId) || msg.userId

          roomMap.set(msg.roomId, {
            roomId: msg.roomId,
            otherUserId,
            lastMessage: msg,
            messageCount: 0,
          })
        }
        roomMap.get(msg.roomId)!.messageCount++
      }

      // Fetch user info for conversation partners
      const otherUserIds = [...roomMap.values()].map((c) => c.otherUserId)
      const users = await messageService.getConversationPartners(otherUserIds)
      const userMap = new Map(users.map((u: any) => [u.id, u]))

      // Count unread messages per conversation
      const unreadCounts: Record<string, number> = {}
      for (const msg of messages) {
        if (msg.userId !== userId && !msg.isRead) {
          unreadCounts[msg.roomId] = (unreadCounts[msg.roomId] || 0) + 1
        }
      }

      const conversations = [...roomMap.values()]
        .map((c) => ({
          ...c,
          otherUser: userMap.get(c.otherUserId) || null,
          unreadCount: unreadCounts[c.roomId] || 0,
          lastMessage: {
            id: c.lastMessage.id,
            text: c.lastMessage.text,
            gifUrl: c.lastMessage.gifUrl,
            type: c.lastMessage.type,
            createdAt: c.lastMessage.createdAt,
            isOwn: c.lastMessage.userId === userId,
          },
        }))
        .sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime())

      res.json(conversations)
    })

/**
 * GET /api/messages/:userId
 * Get direct messages between current user and another user.
 */

openapiRegistry.registerPath({
  method: 'get',
  path: '/:userId',
  responses: { 200: { description: 'Success' } }
})
router.get('/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const messageService = (req as any).container.resolve('messageService')
  // @ts-ignore
      const userService = (req as any).container.resolve('userService')
      const { userId: targetUserId } = req.params
      const roomId = getDMRoomId(req.userId!, String(targetUserId))

      // Verify the other user exists
      const otherUser = await userService.getUser(targetUserId)
      if (!otherUser) {
        return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } })
      }

      const messages = await messageService.getDMs(roomId)

      res.json({ messages, otherUser })
    })

/**
 * POST /api/messages/:userId
 * Send a direct message to another user.
 */

openapiRegistry.registerPath({
  method: 'post',
  path: '/:userId',
  request: { body: { content: { 'application/json': { schema: sendMessageSchema } } } },
  responses: { 200: { description: 'Success' } }
})
router.post('/:userId', authenticateToken, validate(sendMessageSchema), async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const messageService = (req as any).container.resolve('messageService')
  // @ts-ignore
      const userService = (req as any).container.resolve('userService')
      const { text, gifUrl } = req.body as { text?: string; gifUrl?: string }
      const { userId: targetUserId } = req.params
      const roomId = getDMRoomId(req.userId!, String(targetUserId))

      // Validate recipient is not self
      if (req.userId === targetUserId) {
        return res.status(400).json({ error: { code: 'SELF_MESSAGE', message: 'Cannot message yourself' } })
      }

      // Verify the recipient exists
      const recipient = await userService.getUser(targetUserId)
      if (!recipient) {
        return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'Recipient not found' } })
      }

      const message = await messageService.sendMessage(roomId, req.userId, text || null, gifUrl || null)

      // Emit real-time event to both users
      const io = req.app.get('io')
      if (io) {
        io.to(`user:${req.userId}`).to(`user:${targetUserId}`).emit('DM_MESSAGE', {
          message,
          roomId,
          fromUserId: req.userId,
        })
      }

      res.status(201).json(message)
    })

/**
 * PATCH /api/messages/read/:userId
 * Mark all messages from a specific user as read.
 */

openapiRegistry.registerPath({
  method: 'patch',
  path: '/read/:userId',
  responses: { 200: { description: 'Success' } }
})
router.patch('/read/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const messageService = (req as any).container.resolve('messageService')
      const { userId: targetUserId } = req.params
      const roomId = getDMRoomId(req.userId!, String(targetUserId))

      await messageService.markAsRead(roomId, targetUserId)

      res.json({ message: 'Marked as read' })
    })

export default router
