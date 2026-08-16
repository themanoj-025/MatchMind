import { env } from '../config/env'
import express from 'express'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createCheckoutSchema } from '../config/schemas'
import { withBreaker } from '../middleware/circuitBreaker'
import logger from '../utils/logger'
import { idempotent } from '../middleware/idempotency'
import { openapiRegistry } from '../config/openapi'
import type Stripe from 'stripe'
const router = express.Router()
function loadStripe(): Stripe | null {
  try {
    return require('stripe')(env.STRIPE_SECRET_KEY) as Stripe
  } catch {
    return null
  }
}
/**
 * POST /api/stripe/create-checkout
 * Creates a Stripe Checkout Session for Pro subscription
 */
openapiRegistry.registerPath({
  method: 'post',
  path: '/create-checkout',
  request: { body: { content: { 'application/json': { schema: createCheckoutSchema } } } },
  responses: { 200: { description: 'Success' } },
})
router.post(
  '/create-checkout',
  idempotent(),
  authenticateToken,
  validate(createCheckoutSchema),
  async (req: AuthenticatedRequest, res) => {
    const stripeService = req.container.cradle.stripeService
    const userService = req.container.cradle.userService
    const { plan } = req.body as { plan: string } // 'monthly' | 'annual'
    const user = await userService.getUser(req.userId!)
    if (!user) {return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } })}
    // If user already has a Stripe customer, reuse it
    const existingSub = await stripeService.getSubscriptionByUserId(user.id)
    // Use circuit breaker for Stripe API calls
    const session = await withBreaker('stripe', async () => {
      const stripe = loadStripe()
      if (!stripe) {
        logger.info(
          { event: 'stripe.not_configured', userId: req.userId },
          'Stripe API key not configured, returning mock URL',
        )
        return null
      }
      const priceId = plan === 'annual' ? env.STRIPE_PRICE_ANNUAL : env.STRIPE_PRICE_MONTHLY
      if (!priceId) {
        throw new Error('Stripe price ID not configured')
      }
      const email = await customerEmailFor(req.container.cradle.prisma, user, existingSub)
      const checkoutSession = await stripe.checkout.sessions.create({
        customer: existingSub?.stripeCustomerId || undefined,
        customer_email: email,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${env.FRONTEND_URL || 'http://localhost:3000'}/profile/me/settings?pro=activated`,
        cancel_url: `${env.FRONTEND_URL || 'http://localhost:3000'}/pricing?cancelled=true`,
        metadata: { userId: user.id },
        ...(existingSub?.stripeCustomerId
          ? {}
          : {
              customer_creation: 'always',
            }),
      })
      return checkoutSession
    })
    if (!session) {
      return res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Payment service is temporarily unavailable. Please try again later.',
        },
      })
    }
    return res.json({ url: session.url })
  },
)
/**
 * POST /api/stripe/webhook
 * Stripe webhook handler — listens for subscription lifecycle events
 */
openapiRegistry.registerPath({
  method: 'post',
  path: '/webhook',
  responses: { 200: { description: 'Success' } },
})
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string | undefined
  let event: Stripe.Event
  try {
    const stripe = loadStripe()
    if (!stripe) {
      return res.status(400).send('Webhook Error: Stripe not configured')
    }
    if (!sig) {
      return res.status(400).send('Webhook Error: Missing stripe-signature header')
    }
    if (!env.STRIPE_WEBHOOK_SECRET) {
      return res.status(400).send('Webhook Error: Stripe webhook secret not configured')
    }
    const body = Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body)
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET)
  } catch (err: unknown) {
    logger.error(
      { event: 'stripe.webhook_verification_failed', err: (err as Error).message },
      'Stripe webhook signature verification failed',
    )
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`)
  }
  const stripeService = req.container.cradle.stripeService
  const userService = req.container.cradle.userService
  const services: WebhookServices = { stripeService, userService }
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event, services)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event, services)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event, services)
      break
    default:
      logger.warn({ event: 'stripe.unhandled_event', eventType: event.type }, `Unhandled event type ${event.type}`)
  }
  return res.json({ received: true })
})
/**
 * POST /api/stripe/create-portal-session
 * Creates a Stripe Customer Portal session for managing billing
 */
