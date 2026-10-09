import { describe, it, expect } from 'vitest'
import { AppError } from './AppError'

describe('AppError', () => {
  it('creates an error with default statusCode 400', () => {
    const err = new AppError('TEST_ERROR', 'Something went wrong')
    expect(err.code).toBe('TEST_ERROR')
    expect(err.message).toBe('Something went wrong')
    expect(err.statusCode).toBe(400)
    expect(err.isAppError).toBe(true)
    expect(err.name).toBe('AppError')
  })

  it('accepts custom statusCode', () => {
    const err = new AppError('NOT_FOUND', 'User not found', 404)
    expect(err.statusCode).toBe(404)
  })

  it('is an instance of Error', () => {
    const err = new AppError('CODE', 'msg')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AppError)
  })

  it('captures stack trace', () => {
    const err = new AppError('CODE', 'msg')
    expect(err.stack).toBeDefined()
    expect(err.stack).toContain('AppError')
  })
})
