# Issues Log — MatchMind

This file logs issues discovered during production remediation that are deferred for later phases or don't block the current task.

## Phase 1 Discoveries

### Route file documentation mismatch — DECISION: Update docs to match code

- **Severity:** Low
- **Decision:** The `PROJECT_OVERVIEW.md` documents a "MatchMind" prediction product (routes like `predictions.ts`, `highlights.ts`, `leagues.ts`, `squads.ts`, `teams.ts`, `simulation.ts`). The actual codebase implements an "AuctionXI" auction/draft product (routes like `auction.ts`, `franchises.ts`, `fixtures.ts`, `rooms.ts`, `draft.ts`). These are two different product visions. **Decision: Update PROJECT_OVERVIEW.md to accurately describe the current codebase** (auction/draft product) rather than building new routes to match the aspirational docs. This is deferred to Phase 2 after the identity rename is fully complete.
- **Phase 2 item.**

### TypeScript error: fixtures.ts property 'position' on '{}'

- **Severity:** Low (pre-existing)
- **File:** `backend/src/routes/fixtures.ts:130`
- **Notes:** `Property 'position' does not exist on type '{}'`. Pre-existing type error, not introduced by Phase 1 changes. Should be fixed as part of the Phase 2 `as any` elimination pass.

### Coverage threshold raised to 60% — target 80%

- **Severity:** Medium
- **Notes:** Raised from 40% → 60% in Phase 1.5. Current coverage may not actually pass at 60% — the threshold is progressive. Target is 80%+ per the master prompt, which needs component tests (Phase 3).

### Scoring engine wiring verification

- **Severity:** ✅ Already wired
- **Notes:** `scoring.ts` is imported and used by `backend/src/workflows/finalizeMatch.ts` and `backend/src/routes/ai.ts`. No fake scoring paths remain. The 47 unit tests verify correctness.

### AI heuristic fallback audit

- **Severity:** ✅ Not deceptive
- **Notes:** `routes/ai.ts` `generateHeuristicAdvice()` is a deterministic statistical function (budget-per-slot, position scarcity scoring, value sorting). It is not randomized. The response already labels the fallback path differently from the AI path (`getAnthropicAdvice` vs `generateHeuristicAdvice`). No user-deceptive random behavior found.

### Email sending still not implemented

- **Severity:** Medium (Phase 2.5)
- **Notes:** Verification tokens and password reset tokens are logged to console only. Real email delivery needs a provider (Resend/SendGrid).
- **Phase 2 item.**

### Frontend Stub Hooks (useApi.ts) — ✅ Fixed

- `useUpdateReport` — wired to `PATCH /api/admin/reports/:id`
- `useUpdateMatch` — wired to `PATCH /api/admin/fixtures/:id`
- `useCreatePrediction` — wired to `POST /api/predictions`

### JWT_RESET_SECRET — ✅ Fixed

- Now mandatory at startup alongside JWT_SECRET and JWT_REFRESH_SECRET
- All three must be distinct — server refuses to boot if any two match
- `backend/.env.example` updated to include JWT_RESET_SECRET as required
- Auth test includes regression test: forge reset token with JWT_SECRET → assert 400 rejection

### Auth test revokeTokens mock — ✅ Fixed

- The mock was missing `revokeTokens`, causing 500 error in reset-password route
- Fixed by adding mock implementation in `auth.test.ts`

### Admin sportDistribution — ✅ Fixed

- Was hardcoded to `[{ name: 'Football', value: 100 }]`
- Now queries fixtures collection to compute real sport distribution percentages

### Chat message cap (useStore) — ✅ Fixed

- Chat messages now capped at 500 per room with FIFO eviction
- Store test pushes 1000 messages and asserts never exceeds 500

### Identity rename (AuctionXI→MatchMind)

- ✅ docker-compose.yml container name
- ✅ backend/index.ts log messages
- ✅ middleware/metrics.ts prometheus prefixes
- ✅ frontend Navbar brand name + logo (AX→MM)
- ✅ All frontend page `<title>` tags
- ✅ socket/index.ts header
- ✅ lib/jsonDb.ts header + model names comment
- ✅ services/fantasyPoints.ts header
- ✅ services/fantasyPoints.test.ts header
- ✅ routes/ai.ts header
- ✅ test-utils/e2e-setup.ts (temp dir, test email)
- ✅ lib/jsonDb.atomicWrite.test.ts temp dir
- ✅ backend/.env.example (removed DATABASE_URL, added JWT_RESET_SECRET)
- ⏳ ~40+ remaining cosmetic header comments in scripts, e2e tests, test files, and component file headers. These are JSDoc comments only — no functional impact. Remaining clean-up deferred to Phase 2.

## Phase 2+ Items

### SQLite migration (Phase 2.1)

- JSON DB is adequate for single-node but cannot scale. SQLite with `better-sqlite3` is the recommended next step.

### Repository layer enforcement (Phase 2.2)

- Most route files still use `prisma.model.method()` directly instead of repository interfaces. Migration is incomplete.

### `as any` elimination (Phase 2.3)

- The existing codebase still has many `as any` casts. Need a systematic sweep with ESLint rule.

### Auth hardening (Phase 2.4)

- Refresh token revocation, admin soft-delete, server-side XSS sanitization, optionalAuth on AI endpoint.

### Email sending (Phase 2.5)

- Replace console-logged tokens with real email delivery.

### CORS/HTTPS middleware ordering (Phase 2.6)

- Move CORS before rate limiter, HTTPS redirect before route mounting.
