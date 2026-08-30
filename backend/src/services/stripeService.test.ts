import Stripe from 'stripe'
/**
 * StripeService Tests — MatchMind
 *
 * Tests StripeService:
 * - getSubscriptionByUserId: lookup by user
 * - getSubscriptionByStripeId: lookup by Stripe ID
 * - upsertSubscription: create or update subscription
 * - updateSubscriptionStatus: update status from Stripe event
 * - cancelSubscription: mark subscription as cancelled
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StripeService } from './stripeService'
import type { DatabaseClient } from '../repositories'

function createMockPrisma(overrides: Record<string, unknown> = {}): DatabaseClient {
  return {
    subscription: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  } as unknown as DatabaseClient
}

function createMockStripeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_123',
    status: 'active',
    cancel_at_period_end: false,
    created: Math.floor(Date.now() / 1000),
    items: {
      data: [
        {
          price: { recurring: { interval: 'month' } },
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        },
      ],
    },
    ...overrides,
  }
}

describe('StripeService', () => {
  let service: StripeService
  let prisma: DatabaseClient

  beforeEach(() => {
    prisma = createMockPrisma()
    service = new StripeService({ prisma })
  })

  describe('getSubscriptionByUserId', () => {
    it('should find subscription by userId', async () => {
      const mockSub = { id: 'sub-1', userId: 'user-1', status: 'ACTIVE' }
      const mockPrisma = createMockPrisma({
        subscription: {
          findUnique: vi.fn().mockResolvedValue(mockSub),
          upsert: vi.fn(),
          update: vi.fn(),
        },
      })
      const svc = new StripeService({ prisma: mockPrisma })

      const result = await svc.getSubscriptionByUserId('user-1')

      expect(result).toEqual(mockSub)
    })

    it('should return null when no subscription found', async () => {
      const result = await service.getSubscriptionByUserId('user-nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('getSubscriptionByStripeId', () => {
    it('should find subscription by Stripe subscription ID', async () => {
      const mockSub = { id: 'sub-1', stripeSubscriptionId: 'sub_stripe_123', status: 'ACTIVE' }
      const mockPrisma = createMockPrisma({
        subscription: {
          findUnique: vi.fn().mockResolvedValue(mockSub),
          upsert: vi.fn(),
          update: vi.fn(),
        },
      })
      const svc = new StripeService({ prisma: mockPrisma })

      const result = await svc.getSubscriptionByStripeId('sub_stripe_123')

      expect(result).toEqual(mockSub)
    })
  })

  describe('upsertSubscription', () => {
    it('should upsert a subscription', async () => {
      const mockPrisma = createMockPrisma({
        subscription: {
          findUnique: vi.fn(),
          upsert: vi.fn().mockResolvedValue({ id: 'sub-1' }),
          update: vi.fn(),
        },
      })
      const svc = new StripeService({ prisma: mockPrisma })
      const sub = createMockStripeSub()

      await svc.upsertSubscription('user-1', 'cus_123', 'sub_123', sub as unknown as Stripe.Subscription)

      expect(mockPrisma.subscription.upsert).toHaveBeenCalled()
    })

    it('should map monthly interval correctly', async () => {
      const mockPrisma = createMockPrisma({
        subscription: {
          findUnique: vi.fn(),
          upsert: vi.fn().mockResolvedValue({}),
          update: vi.fn(),
        },
      })
      const svc = new StripeService({ prisma: mockPrisma })
      const sub = createMockStripeSub()

      await svc.upsertSubscription('user-1', 'cus_123', 'sub_123', sub as unknown as Stripe.Subscription)

      const callArgs = (mockPrisma.subscription.upsert as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(callArgs.create.plan).toBe('monthly')
    })

    it('should map annual interval correctly', async () => {
      const mockPrisma = createMockPrisma({
        subscription: {
          findUnique: vi.fn(),
          upsert: vi.fn().mockResolvedValue({}),
          update: vi.fn(),
        },
      })
      const svc = new StripeService({ prisma: mockPrisma })
      const sub = createMockStripeSub({
        items: {
          data: [
            {
              price: { recurring: { interval: 'year' } },
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 365 * 86400,
            },
          ],
        },
      })

      await svc.upsertSubscription('user-1', 'cus_123', 'sub_123', sub as unknown as Stripe.Subscription)

      const callArgs = (mockPrisma.subscription.upsert as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(callArgs.create.plan).toBe('annual')
    })
  })

  describe('updateSubscriptionStatus', () => {
    it('should update status to ACTIVE for active subscription', async () => {
      const mockPrisma = createMockPrisma({
        subscription: {
          findUnique: vi.fn(),
          upsert: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
        },
      })
      const svc = new StripeService({ prisma: mockPrisma })
      const sub = createMockStripeSub({ status: 'active' })

      await svc.updateSubscriptionStatus('sub_stripe_123', sub as unknown as Stripe.Subscription)

      const callArgs = (mockPrisma.subscription.update as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(callArgs.data.status).toBe('ACTIVE')
    })

    it('should update status to PAST_DUE for past_due subscription', async () => {
      const mockPrisma = createMockPrisma({
        subscription: {
          findUnique: vi.fn(),
          upsert: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
        },
      })
      const svc = new StripeService({ prisma: mockPrisma })
      const sub = createMockStripeSub({ status: 'past_due' })

      await svc.updateSubscriptionStatus('sub_stripe_123', sub as unknown as Stripe.Subscription)

      const callArgs = (mockPrisma.subscription.update as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(callArgs.data.status).toBe('PAST_DUE')
    })

    it('should update status to CANCELLED for other statuses', async () => {
      const mockPrisma = createMockPrisma({
        subscription: {
          findUnique: vi.fn(),
          upsert: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
        },
      })
      const svc = new StripeService({ prisma: mockPrisma })
      const sub = createMockStripeSub({ status: 'canceled' })

      await svc.updateSubscriptionStatus('sub_stripe_123', sub as unknown as Stripe.Subscription)

      const callArgs = (mockPrisma.subscription.update as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(callArgs.data.status).toBe('CANCELLED')
    })

    it('should set cancelAtPeriodEnd from Stripe event', async () => {
      const mockPrisma = createMockPrisma({
        subscription: {
          findUnique: vi.fn(),
          upsert: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
        },
      })
      const svc = new StripeService({ prisma: mockPrisma })
      const sub = createMockStripeSub({ cancel_at_period_end: true })

      await svc.updateSubscriptionStatus('sub_stripe_123', sub as unknown as Stripe.Subscription)

      const callArgs = (mockPrisma.subscription.update as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(callArgs.data.cancelAtPeriodEnd).toBe(true)
    })
  })

  describe('cancelSubscription', () => {
    it('should mark subscription as cancelled', async () => {
      const mockPrisma = createMockPrisma({
        subscription: {
          findUnique: vi.fn(),
          upsert: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
        },
      })
      const svc = new StripeService({ prisma: mockPrisma })

      await svc.cancelSubscription('sub_stripe_123')

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_stripe_123' },
        data: { status: 'CANCELLED', cancelAtPeriodEnd: true },
      })
    })
  })
})
