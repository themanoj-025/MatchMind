import { DatabaseClient } from '../repositories'

export class MessageService {
  constructor(private opts: { prisma: DatabaseClient }) {}

  async getUserDMMessages(userId: string) {
    return this.opts.prisma.chatMessage.findMany({
      where: {
        roomType: 'dm',
        roomId: { contains: userId },
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatar: true, tier: true },
        },
      },
    })
  }

  async getConversationPartners(userIds: string[]) {
    return this.opts.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, displayName: true, avatar: true, tier: true, isPro: true },
    })
  }

  async getDMs(roomId: string) {
    return this.opts.prisma.chatMessage.findMany({
      where: {
        roomType: 'dm',
        roomId,
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
  }

  async sendMessage(roomId: string, userId: string, text: string | null, gifUrl: string | null) {
    return this.opts.prisma.chatMessage.create({
      data: {
        roomType: 'dm',
        roomId,
        userId,
        text: text?.trim() || null,
        gifUrl: gifUrl || null,
        type: gifUrl ? 'gif' : 'text',
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatar: true, tier: true, isPro: true },
        },
      },
    })
  }

  async markAsRead(roomId: string, targetUserId: string) {
    return this.opts.prisma.chatMessage.updateMany({
      where: {
        roomType: 'dm',
        roomId,
        userId: targetUserId,
        isRead: false,
      },
      data: { isRead: true },
    })
  }
}
