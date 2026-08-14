# Changelog

All notable changes to **Match-Mind** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — 2026-07-04

### Added

#### Backend TypeScript Migration (Complete)

- **Entire backend converted from JavaScript to TypeScript** — 40+ source files migrated
- All 15 route files: `auth.ts`, `predictions.ts`, `matches.ts`, `users.ts`, `admin.ts`, `leaderboard.ts`, `leagues.ts`, `squads.ts`, `ai.ts`, `highlights.ts`, `messages.ts`, `players.ts`, `search.ts`, `simulation.ts`, `stripe.ts`, `teams.ts`
- All 6 middleware files: `auth.ts`, `errorHandler.ts`, `rateLimiter.ts`, `requireAdmin.ts`, `validate.ts`, `asyncHandler.ts`
- All services: `scoring.ts`, `tokenService.ts`, `leaderboardMapper.ts`, `authService.ts`, `adminService.ts`
- Simulation engine: `simulationEngine.ts`, `simulationRunner.ts`
- Socket, workers, workflows: `socket/index.ts`, `workers/queue.ts`, `workers/scoringWorker.ts`, `workflows/finalizeMatch.ts`
- Utilities: `logger.ts`, `AppError.ts`, `jsonDb.ts`, `instrument.ts`
- Configuration: `constants.ts`, `passport.ts`, `schemas.ts`
- Entry point: `index.ts` with ESM imports (`import`/`export default`) and top-level await for Sentry

#### Documentation Updates

- **README.md** — Complete rewrite reflecting new architecture: JSON DB, TypeScript, Sentry, Pino, testing, simplified setup
- **PROJECT_OVERVIEW.md** — Comprehensive update: header badges, tech stack, folder structure, file references, architecture diagrams, testing section, coding standards

#### Test File Migration

- All backend test files converted to `.ts`: `auth.test.ts`, `predictions.test.ts`, `scoring.test.ts`
- Tests use `async createTestApp` with `await import()` for ESM route module loading
- **81 total tests passing** (scoring: 47, auth: 14, predictions: 11, API hooks: 9)

### Changed

#### Module System

- Backend migrated from CommonJS (`require`/`module.exports`) to **ESM** (`import`/`export default`)
- All `.js` source files removed — only `.ts` source files remain
- `tsconfig.json` updated with `moduleResolution: "bundler"` and strict mode
- `vitest.config.js` updated to find `.test.ts` files

#### Dependencies

- Added `@types/express`, `@types/passport`, `@types/passport-jwt`, `@types/passport-google-oauth20`, `@types/cookie-parser`, `@types/bcryptjs`, `@types/cors`, `@types/helmet`, `@types/jsonwebtoken`, `@types/uuid`
- `tsx` used as TypeScript runtime for both dev and production

### Fixed

#### Type Safety

- `DatabaseClient` type properly exported from `repositories/index.ts`
- `AuthenticatedRequest` type extends Express `Request` for typed auth middleware
- All route handlers have proper type annotations

#### Code Quality

- `messages.ts` route params preserved as `:userId` (API contract maintained)
- `matches.ts` scoring result correctly captured from `finalizeMatch`
- Old `.js` files cleaned up — no duplicate `schemas.js`/`schemas.ts` or `authService.js`/`authService.ts`

## [1.0.0] — 2026-06-01

### Added

#### Backend (Express.js)

- **15 route files** covering: admin, AI chat, auth, highlights, messages, notifications, players, predictions, search, squads, stats, Stripe payments, teams, users, webhooks
- JWT authentication with Passport.js and `jsonwebtoken`
- Google OAuth 2.0 via `passport-google-oauth20`
- Role-based access (User / Admin) with admin route protection
- WebSocket real-time communication via Socket.IO
- BullMQ job queue with Redis for background processing
- AI integration with Anthropic SDK for chat features
- Stripe payment processing with webhook handling
- Email notifications via Nodemailer
- Prisma ORM with PostgreSQL database
- Zod input validation schemas
- Security: Helmet headers, CORS, signed cookies, bcryptjs password hashing
- Monitoring: Morgan request logging

#### Frontend (React + Vite)

- Modern React application with Vite build tool
- ESLint configuration for code quality
- Responsive UI components
- Integration with backend API and WebSocket

#### Infrastructure

- Docker Compose for local development (Node + PostgreSQL + Redis)
- Prisma migrations for database schema management
- Environment-based configuration with `.env` files

---

## [0.1.0] — Initial Development

### Added

- Project scaffolding (monorepo with backend/ and frontend/)
- Express.js server setup
- React + Vite frontend template
- PostgreSQL schema via Prisma
- Docker Compose configuration
