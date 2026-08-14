import { env } from './config/env'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import pinoHttp from 'pino-http'
import cookieParser from 'cookie-parser'
import passport from 'passport'
import swaggerUi from 'swagger-ui-express'
import { generateOpenAPI } from './config/openapi'
import { requestId } from './middleware/requestId'
import logger from './utils/logger'

// Verify all JWT secrets are distinct — fail fast on identical secrets
const jwtSecrets = {
  JWT_SECRET: env.JWT_SECRET,
  JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET,
  JWT_RESET_SECRET: env.JWT_RESET_SECRET,
}

const secretKeys = Object.keys(jwtSecrets) as (keyof typeof jwtSecrets)[]
for (let i = 0; i < secretKeys.length; i++) {
  for (let j = i + 1; j < secretKeys.length; j++) {
    const key1 = secretKeys[i]
    const key2 = secretKeys[j]
    if (key1 && key2 && jwtSecrets[key1] === jwtSecrets[key2]) {
      logger.fatal(
        { event: 'startup.env_invalid', key1, key2 },
        `CRITICAL SECURITY ERROR: ${key1} and ${key2} cannot be identical.`
      )
      process.exit(1)
    }
  }
}

// ─── Import Routes ───────────────────────────────────────────────────
import authRoutes from './routes/auth'
import tournamentRoutes from './routes/tournaments'
import playerRoutes from './routes/players'
import roomRoutes from './routes/rooms'
import auctionRoutes from './routes/auction'
import franchiseRoutes from './routes/franchises'
import fixtureRoutes from './routes/fixtures'
import leaderboardRoutes from './routes/leaderboard'
import userRoutes from './routes/users'
import messageRoutes from './routes/messages'
import searchRoutes from './routes/search'
import adminRoutes from './routes/admin'
import stripeRoutes from './routes/stripe'
import aiRoutes from './routes/ai'
import draftRoutes from './routes/draft'

import { globalLimiter, authLimiter, passwordResetLimiter, publicLimiter } from './middleware/rateLimiter'
import asyncHandler from './middleware/asyncHandler'

const app = express()

// ─── Request-ID MUST be first (available for every downstream log line) ───
app.use(requestId)

// ─── Response compression ───────────────────────────────────
app.use(compression())

// ─── CORS must be first so preflight OPTIONS requests are handled before any other middleware ───
const corsMiddleware = cors({ origin: env.FRONTEND_URL || 'http://localhost:3000', credentials: true })
app.use(corsMiddleware)

import { container } from './container'
import { scopePerRequest } from 'awilix-express'

// ─── Security headers (Helmet with explicit CSP) — after CORS ──────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-eval'",
          'https://js.stripe.com',
          'https://www.googletagmanager.com',
        ],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        connectSrc: ["'self'", 'https://api.stripe.com', 'https://o*.sentry.io', 'https://sentry.io'],
        frameSrc: ["'self'", 'https://js.stripe.com'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
)

app.use(scopePerRequest(container))

// ─── HTTPS redirect — before routes, before rate limiter, after CORS/Helmet ──
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const proto = (req.headers['x-forwarded-proto'] as string) || ''
  if (proto === 'http' || proto.startsWith('http,')) {
    res.redirect(301, `https://${req.headers.host}${req.url}`)
  } else {
    next()
  }
})

// ─── Rate limiters — before pino-http to reduce noise ──────────────
app.use(globalLimiter)

app.use(
  pinoHttp({
    logger,
    customProps: (req: express.Request) => ({
      requestId: req.id,
    }),
  } as any),
)

// Stripe webhook needs raw body BEFORE express.json() consumes it
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }))

app.use(express.json())
app.use(cookieParser())
app.use(passport.initialize())

// ─── CSRF protection (double-submit cookie pattern) ────────────────
import { csrfProtection } from './middleware/csrf'
app.use(csrfProtection)

// ─── API Documentation (OpenAPI / Swagger) ───────────────────
app.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(generateOpenAPI())
})

if (env.NODE_ENV !== 'production') {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(generateOpenAPI()))
}

// ─── API Routes ───────────────────────────────────────────────────────
app.use('/api/v1/auth/login', authLimiter)
app.use('/api/v1/auth/signup', authLimiter)
app.use('/api/v1/auth/forgot-password', passwordResetLimiter)
app.use('/api/v1/auth/reset-password', passwordResetLimiter)
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/tournaments', tournamentRoutes)
app.use('/api/v1/players', playerRoutes)
app.use('/api/v1/rooms', roomRoutes)
app.use('/api/v1/rooms', auctionRoutes) // /api/rooms/:roomId/auction/*
app.use('/api/v1/rooms', franchiseRoutes) // /api/rooms/:roomId/franchises/*
app.use('/api/v1/fixtures', fixtureRoutes)
app.use('/api/v1/leaderboard', leaderboardRoutes)
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/messages', messageRoutes)
app.use('/api/v1/search', searchRoutes)
app.use('/api/v1/admin', adminRoutes)
app.use('/api/v1/stripe', stripeRoutes)
app.use('/api/v1/ai', aiRoutes)
app.use('/api/v1/draft', draftRoutes)


// ─── Prometheus metrics endpoint ────────────────────────────────
import { metricsMiddleware, metricsEndpoint } from './middleware/metrics'
app.use(metricsMiddleware)
app.get(
  '/api/metrics',
  async (_req: express.Request, res: express.Response) => {
    const metrics = await metricsEndpoint()
    res.setHeader('Content-Type', 'text/plain')
    res.send(metrics)
  }
)

// ─── Global Error Handler ─────────────────────────────────────────────
import { DomainError } from './errors/DomainError'

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ event: 'app.unhandled_error', err: (err as Error).message, stack: err.stack, path: req.path }, 'Unhandled exception')

  if (res.headersSent) {
    return next(err)
  }

  if (err instanceof DomainError) {
    return res.status(400).json({
      error: { code: err.name, message: (err as Error).message },
    })
  }

  // Generic 500 for unhandled errors
  res.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
  })
})

export { app }
