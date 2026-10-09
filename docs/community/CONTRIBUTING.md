# Contributing to Match-Mind

Thank you for your interest in contributing to Match-Mind, the sports prediction and social gaming platform!

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Redis 6+ (optional, for BullMQ queue)
- Stripe account (for payment features, optional for development)
- Anthropic API key (for AI features, optional for development)
- Google OAuth credentials (for social login, optional for development)

### Setup

1. Fork and clone the repository.

2. **Backend setup:**

   ```bash
   cd backend
   npm install
   cp .env.example .env  # create and fill in your env vars
   ```

3. **Frontend setup:**

   ```bash
   cd frontend
   npm install
   ```

4. **Run the backend:**

   ```bash
   cd backend
   npm run dev           # or `npm run dev:watch` with nodemon
   ```

5. **Run the frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

### Expected Environment Variables

| Variable                                              | Description                           |
| ----------------------------------------------------- | ------------------------------------- |
| `JWT_SECRET`                                          | JWT signing secret                    |
| `PORT`                                                | Backend server port                   |
| `GOOGLE_CLIENT_ID`                                    | Google OAuth client ID (optional)     |
| `GOOGLE_CLIENT_SECRET`                                | Google OAuth client secret (optional) |
| `STRIPE_SECRET_KEY`                                   | Stripe API secret key (optional)      |
| `ANTHROPIC_API_KEY`                                   | Anthropic API key (optional)          |
| `REDIS_URL`                                           | Redis connection string               |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Nodemailer config (optional)          |

## Code Style

### Backend (TypeScript)

- Use ES modules (`import`/`export`) — TypeScript via tsx handles ESM natively.
- Follow standard Express.js patterns with async route handlers.
- All new files must be `.ts` (no `.js` files allowed in `src/`).
- Use descriptive function and variable names with explicit TypeScript types.
- Keep route files focused — routes should call service functions, not contain business logic.

### Frontend (React/TypeScript)

- Use functional components with hooks (`useState`, `useEffect`, custom hooks).
- Use React Query for server state management (`useApi.ts`).
- Use Zustand for client state (`useStore.ts`).
- Follow existing component patterns (file structure, naming).
- All new components and pages must be `.tsx` (no `.jsx` files allowed in `src/`).

## Project Architecture

### Backend (`backend/src/`)

- **`index.ts`** — Express + Socket.IO server entry point
- **`routes/`** — 15+ route files (auth, rooms, auction, tournaments, players, fixtures, leaderboard, users, messages, search, admin, stripe, ai, etc.)
- **`services/`** — Business logic (auctionEngine, fantasyPoints, adminService, authService, leaderboardService, etc.)
- **`middleware/`** — Auth, rate limiting, CSRF, idempotency, validation, error handling, circuit breaker
- **`socket/`** — Socket.IO event handlers
- **`lib/`** — Core infrastructure (jsonDb.ts — the JSON database adapter)
- **`repositories/`** — Type-safe repository layer abstracting over the JSON DB
- **`config/`** — Server configuration (passport, schemas, tournaments)

### Frontend (`frontend/src/`)

- **`pages/`** — Page-level components
- **`components/`** — Reusable UI components
- **`hooks/`** — Custom React hooks (useApi.js for API calls)
- **`store/`** — Zustand stores (useStore.js)
- **`utils/`** — Utility functions (api.js)

### Database

- **JSON DB** (`backend/src/lib/jsonDb.ts`) — the production database. An in-memory store backed by JSON files in `backend/src/data/`. No database server required.
- The JSON DB implements a **Prisma-compatible API** — all route handlers and services use `prisma.model.method()` syntax (`prisma.user.findUnique`, `prisma.room.findMany`, etc.), which a Proxy transparently maps to the JSON file backend.
- New models are created by adding a `.json` file to `backend/src/data/` and registering the name in `jsonDb.ts`. No migrations needed.

## Running Tests

```bash
cd backend && npx vitest run          # Run all backend tests (194+ tests)
cd backend && npx vitest run --coverage  # With coverage report
cd backend && npx vitest run --reporter=verbose  # Verbose output
cd frontend && npm run typecheck      # Frontend type checking
```

Tests use isolated JSON-DB instances in temp directories — no shared mutable state, no database server required.

## Submitting Changes

1. Create a feature branch:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Make focused, minimal changes.
3. Run checks locally before pushing:
   ```bash
   cd backend && npm run typecheck && npm run lint && npm test
   ```
4. Verify the frontend builds and typechecks:
   ```bash
   cd frontend && npm run typecheck && npm run build
   ```
5. Commit with a descriptive message:
   - Format: `type(scope): description`
   - Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
   - Examples:
     - `feat(auction): add anti-snipe timer extension`
     - `fix(bids): correct budget deduction on force-sold`
     - `feat(stripe): add subscription tier support`
6. Push and open a Pull Request. CI will run lint → typecheck → test → build automatically.

## Reporting Issues

Include in your report:

- Steps to reproduce
- Whether the issue is backend, frontend, or database
- Error messages and console output
- Your environment (Node version, OS, database version)

## Adding New Features

### New API Route

1. Create the route file in `backend/src/routes/`.
2. Register it in `backend/src/index.ts`.
3. The JSON DB auto-loads new collections — just create a `.json` file in `backend/src/data/`.

### New Socket Event

1. Add event handlers in `backend/src/socket/`.
2. Emit events from the appropriate service or route.

### New Database Model

1. Create a new JSON file in `backend/src/data/` (e.g., `newmodel.json` with an empty array `[]`).
2. Add the model name to the `modelNames` array in `backend/src/lib/jsonDb.ts`.
3. No migrations needed — the JSON DB dynamically loads `.json` files on startup.

## Deployment Notes

- Frontend deploys to Vercel (`vercel.json` config present).
- Backend deploys to any Node.js host (Railway, Render, Fly.io, etc.). The JSON database is file-based and requires a persistent volume or ephemeral storage.
- Docker Compose includes a production container (`docker-compose.yml`) — the API container uses a named volume for data persistence.
- BullMQ queues require Redis — if Redis is unavailable, scoring falls back to direct synchronous processing.
- Socket.IO requires WebSocket support from the hosting provider.
- Scheduled backups: use `backend/scripts/backup-data.sh` for nightly data snapshots to S3-compatible storage.

## Code of Conduct

This project and everyone participating in it is governed by the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.
