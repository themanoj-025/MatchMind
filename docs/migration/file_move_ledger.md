# Match-Mind — File Move Ledger

## This pass (2026-08-11)

| Old path                    | New path                              | Category  | Reason                                                                        | Risk            | Verified                                             |
| --------------------------- | ------------------------------------- | --------- | ----------------------------------------------------------------------------- | --------------- | ---------------------------------------------------- |
| `docs/migration_summary.md` | `docs/migration/migration_summary.md` | Meta/docs | Consolidate migration records under `docs/migration/` per enterprise standard | Low (docs only) | ✅ `git mv` preserved history; no inbound refs found |

## Prior pass (v5.0 modernization, commit `7fb117b9`)

The v5.0 pass moved application code into the current monorepo layout. Its
complete file-move log is preserved at
`docs/migration/migration_summary.md` (§ File move log, § Import/reference
update summary, § Verification report). Also documented in
`docs/decisions/001-backend-frontend-restructure.md`.

## Non-moves (documented decisions)

| Path                                                                         | Decision          | Reason                                                             |
| ---------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| `backend/**`                                                                 | keep              | npm workspace; Docker/CI/Makefile contract (`cd backend && npm …`) |
| `frontend/**`                                                                | keep              | npm workspace; Vite/Playwright contract                            |
| `packages/shared-types/`                                                     | keep              | Shared types workspace consumed by both apps                       |
| `updateSchema.js`, `Makefile`, `package.json`, `docker-compose*.yml`, `k8s/` | keep              | Canonical root tooling/metadata                                    |
| `.env` files, `node_modules/`, `dist/`, `.pytest_cache/`, `.husky/_/`        | leave (untracked) | Secrets/runtime artifacts, correctly gitignored                    |
