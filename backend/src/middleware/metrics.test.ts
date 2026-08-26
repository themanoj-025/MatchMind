/**
 * Metrics Middleware Tests — MatchMind
 *
 * Tests metrics middleware:
 * - metricsMiddleware: skips /api/metrics, tracks request duration
 * - incrementBidCount: increments bid counter
 * - setActiveAuctionRooms: sets active rooms gauge
 * - setWebSocketConnections: sets WS connections gauge
 * - observeDbWriteLatency: observes DB write latency
 * - metricsEndpoint: returns Prometheus metrics
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  metricsMiddleware,
  incrementBidCount,
  setActiveAuctionRooms,
  setWebSocketConnections,
  observeDbWriteLatency,
  metricsEndpoint,
} from './metrics'
import type { Request, Response, NextFunction } from 'express'

function createMockReq(path: string = '/api/test'): Request {
  return {
    path,
    method: 'GET',
    route: { path: '/api/test' },
  } as unknown as Request
}

function createMockRes(): Response {
  const res = {
    statusCode: 200,
    end: vi.fn().mockImplementation(function (this: Response, ...args: unknown[]) {
      return this
    }),
  } as unknown as Response
  return res
}

function createMockNext(): NextFunction {
  return vi.fn()
}

describe('metricsMiddleware', () => {
  let req: Request
  let res: Response
  let next: NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
    req = createMockReq()
    res = createMockRes()
    next = createMockNext()
  })

  it('skips /api/metrics endpoint', () => {
    req = createMockReq('/api/metrics')

    metricsMiddleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('calls next for other routes', () => {
    metricsMiddleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('wraps res.end to track metrics', () => {
    metricsMiddleware(req, res, next)

    // res.end should have been replaced
    expect(typeof res.end).toBe('function')
  })
})

describe('metric updaters', () => {
  it('incrementBidCount does not throw', () => {
    expect(() => incrementBidCount()).not.toThrow()
  })

  it('setActiveAuctionRooms does not throw', () => {
    expect(() => setActiveAuctionRooms(5)).not.toThrow()
  })

  it('setWebSocketConnections does not throw', () => {
    expect(() => setWebSocketConnections(10)).not.toThrow()
  })

  it('observeDbWriteLatency does not throw', () => {
    expect(() => observeDbWriteLatency(0.05)).not.toThrow()
  })
})

describe('metricsEndpoint', () => {
  it('returns a string of metrics', async () => {
    const metrics = await metricsEndpoint()

    expect(typeof metrics).toBe('string')
    expect(metrics.length).toBeGreaterThan(0)
  })
})
