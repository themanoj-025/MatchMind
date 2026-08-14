# Match-Mind — Old Tree → New Tree

## This pass (2026-08-11)

```
Before                                After
──────                                ─────
docs/migration_summary.md      →      docs/migration/migration_summary.md
—                                     docs/module_dependency.md        (new)
—                                     docs/startup_flow.md             (new)
—                                     docs/package_overview.md         (new)
—                                     docs/migration/old_tree_to_new_tree.md (new)
—                                     docs/migration/file_move_ledger.md     (new)
```

## Prior pass (v5.0 modernization, commit `7fb117b9`)

Match-Mind was restructured by the v5.0 pass into the current monorepo layout;
its record (scope, changes, file-move log, import updates, verification, risk,
needs-human-review) lives at `docs/migration/migration_summary.md`.
Tree-level view:

```
Before (flat)                         After (canonical)
──────                                ─────
*.ts flat modules            →        backend/src/
                                       ├── routes/ · services/ · middleware/
                                       ├── config/ · lib/ · workers/ · socket/
                                       ├── repositories/ · infrastructure/
                                       └── errors/ · utils/ · data/
*.tsx flat modules           →        frontend/src/
                                       ├── views/ · components/ · hooks/ · store/
                                       └── lib/ · config/
—                               →      packages/shared-types/ (shared types)
docs                          →        docs/ (full suite + reference volumes)
k8s/deploy                    →        k8s/
```

## No-code-move rationale (this pass)

The layout already conforms (workspaces monorepo, feature-cohesive `backend/src`
and `frontend/src`, shared-types package, canonical docs/infra dirs). This pass
only consolidates the migration record and completes the Phase-6 doc suite —
zero code changed.
