import { DatabaseClient } from '../repositories'
import { env } from '../config/env'
import logger from '../utils/logger'

export class StripeService {
  constructor(private opts: { prisma: DatabaseClient }) {}

  async getSubscriptionByUserId(userId: string) {
    return this.opts.prisma.subscription.findUnique({ where: { userId } })
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string) {
    return this.opts.prisma.subscription.findUnique({ where: { stripeSubscriptionId } })
  }

  async upsertSubscription(userId: string, customerId: string, subscriptionId: string, sub: any) {
    return this.opts.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan: sub.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly',
        status: 'ACTIVE',
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
      update: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan: sub.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly',
        status: 'ACTIVE',
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    })
  }

  async updateSubscriptionStatus(subscriptionId: string, sub: any) {
    return this.opts.prisma.subscription.update({
      where: { stripeSubscriptionId: subscriptionId },
      data: {
        status: sub.status === 'active' ? 'ACTIVE' : sub.status === 'past_due' ? 'PAST_DUE' : 'CANCELLED',
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    })
  }

  async cancelSubscription(subscriptionId: string) {
    return this.opts.prisma.subscription.update({
      where: { stripeSubscriptionId: subscriptionId },
      data: { status: 'CANCELLED', cancelAtPeriodEnd: true },
    })
  }
}
