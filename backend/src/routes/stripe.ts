import { env } from '../config/env'
import express from 'express'
import { authenticateToken } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createCheckoutSchema } from '../config/schemas'
import { withBreaker } from '../middleware/circuitBreaker'
import logger from '../utils/logger'
import type { AuthenticatedRequest } from '../middleware/auth'
import { idempotent } from '../middleware/idempotency'
import { openapiRegistry } from "../config/openapi";

const router = express.Router()

/**
 * POST /api/stripe/create-checkout
 * Creates a Stripe Checkout Session for Pro subscription
 */

openapiRegistry.registerPath({
  method: 'post',
  path: '/create-checkout',
  request: { body: { content: { 'application/json': { schema: createCheckoutSchema } } } },
  responses: { 200: { description: 'Success' } }
})
router.post('/create-checkout', idempotent(), authenticateToken, validate(createCheckoutSchema), async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const stripeService = (req as any).container.resolve('stripeService')
  // @ts-ignore
      const userService = (req as any).container.resolve('userService')
      const { plan } = req.body as { plan: string } // 'monthly' | 'annual'

      const user = await userService.getUser(req.userId)
      if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } })

      // If user already has a Stripe customer, reuse it
      const existingSub = await stripeService.getSubscriptionByUserId(user.id)

      // Use circuit breaker for Stripe API calls
      const session = await withBreaker('stripe', async () => {
        let stripe: any
        try {
          stripe = require('stripe')(env.STRIPE_SECRET_KEY)
        } catch {
          logger.info({ event: 'stripe.not_configured', userId: req.userId }, 'Stripe API key not configured, returning mock URL')
          return null
        }

        const priceId = plan === 'annual'
          ? env.STRIPE_PRICE_ANNUAL
          : env.STRIPE_PRICE_MONTHLY

        if (!priceId) {
          throw new Error('Stripe price ID not configured')
        }

        const checkoutSession = await stripe.checkout.sessions.create({
          customer: existingSub?.stripeCustomerId || undefined,
          customer_email: existingSub ? undefined : user.email,
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${env.FRONTEND_URL || 'http://localhost:3000'}/profile/me/settings?pro=activated`,
          cancel_url: `${env.FRONTEND_URL || 'http://localhost:3000'}/pricing?cancelled=true`,
          metadata: { userId: user.id },
          ...(existingSub?.stripeCustomerId ? {} : {
            customer_creation: 'always',
          }),
        })

        return checkoutSession
      })

      if (!session) {
        return res.status(503).json({
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Payment service is temporarily unavailable. Please try again later.' },
        })
      }

      res.json({ url: session.url })
    })

/**
 * POST /api/stripe/webhook
 * Stripe webhook handler — listens for subscription lifecycle events
 */

openapiRegistry.registerPath({
  method: 'post',
  path: '/webhook',
  responses: { 200: { description: 'Success' } }
})
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string
  let event: any

  try {
    const stripe = require('stripe')(env.STRIPE_SECRET_KEY)
    const body = Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body)
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    logger.error({ event: 'stripe.webhook_verification_failed', err: (err as Error).message }, 'Stripe webhook signature verification failed')
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`)
  }

  // @ts-ignore
  const stripeService = (req as any).container.resolve('stripeService')
  // @ts-ignore
  const userService = (req as any).container.resolve('userService')

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const userId = session.metadata?.userId
      if (!userId) break

      const subscriptionId = session.subscription
      const customerId = session.customer

      if (subscriptionId && customerId) {
        try {
          const stripe = require('stripe')(env.STRIPE_SECRET_KEY)
          const sub = await stripe.subscriptions.retrieve(subscriptionId)

          await stripeService.upsertSubscription(userId, customerId, subscriptionId, sub)

          await userService.updateUser(userId, {
            isPro: true,
            proExpiresAt: new Date(sub.current_period_end * 1000),
          })
        } catch (err: any) {
          logger.error({ event: 'stripe.subscription_creation_failed', err: (err as Error).message }, 'Failed to process subscription')
        }
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object
      const subscriptionId = sub.id

      try {
        const existing = await stripeService.getSubscriptionByStripeId(subscriptionId)
        if (!existing) break

        await stripeService.updateSubscriptionStatus(subscriptionId, sub)

        if (sub.status === 'active') {
          await userService.updateUser(existing.userId, {
            isPro: true,
            proExpiresAt: new Date(sub.current_period_end * 1000),
          })
        } else if (sub.status === 'past_due' || sub.status === 'canceled' || sub.status === 'unpaid') {
          await userService.updateUser(existing.userId, {
            isPro: false,
            proExpiresAt: null,
          })
        }
      } catch (err: any) {
        logger.error({ event: 'stripe.subscription_update_failed', err: (err as Error).message }, 'Subscription update failed')
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const subscriptionId = sub.id

      try {
        const existing = await stripeService.getSubscriptionByStripeId(subscriptionId)
        if (!existing) break

        await stripeService.cancelSubscription(subscriptionId)

        await userService.updateUser(existing.userId, {
          isPro: false,
          proExpiresAt: null,
        })
      } catch (err: any) {
        logger.error({ event: 'stripe.subscription_deletion_failed', err: (err as Error).message }, 'Subscription deletion failed')
      }
      break
    }

    default:
      logger.warn({ event: 'stripe.unhandled_event', eventType: event.type }, `Unhandled event type ${event.type}`)
  }

  res.json({ received: true })
})

/**
 * POST /api/stripe/create-portal-session
 * Creates a Stripe Customer Portal session for managing billing
 */

openapiRegistry.registerPath({
  method: 'post',
  path: '/create-portal-session',
  responses: { 200: { description: 'Success' } }
})
router.post('/create-portal-session', authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const stripeService = (req as any).container.resolve('stripeService')
      const sub = await stripeService.getSubscriptionByUserId(req.userId)

      if (!sub?.stripeCustomerId) {
        return res.status(400).json({ error: { code: 'NO_SUBSCRIPTION', message: 'No active subscription found' } })
      }

      let stripe: any
      try {
        stripe = require('stripe')(env.STRIPE_SECRET_KEY)
      } catch {
        return res.json({ url: `${env.FRONTEND_URL || 'http://localhost:3000'}/pricing` })
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${env.FRONTEND_URL || 'http://localhost:3000'}/profile/me/settings`,
      })

      res.json({ url: portalSession.url })
    })

/**
 * GET /api/stripe/status
 * Returns the current user's subscription status
 */

openapiRegistry.registerPath({
  method: 'get',
  path: '/status',
  responses: { 200: { description: 'Success' } }
})
router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const stripeService = (req as any).container.resolve('stripeService')
  // @ts-ignore
      const userService = (req as any).container.resolve('userService')

      const user = await userService.getUser(req.userId)
      const sub = await stripeService.getSubscriptionByUserId(req.userId)

      if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } })

      res.json({
        isPro: user.isPro,
        proExpiresAt: user.proExpiresAt,
        subscription: sub
          ? {
              plan: sub.plan,
              status: sub.status,
              currentPeriodEnd: sub.currentPeriodEnd,
              cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            }
          : null,
      })
    })

export default router
