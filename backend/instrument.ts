/**
 * Sentry Instrumentation — MatchMind
 *
 * This file MUST be required before any other module in the app entry point.
 * It initializes Sentry for error monitoring and performance tracing.
 *
 * Usage:
 *   import './instrument'  // first line of src/index.ts
 */

import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  // Only sample traces in production to avoid noise in dev
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  // Enable performance profiling in production
  ...(process.env.NODE_ENV === 'production'
    ? {
        integrations: [
          // To enable profiling, add @sentry/profiling-node and uncomment:
          // nodeProfilingIntegration(),
        ],
      }
    : {}),
  // Attach request/user context (no PII beyond user ID)
  beforeSend(event) {
    if (event.user) {
      // Only keep userId, never email/username
      event.user = { id: event.user.id }
    }
    return event
  },
})

export default Sentry
