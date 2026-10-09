/**
 * AppError — a custom error class for application-level errors.
 *
 * Usage:
 *   throw new AppError('MATCH_NOT_FOUND', 'Match not found', 404)
 *   throw new AppError('UNAUTHORIZED', 'Login required', 401)
 *
 * The centralized error handler (errorHandler.js) catches these and
 * returns a consistent JSON envelope.
 */
export class AppError extends Error {
  public code: string
  public statusCode: number
  public isAppError: boolean

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.isAppError = true
    Error.captureStackTrace(this, this.constructor)
  }
}
