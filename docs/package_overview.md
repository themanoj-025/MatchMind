# Match-Mind — Package & Module Inventory

## Backend: `backend/` (Express + TypeScript)

| Area              | Modules                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Entry             | `index.ts` (boot), `server.ts` (HTTP/WS server), `app.ts` (Express app)                                                                                                                                                                                                                                                                          |
| `config/`         | `env.ts` (validated env), `constants.ts`, `schemas.ts` (validation), `passport.ts`, `tournaments.ts` + `tournamentRegistry.json`, `openapi.ts`                                                                                                                                                                                                   |
| `routes/`         | `auth`, `users`, `rooms`, `draft`, `auction`, `matches`, `fixtures`, `franchises`, `leaderboard`, `messages`, `players`, `search`, `tournaments`, `stripe`, `ai`, `admin`                                                                                                                                                                        |
| `services/`       | `authService`, `userService`, `roomService`, `draftService`, `draftAppService`, `draftRunService`, `draftTicketService`, `auctionEngine`, `matchService`, `scoring`, `fantasyPoints`, `leaderboardService` + `leaderboardMapper`, `messageService`, `cacheService`, `lockService`, `tokenService`, `emailService`, `stripeService`, `sportRadar` |
| `middleware/`     | `auth`, `requireAdmin`, `rateLimiter`, `csrf`, `idempotency`, `validate`, `errorHandler`, `asyncHandler`, `circuitBreaker`, `draftGate`, `metrics`, `requestId`                                                                                                                                                                                  |
| `socket/`         | `index.ts` — Socket.IO rooms/draft/auction event wiring                                                                                                                                                                                                                                                                                          |
| `workers/`        | `index.ts`, `auctionWorker.ts` — background auction processing                                                                                                                                                                                                                                                                                   |
| `repositories/`   | `index.ts`, `types.ts` — data-access over Prisma                                                                                                                                                                                                                                                                                                 |
| `lib/`            | `prisma.ts`, `redis.ts`, `queue.ts`, `validateDraftPool.ts`                                                                                                                                                                                                                                                                                      |
| `infrastructure/` | `database.ts`, `health.ts`, `shutdown.ts`                                                                                                                                                                                                                                                                                                        |
| `errors/`         | `DomainError.ts`                                                                                                                                                                                                                                                                                                                                 |
| `utils/`          | `AppError.ts`, `logger.ts`                                                                                                                                                                                                                                                                                                                       |
| `data/*.json`     | 30+ seed/domain fixtures (players, teams, tournaments, venues, …)                                                                                                                                                                                                                                                                                |
| `scripts/`        | Migration/ops: `migrate-json-to-postgres.ts`, `seedDraftPlayers.ts`, `validateDraftPool.ts`, `assignPlayerPhotos.ts`, `computeRarityTiers.ts`, `validateLeagueDataPackage.ts`, `add-ts-ignore.js`, `remove-any.ts`, `fix-app.js`, `replaceEnv.cjs`, `backup-data.sh`, `checkApiCoverage.js`                                                      |
| Tests             | `src/__tests__/`, `src/routes/*.test.ts`, `src/services/*.test.ts`, `src/e2e/` (Vitest)                                                                                                                                                                                                                                                          |

## Frontend: `frontend/` (React + Vite)

| Area                | Modules                                                      |
| ------------------- | ------------------------------------------------------------ |
| `src/main.tsx`      | Vite entry                                                   |
| `src/App.tsx`       | Root + routing                                               |
| `src/views/`        | `Landing`, `Auth`, `Lobby`, `DraftRoom`, `Leaderboard`       |
| `src/components/`   | `Button`, `Card`, `Input`, `GlobalSpinner`, `ToastContainer` |
| `src/hooks/`        | `useRooms`, `useLeaderboard`, `useAuctionAdvice`             |
| `src/store/`        | `useAuthStore`, `useToastStore` (Zustand)                    |
| `src/lib/`          | `utils.ts`                                                   |
| `src/config/env.ts` | API base URL                                                 |
| `e2e/`              | Playwright specs (`auth.spec`, `draft.spec`)                 |

## Shared package: `packages/shared-types/`

`src/index.ts` — shared domain/DTO types consumed by both apps.

## Root tooling

`package.json` (workspaces scripts: dev/build/lint/typecheck/test via
`concurrently`) · `updateSchema.js` (Prisma schema sync helper) ·
`Makefile` · `docker-compose.yml` (+ `.test.yml`, `.override.example`) ·
`k8s/` (deployment) · `docs/` (suite incl. `reference/Volume-*` engineering
volumes, `decisions/`)

## Non-package trees

| Path                 | Purpose                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `docs/`              | Full suite: architecture, decisions (incl. `001-backend-frontend-restructure`), reference volumes, technical |
| `.github/workflows/` | ci, deploy, codeql, gitleaks, labeler, maintenance, stale, welcome                                           |
