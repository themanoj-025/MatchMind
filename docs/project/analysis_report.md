# MatchMind — Repository Analysis Report (v5.0)

> Generated during the Ultra Master Repository Modernization pass.
> Scope: inventory, classification, duplicate/dead-code audit, and risk assessment.

## 1. Overview

| Attribute          | Value                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Project**        | MatchMind — Fantasy cricket/sports platform (auction, draft, rooms, tournaments)                                             |
| **Stack**          | TypeScript monorepo (npm workspaces): backend (Express/Node, Prisma, PostgreSQL, Redis), frontend (React/Vite), shared-types |
| **Entry points**   | `backend/src/app.ts` + `backend/src/server.ts`, `backend/src/workers/`, `frontend/src/main.tsx`                              |
| **Package layout** | npm workspaces: `backend/`, `frontend/`, `packages/shared-types/`                                                            |
| **Tests**          | Backend: vitest (unit + e2e); Frontend: Playwright (e2e) + tsc typecheck                                                     |

## 2. Duplicate / Dead Code Audit

| Item                                                                                                 | Verdict     | Evidence                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS_FIX.md` (root)                                                                               | **DELETE**  | Leftover "ULTRA MASTER FIX PROMPT v7.0" AI scaffolding, duplicated in 16 sibling repos; referenced only by .dockerignore + PROJECT_OVERVIEW (both updated)                                                                            |
| `backend/node_modules/` (18 files, 11MB)                                                             | **UNTRACK** | Committed by mistake; `.gitignore` has `node_modules/` which now covers them after untracking; `git check-ignore --no-index` confirms they are ignored                                                                                |
| `backend/test-output*.txt` (5 files)                                                                 | **DELETE**  | UTF-16 test-output dumps that **break pytest collection** (`UnicodeDecodeError`) — this is the project's own documented bug **BLK-001** in Tracker.md/RiskRegister.md: "🔴 Open — Move .txt artifacts out of tests dir / add ignore") |
| `backend/test-script.js`, `backend/test_flow.js`, `backend/test_post_room.js`, `backend/truncate.js` | **DELETE**  | Ad-hoc debug scripts with hardcoded test-DB URLs; no CI/config references; no active code imports                                                                                                                                     |
| `backend/update_schema.js`                                                                           | **DELETE**  | Duplicate of root `updateSchema.js` (which is the portable canonical version); backend copy has a hardcoded absolute `f://GITHUB//...` path broken for all other machines                                                             |

## 3. Reference updates

| File                           | Change                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `.dockerignore`                | Removed stale `AGENTS_FIX.md` exclusion                                           |
| `PROJECT_OVERVIEW.md`          | Removed `AGENTS_FIX.md`, `test-output*.txt`, `update_schema.js` from tree listing |
| `docs/project/Tracker.md`      | BLK-001 marked "🟢 Resolved — test-output artifacts removed in v5.0 pass"         |
| `docs/project/RiskRegister.md` | R-009 marked "🟢 Resolved (v5.0 pass)"                                            |

## 4. Verification Summary (this pass)

| Check                           | Result                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `git grep` for stale references | **Clean** (no remaining AGENTS_FIX, update_schema, or test-output references in code/config/structure files) |
| `git check-ignore --no-index`   | `backend/node_modules/` correctly ignored after untracking                                                   |
| Frontend typecheck (tsc -b)     | Could not run in this environment (npx timeout) — pre-existing; not affected by the cleanup                  |
| Git hygiene                     | Clean after commit; repo shrunk by ~11MB (untracked node_modules)                                            |

## 5. Needs Human Review

1. Run `npm run typecheck` and `npm run test:ci` after cleanup to verify no regressions.
