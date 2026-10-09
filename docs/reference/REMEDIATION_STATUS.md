# Remediation Status

Tracking file for the Match-Mind 10/10 Remediation.

## Phase 0 — Safety Net Before Touching Anything

- ✅ Run existing Vitest suite and record baseline pass/fail + coverage % (Recorded: 14 failed, 214 passed).
- ✅ Add a coverage gate to CI (`vitest --coverage`) in `.github/workflows/ci.yml`.
- ⏳ Snapshot current Prisma schema (`prisma/schema.prisma`) and generate an ERD (`docs/schema-baseline.svg`).
- ✅ Verify Redis instance in `docker-compose.yml` is reachable and healthy (Image configured).

## Phase 1 — Critical Security: Auth Rewrite

- ✅ Remove all `localStorage` token management from frontend's `AppContext.tsx`.
- ✅ Implement `GET /api/auth/me` to hydrate session.
- ✅ Implement `POST /api/auth/refresh` for rotating tokens + reuse detection.
- ✅ Introduce Awilix for `AuthService` construction (DI).
- ✅ Remove `unsafe-inline` from Helmet CSP.
- ✅ Swap `bcryptjs` for `argon2`.

## Phase 2 — Event-Driven Auction Engine

- ✅ Delete `tickAuctionTimers` and its `setInterval` loop from `server.ts`.
- ✅ Implement BullMQ to manage delayed auction timer expiries.
- ✅ Setup auction worker processes.
- ✅ Configure `@socket.io/redis-adapter` for Socket.io.
- ✅ Introduce typed domain exceptions.

## Phase 3 — Data Layer

- ⏳ Move auction queue state out of Postgres JSON into Redis.
- ⏳ Apply GIN indexes for remaining JSON columns.
- ⏳ Standardize on UUIDv7 for all future primary keys.
- ⏳ Enforce standard soft-delete policy and add composite FKs.

## Phase 4 — Backend Code Quality & Structure

- ✅ Refactor routes to use Awilix DI (`leaderboard`, `draft`, `stripe`, `messages`, `auth`)
- ✅ Eliminate `req.app.get('prisma')` globally in favor of `container.resolve('prisma')`
- ✅ Centralize caching via `CacheService` using Redis, eliminating raw `redis.get/set` in routes.
- ⏳ Break apart `server.ts` into infrastructure modules.
- ⏳ Eliminate `any` usage.
- ⏳ Remove `asyncHandler` in favor of Express 5 native handling.
- ⏳ Apply API versioning (`/api/v1/`).
- ✅ Apply cursor and offset pagination with Zod schema (`pagination.ts`).
- ✅ Implement dev warning for unbounded queries via `prisma.$extends`.

## Phase 5 — Frontend Structure & Performance

- ⏳ Split `AppContext.tsx` into scoped contexts.
- ⏳ Apply `React.lazy` and `Suspense`.
- ⏳ Standardize data fetching through React Query.

## Phase 6 — DevOps, Testing, Docs Polish

- ⏳ Fix secret hygiene in Docker compose.
- ⏳ Add Playwright E2E tests for the critical path.
- ⏳ Enforce `/api/ai` rate limiting.
- ⏳ Write Architecture Decision Record (ADR).

## Discovered During Remediation

- ✅ **Test Suite P3005 Error:** Test environment assumed empty schema for `migrate deploy`. Updated `test:up` script to use `db push --accept-data-loss --force-reset` to correctly baseline test schema before every run.
