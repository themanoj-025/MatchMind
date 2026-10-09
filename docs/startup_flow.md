# Match-Mind — Startup Flow

Match-Mind is an npm-workspaces monorepo. `npm run dev` boots backend +
frontend concurrently; `npm run dev:up` additionally starts the Docker stack
and applies Prisma migrations.

## Infrastructure (docker-compose.yml)

1. **postgres** — `pg_isready` health check (db/user `matchmind`).
2. **redis** — queue + cache + Socket.IO adapter backing store.

## Backend boot (`backend/`, `npm run dev` → tsx watch)

1. `src/index.ts` → `src/server.ts` → `src/app.ts`.
2. `config/env.ts` validates env (DATABASE_URL, REDIS_URL, JWT secrets,
   Stripe/SportRadar keys) — fails fast on missing vars.
3. `lib/prisma.ts` connects Prisma; `lib/redis.ts` + `lib/queue.ts` init
   Redis + job queue.
4. `container.ts` wires services → repositories (composition root).
5. Express app assembly: middleware stack (requestId → metrics → rateLimiter
   → auth → csrf → errorHandler), route registration (`routes/*`), OpenAPI
   setup (`config/openapi.ts`).
6. Socket.IO attaches to the server (`socket/index.ts`) for rooms/draft/auction.
7. Workers boot (`workers/index.ts` → `auctionWorker`) to process queued jobs.
8. Ready: `/api/health` + business routes + WS events.

## Frontend boot (`frontend/`, `npm run dev` → Vite)

1. `main.tsx` mounts `App.tsx`; router renders `views/*`.
2. `config/env.ts` reads `VITE_API_URL`; `store/useAuthStore` restores session
   from storage; hooks (`useRooms`, `useLeaderboard`, …) fetch via API.

## Database flow

- Prisma schema at `backend/prisma/schema.prisma`; migrations applied via
  `npx prisma migrate deploy` (`npm run dev:up` does this after compose up).
- `updateSchema.js` (root) regenerates the schema baseline docs.

## Operational entry points

| Entry      | Command                                                                  |
| ---------- | ------------------------------------------------------------------------ |
| Dev (both) | `npm run dev`                                                            |
| Full stack | `npm run dev:up` (compose + migrate + dev)                               |
| Lint       | `npm run lint` (backend + frontend)                                      |
| Typecheck  | `npm run typecheck`                                                      |
| Test       | `npm run test` (Vitest backend+frontend; `frontend/` Playwright for E2E) |
| Install    | `npm run setup` (install + shared-types build + prisma generate)         |

## What must exist at startup

- Env files: root `.env` (compose), `backend/.env` (+ `.env.test`), frontend
  Vite env vars; `.env.example` files committed
- Postgres reachable + Prisma migrations applied
- Redis reachable
