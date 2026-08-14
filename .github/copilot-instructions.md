# MatchMind — Copilot Instructions

## Code conventions

- Frontend: React 19 + JSX (ES modules), Vite 8, Tailwind CSS v4
- Backend: Node.js + Express 5 (CommonJS, `require`/`module.exports`)
- State: Zustand (frontend), HTTP + Socket.io (real-time)
- Indentation: 2-space for JS/TS/JSX, 4-space for Python
- Commits: Conventional Commits (`type(scope): description`)

## Key commands

- Full dev: `npm run dev` (starts both servers)
- Install: `npm run install:all`
- Build frontend: `npm run build`
- DB setup: `npm run prisma:generate && npm run prisma:push && npm run prisma:seed`

## Architecture

- `backend/` — Express API (routes/, services/, workers/, socket/)
- `frontend/` — React SPA (components/, pages/, hooks/, store/)
- Database: PostgreSQL with Prisma 7 (17 models, 10 enums)
- Queues: BullMQ with Redis (scoring, leaderboard resets)
- Socket events: UPPER_SNAKE_CASE naming
- Routes: Express 5 with `/api/` prefix, JWT auth middleware
