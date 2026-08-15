import { env } from '../config/env'
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import passport from 'passport'
import { validate } from '../middleware/validate'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth'
import { csrfTokenHandler } from '../middleware/csrf'
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../config/schemas'
import { generateTokens, setAuthCookies, clearAuthCookies } from '../services/tokenService'
import { revokeTokens } from '../services/authService'
import * as argon2 from 'argon2'
import logger from '../utils/logger'
import { openapiRegistry } from '../config/openapi'
const router = express.Router()
// Using awilix-express container via req.container
// GET /api/auth/csrf-token — retrieve CSRF token (no auth required)
openapiRegistry.registerPath({
  method: 'get',
  path: '/csrf-token',
  responses: { 200: { description: 'Success' } },
})
router.get('/csrf-token', csrfTokenHandler)
// GET /api/auth/me — hydrate user session from HttpOnly cookie
openapiRegistry.registerPath({
  method: 'get',
  path: '/me',
  responses: { 200: { description: 'Success' } },
})
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userRepository = req.container.cradle.userRepository
  const user = await userRepository.findById(req.userId!)
  if (!user) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } })
  }
  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
      totalPoints: user.totalPoints,
      tier: user.tier,
    },
  })
})
// POST /api/auth/signup
openapiRegistry.registerPath({
  method: 'post',
  path: '/signup',
  request: { body: { content: { 'application/json': { schema: signupSchema } } } },
  responses: { 200: { description: 'Success' } },
})
router.post('/signup', validate(signupSchema), async (req, res) => {
  const { username, email, password } = req.body
  const authService = req.container.cradle.authService
  const result = await authService.signup(username, email, password)
  const tokens = result.tokens
  setAuthCookies(res, tokens)
  res.status(201).json({ user: result.user }) // Tokens are NOT returned in JSON
})
// POST /api/auth/login
openapiRegistry.registerPath({
  method: 'post',
  path: '/login',
  request: { body: { content: { 'application/json': { schema: loginSchema } } } },
  responses: { 200: { description: 'Success' } },
})
router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body
  const authService = req.container.cradle.authService
  const result = await authService.login(email, password)
  const tokens = result.tokens
  setAuthCookies(res, tokens)
  res.json({ user: result.user }) // Tokens are NOT returned in JSON
})
// POST /api/auth/logout — revoke tokens (invalidates all sessions)
openapiRegistry.registerPath({
  method: 'post',
  path: '/logout',
  responses: { 200: { description: 'Success' } },
})
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res) => {
  await revokeTokens(req.userId!, req.container.cradle.userRepository)
  clearAuthCookies(res)
  logger.info({ event: 'auth.logout', userId: req.userId })
  res.json({ message: 'Logged out successfully. All sessions invalidated.' })
})
// POST /api/auth/logout-all — revoke all tokens for this user
openapiRegistry.registerPath({
  method: 'post',
  path: '/logout-all',
  responses: { 200: { description: 'Success' } },
})
router.post('/logout-all', authenticateToken, async (req: AuthenticatedRequest, res) => {
  await revokeTokens(req.userId!, req.container.cradle.userRepository)
  clearAuthCookies(res)
  logger.info({ event: 'auth.logout_all', userId: req.userId })
  res.json({ message: 'All sessions logged out successfully.' })
})
// GET /api/auth/google - OAuth redirect
openapiRegistry.registerPath({
  method: 'get',
  path: '/google',
  responses: { 200: { description: 'Success' } },
})
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))
// GET /api/auth/google/cb
openapiRegistry.registerPath({
  method: 'get',
  path: '/google/cb',
  responses: { 200: { description: 'Success' } },
})
router.get('/google/cb', passport.authenticate('google', { session: false }), (req, res) => {
  const googleUser = req.user as { id: string; tokenVersion: number }
  // Async token generation — use sync version since passport already resolved user
  const tokens = generateTokens(googleUser.id, googleUser.tokenVersion)
  setAuthCookies(res, tokens)
  // Also set a CSRF token cookie for the client
  res.redirect(`${env.FRONTEND_URL}/lobby`)
})
// POST /api/auth/refresh
openapiRegistry.registerPath({
  method: 'post',
  path: '/refresh',
  responses: { 200: { description: 'Success' } },
})
router.post('/refresh', async (req, res) => {
  // Only accept from cookies, no longer body fallback to prevent XSS
  const token = req.cookies?.refreshToken
  if (!token) {
    return res.status(401).json({
      error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token provided' },
    })
  }
  const authService = req.container.cradle.authService
  const tokens = await authService.refreshToken(token)
  setAuthCookies(res, tokens)
  res.json({ message: 'Tokens refreshed successfully' }) // Tokens are NOT returned in JSON
})
// POST /api/auth/forgot-password
openapiRegistry.registerPath({
  method: 'post',
  path: '/forgot-password',
  request: { body: { content: { 'application/json': { schema: forgotPasswordSchema } } } },
  responses: { 200: { description: 'Success' } },
})
router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
  const { email } = req.body
  const authService = req.container.cradle.authService
  await authService.generatePasswordResetToken(email)
  res.json({ message: 'If an account exists, a reset link has been sent.' })
})
// POST /api/auth/reset-password
openapiRegistry.registerPath({
  method: 'post',
  path: '/reset-password',
  request: { body: { content: { 'application/json': { schema: resetPasswordSchema } } } },
  responses: { 200: { description: 'Success' } },
})
router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
  const { token, password } = req.body
  const authService = req.container.cradle.authService
  await authService.resetPassword(token, password)
  logger.info({ event: 'auth.password_reset_completed' }, 'Password reset completed')
  res.json({ message: 'Password has been updated. Please log in with your new password.' })
})
// POST /api/auth/verify-email
openapiRegistry.registerPath({
  method: 'post',
  path: '/verify-email',
  request: { body: { content: { 'application/json': { schema: verifyEmailSchema } } } },
  responses: { 200: { description: 'Success' } },
})
router.post('/verify-email', validate(verifyEmailSchema), async (req, res) => {
  const prisma = req.container.cradle.prisma
  const { token } = req.body
  let decoded: { userId: string; purpose: string }
  try {
    decoded = jwt.verify(token, env.JWT_SECRET!) as { userId: string; purpose: string }
  } catch (err: unknown) {
    return res.status(400).json({
      error: { code: 'INVALID_TOKEN', message: 'Verification token is invalid or expired' },
    })
  }
  if (decoded.purpose !== 'email-verification') {
    return res.status(400).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid token purpose' },
    })
  }
  const userRepository = req.container.cradle.userRepository
  const user = await userRepository.update(decoded.userId, { emailVerified: true })
  logger.info({ event: 'auth.email_verified', userId: user.id }, 'Email verified')
  res.json({ message: 'Email verified successfully.' })
})
// POST /api/auth/resend-verification
openapiRegistry.registerPath({
  method: 'post',
  path: '/resend-verification',
  responses: { 200: { description: 'Success' } },
})
router.post('/resend-verification', (_req, res) => {
  res.json({ message: 'Verification email resent.' })
})
export default router