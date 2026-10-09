# ADR 0001: Custom JSON Database over PostgreSQL (Initial Architecture)

## Status

Accepted

## Context

MatchMind required rapid prototyping and iteration for a feature-complete real-time sports prediction and draft platform. Early in the lifecycle, the schema for 25+ domain models (tournaments, auction rooms, scoring ledgers, user profiles) was highly volatile.
Additionally, the goal was to provide a "zero-ops" onboarding experience for open-source contributors and reviewers, eliminating the need for local Dockerized databases, migrations, and complex setup scripts.

## Decision

We implemented a custom **JSON File-Based Database** as the primary data store during the initial lifecycle, accessible via a proxy layer that precisely mimics the `PrismaClient` API interface.

The custom implementation features:

- **In-memory store** populated at startup from `backend/src/data/*.json`.
- **Atomic Persistence**: Every write flushes to disk using temp-file writing (`fs.renameSync`) to prevent corruption.
- **Mutex locks**: `async-mutex` ensures concurrent writes to the same collection are serialized.
- **Prisma-compatible querying**: Supports `include`, `select`, relational joins, and standard operators (`contains`, `gt`, `lt`).

## Consequences

### Positive

- **Development Velocity**: Schema changes did not require migration scripts. Developers could modify `.json` files directly to test edge cases.
- **Zero-Ops Setup**: New developers could run `npm install` and `npm run dev` and immediately have thousands of seeded records without a Postgres container.
- **Portability**: The Prisma proxy pattern meant business logic (`req.app.get('prisma').model...`) was written as if a real database existed, minimizing technical debt for a future migration.

### Negative

- **Scalability Limit**: A single in-memory store cannot horizontally scale across multiple Node.js instances.
- **Memory Constrained**: All 25 collections are loaded into RAM.
- **Performance**: Deep relational joins (`include`) are computed in-memory O(N) rather than via optimized SQL execution plans.

## Trigger Conditions for Migration

While JSON DB served the development and initial launch phases perfectly, a migration to PostgreSQL is required (and planned/executed) when:

1. **Concurrent Users > 10,000**: The per-collection mutex locking introduces latency at high concurrent write volumes (e.g., live draft bids).
2. **Multi-instance Deployment**: When deploying across multiple regions or instances to handle WebSocket load, a centralized Postgres instance (or distributed DB) is strictly required to prevent split-brain data states.
3. **Data Size > RAM**: When the JSON file sizes exceed optimal Node.js heap allocations.

_(Note: As the project matures, the migration to PostgreSQL using the existing Prisma schema is the documented next step in the infrastructure evolution)._
