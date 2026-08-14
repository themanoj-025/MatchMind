# Match-Mind — Module Dependency Map

## Monorepo structure

npm workspaces monorepo: `backend/`, `frontend/`, `packages/shared-types/`.
Dependencies flow: `frontend` → `shared-types` ← `backend`; the two apps
never import each other.

```
backend/src/index.ts        → server.ts (boot), app.ts (Express app)
backend/src/app.ts          → container.ts (composition root), config/*,
                              routes/*, middleware/*, socket/, lib/
backend/src/container.ts    → services/*, repositories/, lib/prisma, lib/queue
backend/src/config/*        → env.ts (validation), constants, passport,
                              schemas (validation), tournaments
backend/src/routes/*        → services/*, middleware/*, config/schemas,
                              repositories (via services), lib/prisma
backend/src/services/*      → repositories/, lib/prisma, lib/queue,
                              config/constants, socket (events emitted)
backend/src/services/sportRadar.ts → external API client (leaf)
backend/src/workers/*       → services (auction engine), lib/queue, socket
backend/src/middleware/*    → config/env, utils/AppError, services (auth)
backend/src/socket/index.ts → services (room, draft, auction)
backend/src/repositories/*  → lib/prisma, config/schemas (types)
backend/src/lib/*           → prisma client, redis/queue, validation helpers
backend/src/utils/*         → AppError, logger — leaves
backend/src/infrastructure/* → database, health, shutdown — boot helpers

frontend/src/main.tsx       → App.tsx → views/* (Lobby, DraftRoom, …)
frontend/src/views/*        → components/*, hooks/*, store/*, lib/utils,
                              @matchmind/shared-types
frontend/src/hooks/*        → lib/api via store, shared-types
frontend/src/store/*        → Zustand stores (auth, toast)
frontend/src/config/env.ts  → Vite env (API URL)

packages/shared-types/src/index.ts → shared DTO/domain types (no deps)
```

## Rules

- **No app→app imports** — `frontend` never imports `backend` and vice versa;
  they share only `@matchmind/shared-types`.
- **`container.ts` is the backend composition root** — routes/services never
  instantiate each other inline; DI keeps the graph acyclic.
- **Socket layer emits to services, never the reverse for state writes** —
  services push domain events; socket adapters handle transport.
- **Env is validated once** (`config/env.ts`) — all modules read validated
  config; no direct `process.env` in routes/services.
- **No circular imports** — verified by `npm run typecheck` (tsc) in CI across
  all three packages.

## External dependencies

Express + Socket.IO (backend) · Prisma + Postgres + Redis (persistence/queue) ·
React 18 + Vite + Zustand (frontend) · Vitest (tests) · Playwright (E2E) ·
Stripe + SportRadar (services) · Passport/JWT (auth) · Docker Compose + k8s (infra)
