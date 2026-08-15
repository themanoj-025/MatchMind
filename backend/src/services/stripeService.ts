import { DatabaseClient } from '../repositories'
import { env } from '../config/env'
import logger from '../utils/logger'
import type Stripe from 'stripe'

export class StripeService {
  constructor(private opts: { prisma: DatabaseClient }) {}

  async getSubscriptionByUserId(userId: string) {
    return this.opts.prisma.subscription.findUnique({ where: { userId } })
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string) {
    return this.opts.prisma.subscription.findUnique({ where: { stripeSubscriptionId } })
  }

  async upsertSubscription(userId: string, customerId: string, subscriptionId: string, sub: Stripe.Subscription) {
    const item = sub.items.data[0]
    return this.opts.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan: item?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly',
        status: 'ACTIVE',
        currentPeriodStart: new Date((item?.current_period_start ?? sub.created) * 1000),
        currentPeriodEnd: new Date((item?.current_period_end ?? sub.created) * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
      update: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan: item?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly',
        status: 'ACTIVE',
        currentPeriodStart: new Date((item?.current_period_start ?? sub.created) * 1000),
        currentPeriodEnd: new Date((item?.current_period_end ?? sub.created) * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    })
  }

  async updateSubscriptionStatus(subscriptionId: string, sub: Stripe.Subscription) {
    const item = sub.items.data[0]
    return this.opts.prisma.subscription.update({
      where: { stripeSubscriptionId: subscriptionId },
      data: {
        status: sub.status === 'active' ? 'ACTIVE' : sub.status === 'past_due' ? 'PAST_DUE' : 'CANCELLED',
        currentPeriodStart: new Date((item?.current_period_start ?? sub.created) * 1000),
        currentPeriodEnd: new Date((item?.current_period_end ?? sub.created) * 1000),
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
