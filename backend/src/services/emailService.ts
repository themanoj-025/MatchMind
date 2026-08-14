import { env } from '../config/env'
/**
 * Email Service — MatchMind
 *
 * Resend-based transactional email sending for:
 * - Email verification
 * - Password reset
 *
 * Falls back silently to logging when RESEND_API_KEY is not configured
 * (development mode — same as the previous console.log behavior).
 */

import logger from '../utils/logger'

let resendClient: any = null
try {
  const { Resend } = require('resend')
  if (env.RESEND_API_KEY) {
    resendClient = new Resend(env.RESEND_API_KEY)
  }
} catch {
  // resend not installed — fall back to logging
}

const FROM_EMAIL = env.EMAIL_FROM || 'noreply@matchmind.gg'

/**
 * Send an email verification link.
 * Falls back to logging the token when email sending is not configured.
 */
export async function sendVerificationEmail(
  to: string,
  verificationToken: string,
): Promise<void> {
  const verificationUrl = `${env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`

  if (!resendClient) {
    logger.info(
      { event: 'email.verification_logged', to },
      `[EMAIL] Verification link: ${verificationUrl}`,
    )
    return
  }

  try {
    await resendClient.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Verify your MatchMind email',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f1a; color: #e2e8f0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: #1a1a2e; border-radius: 12px; padding: 32px; border: 1px solid #2d2d44;">
            <h1 style="font-size: 24px; margin: 0 0 8px; color: #fbbf24;">MatchMind</h1>
            <p style="color: #94a3b8; margin-bottom: 24px;">Verify your email address to start playing.</p>
            <a href="${verificationUrl}"
               style="display: inline-block; background: #fbbf24; color: #0f0f1a; text-decoration: none;
                      padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Verify Email
            </a>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">
              Or paste this link in your browser:<br/>
              <span style="color: #94a3b8;">${verificationUrl}</span>
            </p>
          </div>
        </body>
        </html>
      `,
    })
    logger.info({ event: 'email.verification_sent', to }, 'Verification email sent')
  } catch (err: any) {
    logger.error({ event: 'email.verification_failed', to, err: String(err) }, 'Failed to send verification email')
  }
}

/**
 * Send a password reset email.
 * Falls back to logging the token when email sending is not configured.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetToken: string,
): Promise<void> {
  const resetUrl = `${env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`

  if (!resendClient) {
    logger.info(
      { event: 'email.password_reset_logged', to },
      `[EMAIL] Password reset link: ${resetUrl}`,
    )
    return
  }

  try {
    await resendClient.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Reset your MatchMind password',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f1a; color: #e2e8f0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: #1a1a2e; border-radius: 12px; padding: 32px; border: 1px solid #2d2d44;">
            <h1 style="font-size: 24px; margin: 0 0 8px; color: #fbbf24;">MatchMind</h1>
            <p style="color: #94a3b8; margin-bottom: 24px;">Click below to reset your password. This link expires in 1 hour.</p>
            <a href="${resetUrl}"
               style="display: inline-block; background: #fbbf24; color: #0f0f1a; text-decoration: none;
                      padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Reset Password
            </a>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">
              If you didn't request this, you can safely ignore this email.<br/>
              Or paste this link in your browser:<br/>
              <span style="color: #94a3b8;">${resetUrl}</span>
            </p>
          </div>
        </body>
        </html>
      `,
    })
    logger.info({ event: 'email.password_reset_sent', to }, 'Password reset email sent')
  } catch (err: any) {
    logger.error({ event: 'email.password_reset_failed', to, err: String(err) }, 'Failed to send password reset email')
  }
}
