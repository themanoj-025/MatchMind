/**
 * Prometheus Metrics Middleware — MatchMind
 *
 * Tracks application-level metrics using prom-client:
 * - HTTP request count (by method, route, status)
 * - HTTP request duration (histogram)
 * - Active auction rooms
 * - Bid count
 * - WebSocket connection count
 * - Database write latency
 *
 * Usage:
 *   app.use(metricsMiddleware)
 *   app.get('/api/metrics', ...)  // Prometheus scrape endpoint
 */

import prometheus from 'prom-client'
import type { Request, Response, NextFunction } from 'express'

// ─── Registry ───────────────────────────────────────────

const register = new prometheus.Registry()
prometheus.collectDefaultMetrics({ register, prefix: 'matchmind_' })

// ─── HTTP Metrics ───────────────────────────────────────

const httpRequestCount = new prometheus.Counter({
  name: 'matchmind_http_requests_total',
  help: 'Total HTTP request count',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
})

const httpRequestDuration = new prometheus.Histogram({
  name: 'matchmind_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
})

// ─── Business Metrics ───────────────────────────────────

const activeAuctionRooms = new prometheus.Gauge({
  name: 'matchmind_active_rooms',
  help: 'Number of rooms currently in DRAFTING state',
  registers: [register],
})

const totalBidsPlaced = new prometheus.Counter({
  name: 'matchmind_bids_total',
  help: 'Total number of bids placed',
  registers: [register],
})

const activeWebSocketConnections = new prometheus.Gauge({
  name: 'matchmind_ws_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
})

const databaseWriteLatency = new prometheus.Histogram({
  name: 'matchmind_db_write_duration_seconds',
  help: 'Database write operation latency',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  registers: [register],
})

// ─── Middleware ─────────────────────────────────────────

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip metrics endpoint itself
  if (req.path === '/api/metrics') {
    return next()
  }

  const end = httpRequestDuration.startTimer()
  const originalEnd = res.end.bind(res)

  res.end = function (this: Response, ...args: any[]) {
    const duration = end()
    const route = req.route?.path || req.path
    httpRequestCount.inc({ method: req.method, route, status_code: res.statusCode })
    httpRequestDuration.observe({ method: req.method, route, status_code: res.statusCode }, duration)
    return originalEnd(...args)
  } as any

  next()
}

// ─── Metric Updaters (called from other modules) ───────

export function incrementBidCount(): void {
  totalBidsPlaced.inc()
}

export function setActiveAuctionRooms(count: number): void {
  activeAuctionRooms.set(count)
}

export function setWebSocketConnections(count: number): void {
  activeWebSocketConnections.set(count)
}

export function observeDbWriteLatency(seconds: number): void {
  databaseWriteLatency.observe(seconds)
}

// ─── Endpoint Handler ───────────────────────────────────

export async function metricsEndpoint(): Promise<string> {
  return register.metrics()
}