openapiRegistry.registerPath({
  method: 'post',
  path: '/create-portal-session',
  responses: { 200: { description: 'Success' } },
})
router.post('/create-portal-session', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const stripeService = req.container.cradle.stripeService
  const sub = await stripeService.getSubscriptionByUserId(req.userId!)
  if (!sub?.stripeCustomerId) {
    return res.status(400).json({ error: { code: 'NO_SUBSCRIPTION', message: 'No active subscription found' } })
  }
  const stripe = loadStripe()
  if (!stripe) {
    return res.json({ url: `${env.FRONTEND_URL || 'http://localhost:3000'}/pricing` })
  }
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${env.FRONTEND_URL || 'http://localhost:3000'}/profile/me/settings`,
  })
  return res.json({ url: portalSession.url })
})
/**
 * GET /api/stripe/status
 * Returns the current user's subscription status
 */
openapiRegistry.registerPath({
  method: 'get',
  path: '/status',
  responses: { 200: { description: 'Success' } },
})
router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const stripeService = req.container.cradle.stripeService
  const userService = req.container.cradle.userService
  const user = await userService.getUser(req.userId!)
  const sub = await stripeService.getSubscriptionByUserId(req.userId!)
  if (!user) {return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } })}
  return res.json({
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
async function customerEmailFor(
  prisma: { user: { findUnique: (args: { where: { id: string }; select: { email: true } }) => Promise<{ email: string | null } | null> } },
  user: { id: string },
  existingSub: { stripeCustomerId?: string | null } | null | undefined,
): Promise<string | undefined> {
  // If user already has a Stripe customer, reuse it — no email needed
  if (existingSub) {
    return undefined
  }
  return (await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } }))?.email || undefined
}

function isValidCheckoutRefs(subscriptionId: unknown, customerId: unknown): boolean {
  return Boolean(subscriptionId && customerId && typeof subscriptionId === 'string' && typeof customerId === 'string')
}

async function fetchSubscriptionOrEmpty(subscriptionId: string): Promise<Stripe.Subscription> {
  const stripe = loadStripe()
  return stripe ? await stripe.subscriptions.retrieve(subscriptionId) : ({} as Stripe.Subscription)
}

interface WebhookServices {
  stripeService: {
    upsertSubscription: (userId: string, customerId: string, subscriptionId: string, sub: Stripe.Subscription) => Promise<unknown>
    getSubscriptionByStripeId: (subscriptionId: string) => Promise<{ userId: string } | null>
    updateSubscriptionStatus: (subscriptionId: string, sub: Stripe.Subscription) => Promise<unknown>
    cancelSubscription: (subscriptionId: string) => Promise<unknown>
  }
  userService: {
    updateUser: (userId: string, data: { isPro: boolean; proExpiresAt: Date | null }) => Promise<unknown>
  }
}

async function handleCheckoutCompleted(event: Stripe.Event, services: WebhookServices): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session
  const userId = session.metadata?.userId
  if (!userId) {
    return
  }
  const subscriptionId = session.subscription
  const customerId = session.customer
  if (!isValidCheckoutRefs(subscriptionId, customerId)) {
    return
  }
  try {
    // Guard above guarantees both refs are non-empty strings
    const sub = await fetchSubscriptionOrEmpty(subscriptionId as string)
    await services.stripeService.upsertSubscription(userId, customerId as string, subscriptionId as string, sub)
    const item = sub.items.data[0]
    await services.userService.updateUser(userId, {
      isPro: true,
      proExpiresAt: new Date((item?.current_period_end ?? sub.created) * 1000),
    })
  } catch (err: unknown) {
    logger.error(
      { event: 'stripe.subscription_creation_failed', err: (err as Error).message },
      'Failed to process subscription',
    )
  }
}

async function handleSubscriptionUpdated(event: Stripe.Event, services: WebhookServices): Promise<void> {
  const sub = event.data.object as Stripe.Subscription
  const subscriptionId = sub.id
  try {
    const existing = await services.stripeService.getSubscriptionByStripeId(subscriptionId)
    if (!existing) {
      return
    }
    await services.stripeService.updateSubscriptionStatus(subscriptionId, sub)
    if (sub.status === 'active') {
      const item = sub.items.data[0]
      await services.userService.updateUser(existing.userId, {
        isPro: true,
        proExpiresAt: new Date((item?.current_period_end ?? sub.created) * 1000),
      })
    } else if (sub.status === 'past_due' || sub.status === 'canceled' || sub.status === 'unpaid') {
      await services.userService.updateUser(existing.userId, {
        isPro: false,
        proExpiresAt: null,
      })
    }
  } catch (err: unknown) {
    logger.error(
      { event: 'stripe.subscription_update_failed', err: (err as Error).message },
      'Subscription update failed',
    )
  }
}

async function handleSubscriptionDeleted(event: Stripe.Event, services: WebhookServices): Promise<void> {
  const sub = event.data.object as Stripe.Subscription
  const subscriptionId = sub.id
  try {
    const existing = await services.stripeService.getSubscriptionByStripeId(subscriptionId)
    if (!existing) {
      return
    }
    await services.stripeService.cancelSubscription(subscriptionId)
    await services.userService.updateUser(existing.userId, {
      isPro: false,
      proExpiresAt: null,
    })
  } catch (err: unknown) {
    logger.error(
      { event: 'stripe.subscription_deletion_failed', err: (err as Error).message },
      'Subscription deletion failed',
    )
  }
}

export default router