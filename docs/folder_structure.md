# MatchMind — Folder Structure

```
Match-Mind/
├── package.json                    # Root workspace manifest (workspaces: backend, frontend, packages/*)
├── README.md / LICENSE / Makefile
├── .dockerignore / .gitignore / .prettierrc / .editorconfig / .env.example
├── docker-compose.yml / docker-compose.test.yml
├── k8s/                            # Kubernetes deployment manifests
├── .github/                        # CI, CodeQL, deploy, gitleaks, labeler, stale, welcome
├── .husky/                         # pre-commit hooks
│
├── backend/                        # Express + Prisma API server
│   ├── package.json
│   ├── tsconfig.json / vitest.config.js
│   ├── prisma/                     # schema.prisma + migrations
│   ├── src/
│   │   ├── app.ts / server.ts      # Entry points
│   │   ├── index.ts / container.ts # DI setup
│   │   ├── config/                 # env.ts, constants.ts, openapi.ts, passport.ts, schemas.ts
│   │   ├── routes/                 # 17 route modules (auth, auction, draft, rooms, etc.)
│   │   ├── services/               # 22 domain services (auctionEngine, draftRunService, etc.)
│   │   ├── middleware/             # auth, rateLimiter, csrf, errorHandler, etc.
│   │   ├── repositories/          # Data access layer
│   │   ├── infrastructure/        # database, health, shutdown
│   │   ├── socket/                 # WebSocket handlers
│   │   ├── workers/                # Background jobs (auctionWorker)
│   │   ├── errors/                 # DomainError
│   │   ├── utils/                  # Logger, AppError
│   │   ├── lib/                    # prisma client, redis, queue
│   │   ├── data/                   # Static data (players, teams, tournaments, etc.)
│   │   ├── test-utils/            # e2e setup helpers
│   │   ├── e2e/                    # E2E tests (auction-lifecycle, room-lifecycle)
│   │   └── __tests__/             # Remediation & registry tests
│   ├── scripts/                    # Seed, migration, validation scripts
│   ├── Dockerfile / Dockerfile.prod
│   └── instrument.ts
│
├── frontend/                       # React + Vite SPA
│   ├── package.json / vite.config.ts
│   ├── src/
│   │   ├── main.tsx / App.tsx
│   │   ├── views/                  # Auth, DraftRoom, Lobby, Leaderboard, Landing
│   │   ├── components/             # Button, Card, Input, Toast, GlobalSpinner
│   │   ├── store/                  # useAuthStore, useToastStore (zustand)
│   │   ├── hooks/                  # useAuctionAdvice, useLeaderboard, useRooms
│   │   ├── config/ / lib/
│   │   └── index.css / App.css
│   └── e2e/                        # Playwright tests
│
├── packages/shared-types/          # Cross-package type definitions
└── docs/                           # Full documentation suite
    ├── project/                    # analysis_report.md (this pass), plans, tracker, risk register
    ├── community/ decisions/ design/ product/ reference/ technical/
```

## Root Hygiene

- Root holds workspaces + config + top-level dirs only.
- `AGENTS_FIX.md` (AI-scaffolding duplicate), `backend/test-output*.txt` (5 binary test dumps — documented bug BLK-001), debug scripts (`test-script.js`, `test_flow.js`, `test_post_room.js`, `truncate.js`), and `backend/update_schema.js` (duplicate with hardcoded path) **removed**.
- `backend/node_modules/` (18 files tracked by mistake) **untracked** — now correctly gitignored.
