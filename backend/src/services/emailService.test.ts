import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock env before importing
vi.mock('../config/env', () => ({
  env: {
    RESEND_API_KEY: '',
    FRONTEND_URL: 'http://localhost:3000',
    EMAIL_FROM: 'test@matchmind.gg',
  },
}))

// Mock logger
vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('emailService', () => {
  let sendVerificationEmail: typeof import('./emailService').sendVerificationEmail
  let sendPasswordResetEmail: typeof import('./emailService').sendPasswordResetEmail
  let logger: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; debug: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    vi.clearAllMocks()
    // Re-import to get fresh module state
    const emailMod = await import('./emailService')
    sendVerificationEmail = emailMod.sendVerificationEmail
    sendPasswordResetEmail = emailMod.sendPasswordResetEmail
    logger = (await import('../utils/logger')).default
  })

  describe('sendVerificationEmail', () => {
    it('logs the verification link when Resend is not configured', async () => {
      await sendVerificationEmail('user@example.com', 'verify-token-123')
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'email.verification_logged', to: 'user@example.com' }),
        expect.stringContaining('verify-token-123'),
      )
    })

    it('includes the frontend URL in the verification link', async () => {
      await sendVerificationEmail('user@example.com', 'my-token')
      const callArgs = logger.info.mock.calls[0]
      expect(callArgs[1]).toContain('http://localhost:3000/verify-email?token=my-token')
    })

    it('does not throw when called', async () => {
      await expect(sendVerificationEmail('test@test.com', 'tok')).resolves.toBeUndefined()
    })
  })

  describe('sendPasswordResetEmail', () => {
    it('logs the reset link when Resend is not configured', async () => {
      await sendPasswordResetEmail('user@example.com', 'reset-token-456')
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'email.password_reset_logged', to: 'user@example.com' }),
        expect.stringContaining('reset-token-456'),
      )
    })

    it('includes the frontend URL in the reset link', async () => {
      await sendPasswordResetEmail('user@example.com', 'reset-xyz')
      const callArgs = logger.info.mock.calls[0]
      expect(callArgs[1]).toContain('http://localhost:3000/reset-password?token=reset-xyz')
    })

    it('does not throw when called', async () => {
      await expect(sendPasswordResetEmail('test@test.com', 'tok')).resolves.toBeUndefined()
    })
  })
})
