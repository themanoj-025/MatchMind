import { env } from './env'
/**
 * Passport strategies for MatchMind.
 *
 * Accepts a PrismaClient-like instance from the caller (index.ts)
 * so only one connection is shared across the entire app.
 */
import passport from 'passport'
import type { StrategyCreated, StrategyCreatedStatic } from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt'
import type { DatabaseClient } from '../repositories/index'
import logger from '../utils/logger'

export function configurePassport(prisma: DatabaseClient) {
  // JWT Strategy — authenticate API requests via Bearer token
  const jwtOpts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: env.JWT_SECRET!,
  }

  passport.use(new JwtStrategy(jwtOpts, async (payload: { userId: string }, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: payload.userId } })
      if (!user) return done(null, false)
      return done(null, user)
    } catch (err: any) {
      return done(err, false)
    }
  }))

  // Google OAuth Strategy — signup/login via Google
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${env.BACKEND_URL || 'http://localhost:4000'}/api/auth/google/cb`,
    }, async (accessToken: string, refreshToken: string, profile: any, done: (error: unknown, user?: any) => void) => {
      try {
        const email = profile.emails?.[0]?.value
        if (!email) return done(new Error('No email from Google'), null)

        let user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              username: `google_${profile.id}`,
              displayName: profile.displayName || profile.name?.givenName || 'Google User',
              avatar: profile.photos?.[0]?.value || null,
            },
          })
        }
        return done(null, user)
      } catch (err: any) {
        return done(err, null)
      }
    }))
  } else {
    logger.warn({ event: 'auth.google_oauth_not_configured' }, 'Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars')
  }

  // Serialization (not used with JWT, but required for sessions if ever needed)
  passport.serializeUser((user: any, done) => done(null, user.id))
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } })
      done(null, user)
    } catch (err: any) {
      done(err, null)
    }
  })

  return passport
}
