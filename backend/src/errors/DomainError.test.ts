import { describe, it, expect } from 'vitest'
import { DomainError, ConcurrencyError, AuctionError } from '../errors/DomainError'

describe('DomainError', () => {
  it('creates an error with code and statusCode', () => {
    const err = new DomainError('Domain violation', 'DOMAIN_VIOLATION', 422)
    expect(err.message).toBe('Domain violation')
    expect(err.code).toBe('DOMAIN_VIOLATION')
    expect(err.statusCode).toBe(422)
    expect(err.name).toBe('DomainError')
  })

  it('defaults statusCode to 400', () => {
    const err = new DomainError('Bad request', 'BAD')
    expect(err.statusCode).toBe(400)
  })

  it('is an instance of Error and DomainError', () => {
    const err = new DomainError('msg', 'CODE')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(DomainError)
  })

  it('captures stack trace', () => {
    const err = new DomainError('msg', 'CODE')
    expect(err.stack).toBeDefined()
    expect(err.stack).toContain('DomainError')
  })
})

describe('ConcurrencyError', () => {
  it('defaults to CONCURRENCY_ERROR code and 409 status', () => {
    const err = new ConcurrencyError()
    expect(err.code).toBe('CONCURRENCY_ERROR')
    expect(err.statusCode).toBe(409)
    expect(err.name).toBe('ConcurrencyError')
  })

  it('accepts a custom message', () => {
    const err = new ConcurrencyError('Race condition detected')
    expect(err.message).toBe('Race condition detected')
  })

  it('is an instance of DomainError', () => {
    const err = new ConcurrencyError()
    expect(err).toBeInstanceOf(DomainError)
  })
})

describe('AuctionError', () => {
  it('defaults to AUCTION_ERROR code and 400 status', () => {
    const err = new AuctionError('Bid too low')
    expect(err.message).toBe('Bid too low')
    expect(err.code).toBe('AUCTION_ERROR')
    expect(err.statusCode).toBe(400)
  })

  it('accepts a custom code', () => {
    const err = new AuctionError('Timer expired', 'AUCTION_TIMEOUT')
    expect(err.code).toBe('AUCTION_TIMEOUT')
  })

  it('is an instance of DomainError', () => {
    const err = new AuctionError('msg')
    expect(err).toBeInstanceOf(DomainError)
  })
})
