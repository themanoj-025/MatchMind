import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  BACKEND_URL: z.string().url().default('http://localhost:5000'),
  
  // Auth & Security
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_RESET_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  
  // External APIs (Optional)
  RESEND_API_KEY: z.string().min(1).optional(),
  SPORTRADAR_API_KEY: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_ANNUAL: z.string().optional(),
  STRIPE_PRICE_MONTHLY: z.string().optional(),
  
  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  
  // App Config
  EMAIL_FROM: z.string().optional().default('noreply@matchmind.gg'),
  LOG_LEVEL: z.string().optional(),
  DRAFT_ENABLED_TOURNAMENTS: z.string().optional(),
  FLAG_AI_HINTS: z.string().optional(),
  FLAG_PRO_GATE_AI: z.string().optional(),
  FLAG_CHAT_GIFS: z.string().optional(),
  FLAG_LB_REALTIME: z.string().optional(),
  FLAG_DM: z.string().optional(),
})

const parseResult = envSchema.safeParse(process.env)

if (!parseResult.success) {
  if (process.env.NODE_ENV === 'test') {
    console.warn('Test environment detected. Skipping strict env validation.')
  } else {
    console.error('Environment validation failed. Missing or invalid variables.')
    console.error(parseResult.error.format())
    process.exit(1)
  }
}

export const env = (process.env.NODE_ENV === 'test' ? process.env : parseResult.data) as z.infer<typeof envSchema>
