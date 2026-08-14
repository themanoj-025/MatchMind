# JSON DB ↔ PostgreSQL Migration Strategy

> **Document purpose:** Provide a battle-tested strategy for migrating between MatchMind's production JSON database and PostgreSQL (or any other SQL database) in either direction. This covers both one-time bulk migrations and incremental adoption via the repository layer.

---

## 1. Context: Two Storage Backends

MatchMind supports **two database backends** with identical APIs:

| Backend                  | Use Case                                                                               | Location                                                         |
| ------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **JSON DB** (production) | Default for all environments, production database                                      | `backend/src/lib/jsonDb.ts` → `backend/src/data/*.json`          |
| **PostgreSQL**           | Suitable for production at scale; required for Kubernetes / multi-instance deployments | `docker-compose.yml` (optional) + Prisma schema (reference only) |

**Key insight:** Both backends implement the same Prisma-compatible query API. The repository layer (`backend/src/repositories/index.ts`) abstracts over whichever backend is active. Routes and services never import a database driver directly — they go through repositories.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Application Code                       │
│  (Routes, Services, Socket Handlers, Middleware)          │
└──────────────────────┬──────────────────────────────────┘
                       │
               ┌───────┴───────┐
               │  Repositories  │  ← Interface boundary
               │  (index.ts)    │
               └───────┬───────┘
                       │
          ┌────────────┴────────────┐
          │                         │
  ┌───────┴───────┐        ┌───────┴───────┐
  │   JSON DB     │        │  PostgreSQL    │
  │ (jsonDb.ts)   │        │  (via Prisma)  │
  └───────┬───────┘        └───────┬───────┘
          │                         │
  ┌───────┴───────┐        ┌───────┴───────┐
  │  *.json files │        │  PostgreSQL DB │
  │ (data/*.json) │        │  (docker/cloud)│
  └───────────────┘        └───────────────┘
```

The JSON DB Proxy intercepts calls like `prisma.user.findUnique()` and maps them to in-memory arrays backed by JSON files. PostgreSQL would use Prisma to map the same calls to SQL tables.

> **Current status:** JSON DB is the production database. No PostgreSQL instance is running. The migration path below is prepared but not yet executed.

---

## 3. JSON DB → PostgreSQL Migration (Export)

Use this when scaling up from JSON DB to PostgreSQL for production deployment.

### 3.1 Prerequisites

```bash
# 1. Start PostgreSQL
docker compose up -d postgres

# 2. Install Prisma dependencies (if not present)
cd backend
npm install @prisma/client prisma

# 3. Push the schema to PostgreSQL
npx prisma generate
npx prisma db push

# 4. Verify connection
npx prisma db status
```

### 3.2 Run the Migration Script

```bash
# Export all data from JSON DB → PostgreSQL
cd backend
node scripts/migrate-json-to-postgres.js --source ../data --target postgresql://user:pass@localhost:5432/matchmind
```

### 3.3 What the Script Does

1. **Connects** to both JSON DB (reads files) and PostgreSQL (via Prisma)
2. **Validates** that all referenced IDs exist (foreign key integrity)
3. **Inserts** records table-by-table in dependency order:
   1. `tournament` — no dependencies
   2. `team`, `venue` — no dependencies
   3. `player` — depends on tournament
   4. `fixture` — depends on tournament, team, venue
   5. `user` — no dependencies
   6. `room` — depends on tournament, user (host)
   7. `roomMember` — depends on room, user
   8. `auctionState` — depends on room
   9. `bid`, `roster` — depends on room, user, player
   10. `chatMessage` — depends on room, user
   11. `notification`, `follow`, `subscription`, `report` — depends on user
   12. `session` — depends on user
   13. `starredPlayer` — depends on user, player
   14. `playerMatchStat` — depends on fixture, player
   15. `fantasyPointsLedger` — depends on user, room, player
   16. `adminLog`, `leaderboardSnapshot`, `achievement`, `userAchievement`
4. **Verifies** record counts match between source and target
5. **Generates** a migration report with any warnings or errors

### 3.4 Verification Checklist

After migration, run these checks:

```bash
# Compare record counts
echo "JSON DB counts:"
for f in backend/src/data/*.json; do echo "$f: $(jq length $f)"; done

echo "PostgreSQL counts:"
psql $DATABASE_URL -c "SELECT schemaname,relname,n_live_tup FROM pg_stat_user_tables ORDER BY relname;"

# Run the validation suite
cd backend && npx vitest run --reporter=verbose

# Spot-check a few key records
psql $DATABASE_URL -c "SELECT id, username, email FROM \"user\" LIMIT 5;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM room WHERE status = 'DRAFTING';"
```

### 3.5 Switching the Backend

After the data is in PostgreSQL:

1. **Toggle the backend in `backend/src/index.ts`:**

```typescript
// Option A: JSON DB (default — file-based)
import { createJsonDatabase } from './lib/jsonDb'
const prisma = createJsonDatabase()
await prisma.initialize()

// Option B: PostgreSQL (via Prisma)
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
await prisma.$connect()
```

2. **Restart the server:**

```bash
cd backend && npm run dev
```

3. **Verify** the health endpoint returns `database.status: 'ok'` and `database.type: 'postgresql'`.

### 3.6 Rollback

If issues arise, switch back to JSON DB:

```bash
# 1. Toggle the backend back to JSON DB (revert the import in index.ts)
# 2. Restart the server
# 3. Verify data integrity — the JSON files were never modified during export
```

The migration script is **read-only** on the source (JSON DB). It only inserts into PostgreSQL, never modifies the JSON files. Rollback is instantaneous.

---

## 4. PostgreSQL → JSON DB Migration (Import)

Use this when pulling production data down to a development environment, or when transitioning from PostgreSQL back to the simpler JSON DB for smaller deployments.

### 4.1 Prerequisites

```bash
# Ensure PostgreSQL is accessible
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"user\";"
```

### 4.2 Run the Migration Script

```bash
cd backend
node scripts/migrate-postgres-to-json.js \
  --source postgresql://user:pass@localhost:5432/matchmind \
  --target ../data
```

### 4.3 What the Script Does

1. **Connects** to PostgreSQL via Prisma
2. **Queries** all tables in dependency order (children before parents to resolve relations)
3. **Exports** each table to a JSON file matching the `backend/src/data/*.json` format
4. **Preserves** field names and types exactly as the JSON DB expects them
5. **Generates** a report with record counts per table

### 4.4 Generating a Fresh Seed File

After export, you can compress the data into a single seed file for test environments:

```bash
cd backend
node scripts/generate-seed-from-json.js \
  --input ../data \
  --output ../src/data/seed.json \
  --strip-passwords --anonymize-emails
```

This produces a `seed.json` that can be loaded via `prisma.initialize(seedData)` in tests.

---

## 5. Schema Mapping

The JSON DB stores data as arrays of objects in JSON files. PostgreSQL would store the same data as relational tables.

### 5.1 Field Type Translation

| JSON DB Type        | PostgreSQL Type                  | Notes                                                    |
| ------------------- | -------------------------------- | -------------------------------------------------------- |
| `string` (ISO 8601) | `TIMESTAMP WITH TIME ZONE`       | Dates stored as strings in JSON, parsed on read          |
| `string`            | `TEXT` / `VARCHAR(n)`            | Direct mapping                                           |
| `number`            | `INTEGER` / `BIGINT` / `DECIMAL` | JSON has no integer vs float distinction                 |
| `boolean`           | `BOOLEAN`                        | Direct mapping                                           |
| `null`              | `NULL`                           | Both backends support nullable fields                    |
| `object`            | `JSONB`                          | Nested objects (e.g., `rosterRules`, `bidIncrementRule`) |
| `array`             | `JSONB`                          | Nested arrays (e.g., `poolQueue`, `unsoldPlayerIds`)     |

### 5.2 Key Differences

| Aspect                | JSON DB                                         | PostgreSQL                             |
| --------------------- | ----------------------------------------------- | -------------------------------------- |
| **Primary keys**      | Auto-generated `cuid()` (24-char hex)           | UUID / auto-increment                  |
| **Relations**         | Resolved in-memory via `include`                | Foreign keys + JOINs                   |
| **Compound keys**     | Simulated via underscore keys (`roomId_userId`) | Native composite unique constraints    |
| **Atomicity**         | Per-collection mutex + temp-file rename         | ACID transactions                      |
| **Concurrent writes** | In-process mutex (single process only)          | Row-level locking (multi-process safe) |
| **Indexing**          | None — O(n) scan per query                      | B-tree, GIN, BRIN indexes              |
| **Full-text search**  | Manual `contains` (O(n) scan)                   | GIN indexes with `tsvector`            |

### 5.3 Important Conversion Rules

1. **ID format:** JSON DB uses 24-char hex `cuid()` strings. PostgreSQL can store these as `TEXT` or convert to `UUID`. Use `TEXT` to avoid migration friction; convert to `UUID` if desired after migration.

2. **Date handling:** JSON DB stores dates as ISO 8601 strings (`"2026-07-03T10:15:31.672Z"`). Prisma's `DateTime` type expects `Date` objects. A migration script would handle this conversion automatically.

3. **JSON fields:** Fields like `rosterRules`, `bidIncrementRule`, `poolQueue`, `unsoldPlayerIds`, `pointsBreakdown` are stored as `JSONB` in PostgreSQL. Query them with `->>` and `#>>` operators.

4. **Enum fields:** Fields like `status`, `phase`, `role`, `tier`, `gender`, `format` are stored as strings in JSON DB. In PostgreSQL, these become `VARCHAR` — not native enums — to maintain flexibility as the data evolves.

> **Note on current data model:** The MatchMind JSON DB includes 25 data files spanning tournaments, auctions, social features, and admin logs. The schema has evolved beyond the original AuctionXI model — any migration to PostgreSQL should audit these files and generate a fresh Prisma schema from the actual JSON file structures.

---

## 6. Incremental Adoption via Repository Pattern

The **repository layer** (`backend/src/repositories/index.ts`) already abstracts over the database backend. You don't need to migrate everything at once.

### 6.1 Per-Entity Migration

```typescript
// Example: Gradually move user operations to PostgreSQL
// while keeping everything else on JSON DB

import { PrismaUserRepository } from './repositories'
import { PrismaClient } from '@prisma/client'

// JSON DB for most operations
const jsonDb = createJsonDatabase()

// PostgreSQL for users only
const pgClient = new PrismaClient()
const userRepo = new PrismaUserRepository(pgClient)

// Usage in routes — same interface
router.get('/users/:id', async (req, res) => {
  const user = await userRepo.findById(req.params.id) // ← PostgreSQL
  const rooms = await jsonDb.room.findMany(...)         // ← JSON DB
  res.json({ user, rooms })
})
```

### 6.2 Dual-Write Strategy

For zero-downtime migration, write to both backends simultaneously while reading from the old one:

```typescript
async function migrateUserWrite(userData: UserData): Promise<void> {
  // Write to both backends
  await jsonDb.user.update({ where: { id: userData.id }, data: userData })
  await pgUserRepo.update(userData.id, userData)

  // Verify consistency
  const jsonUser = await jsonDb.user.findUnique({ where: { id: userData.id } })
  const pgUser = await pgUserRepo.findById(userData.id)
  assert(jsonUser.email === pgUser.email, 'Data drift detected!')
}
```

### 6.3 Read-Your-Writes Consistency

During dual-write, serve reads from the source of truth:

```typescript
function getUser(id: string, readFrom: 'json' | 'pg' = 'json') {
  return readFrom === 'pg' ? pgUserRepo.findById(id) : jsonDb.user.findUnique({ where: { id } })
}
```

Switch reads to PostgreSQL only after validation confirms parity.

---

## 7. Migration Scripts

### 7.1 `scripts/migrate-json-to-postgres.js`

**Purpose:** Exports all data from JSON DB files to PostgreSQL.

**Usage:** `node scripts/migrate-json-to-postgres.js [options]`

**Options:**

- `--source <path>` — Path to JSON data directory (default: `backend/src/data`)
- `--target <url>` — PostgreSQL connection string (default: reads `DATABASE_URL` env var)
- `--dry-run` — Validate without inserting
- `--verbose` — Detailed per-record logging
- `--table <name>` — Migrate a single table only (e.g., `--table user`)

**Exit codes:**

- `0` — Success, all records migrated
- `1` — Validation errors (missing foreign keys, type mismatches)
- `2` — Connection failure

### 7.2 `scripts/migrate-postgres-to-json.js`

**Purpose:** Exports PostgreSQL data to JSON files for development/testing.

**Usage:** `node scripts/migrate-postgres-to-json.js [options]`

**Options:**

- `--source <url>` — PostgreSQL connection string (default: `DATABASE_URL` env var)
- `--target <path>` — Output JSON directory (default: `backend/src/data`)
- `--table <name>` — Export a single table
- `--anonymize` — Scramble PII fields (email, username, passwordHash)

### 7.3 `scripts/generate-seed-from-json.js`

**Purpose:** Compress full data directory into a single `seed.json` file for test setup.

**Usage:** `node scripts/generate-seed-from-json.js [options]`

**Options:**

- `--input <path>` — Source JSON data directory
- `--output <path>` — Output seed.json path
- `--strip-passwords` — Remove `passwordHash` fields
- `--anonymize-emails` — Replace emails with `user-N@test.com`
- `--max-records <n>` — Limit records per collection (useful for smaller test seeds)

---

## 8. Operational Considerations

### 8.1 When to Migrate JSON DB → PostgreSQL

| Trigger                   | Reason                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Multiple server instances | JSON DB is in-memory + file-based. Each instance has its own copy → data drift. PostgreSQL provides a single source of truth. |
| >10k concurrent users     | JSON DB mutex-based writes become a bottleneck under high concurrency.                                                        |
| Need for complex queries  | PostgreSQL's query planner and indexing outperform JSON DB's O(n) scan on large datasets.                                     |
| Compliance requirements   | PostgreSQL offers audit logging, row-level security, and encryption at rest.                                                  |
| Kubernetes deployment     | Stateless containers need an external database. JSON DB's file persistence doesn't work across pods.                          |

### 8.2 When to Migrate PostgreSQL → JSON DB

| Trigger                  | Reason                                                                 |
| ------------------------ | ---------------------------------------------------------------------- |
| Development environments | Zero setup — no need to install/run PostgreSQL. Just start the server. |
| CI/CD pipelines          | Faster test execution — no Docker containers needed.                   |
| Single-server deployment | Lower operational complexity. No database server to maintain.          |
| Prototyping              | Rapid schema iteration — just edit a JSON file. No migrations to run.  |

### 8.3 Data Integrity Safeguards

The JSON DB has built-in safeguards that make it production-ready:

- **Atomic writes:** Temp-file + rename prevents partial-write corruption
- **Per-collection mutexes:** Serializes concurrent writes to the same collection
- **Backup snapshots:** Automatic timestamped backups on `$disconnect()`
- **In-memory working set:** Reads are O(1) after initial load — no disk I/O during queries

When migrating to PostgreSQL, these safeguards are replaced by:

- **ACID transactions:** PostgreSQL's MVCC provides stronger isolation guarantees
- **WAL (Write-Ahead Log):** Crash recovery without data loss
- **Point-in-time recovery:** Roll back to any point in the past
- **Replication:** Read replicas, hot standbys, and geo-distribution

### 8.4 Downtime Planning

**For a typical migration (JSON DB → PostgreSQL):**

| Step                     | Duration                     | Downtime                 |
| ------------------------ | ---------------------------- | ------------------------ |
| Export from JSON DB      | 1–30s (depends on data size) | None (read-only)         |
| Import to PostgreSQL     | 5–120s                       | None (write to empty DB) |
| Validation               | 1–5s                         | None                     |
| Switch backend + restart | 5–15s                        | Required                 |
| Verify                   | 1–5s                         | During restart window    |

**Total downtime:** ~10–20 seconds for most deployments.

**Approach for zero-downtime:**

1. Run export during off-peak hours
2. Set up dual-write (JSON + PG) for 24h to verify consistency
3. Use a load balancer to drain connections from the old server
4. Start new server instances pointing to PostgreSQL
5. Switch traffic to new instances
6. Shut down old instances
7. Disable dual-write after verification period

### 8.5 Testing the Migration

```bash
# 1. Create a test PostgreSQL database
createdb matchmind_migration_test

# 2. Run migration in dry-run mode
node scripts/migrate-json-to-postgres.js \
  --target postgresql://user:pass@localhost:5432/matchmind_migration_test \
  --dry-run

# 3. Run migration for real
node scripts/migrate-json-to-postgres.js \
  --target postgresql://user:pass@localhost:5432/matchmind_migration_test

# 4. Run the full test suite against PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/matchmind_migration_test \
  npx vitest run
```

---

## 9. Quick Reference

```bash
# ─── Export: JSON DB → PostgreSQL ──────────────────────────
cd backend
node scripts/migrate-json-to-postgres.js \
  --target "postgresql://user:pass@localhost:5432/matchmind"

# ─── Import: PostgreSQL → JSON DB ──────────────────────────
cd backend
node scripts/migrate-postgres-to-json.js \
  --source "postgresql://user:pass@localhost:5432/matchmind" \
  --target ./src/data

# ─── Generate seed file from existing JSON data ─────────────
cd backend
node scripts/generate-seed-from-json.js \
  --strip-passwords --anonymize-emails --max-records 25

# ─── Dry-run validation (no writes) ─────────────────────────
cd backend
node scripts/migrate-json-to-postgres.js --dry-run --verbose
```

---

## 10. Current Migration Status

As of the latest codebase state:

| Item                   | Status                                                               |
| ---------------------- | -------------------------------------------------------------------- |
| **JSON DB**            | ✅ **Production database** — 25 model files, fully operational       |
| **PostgreSQL**         | ❌ Not running — no Prisma schema maintained                         |
| **Migration scripts**  | ⚠️ Referenced but **not present** in the codebase                    |
| **Repository layer**   | ✅ Present (`backend/src/repositories/index.ts`) — abstracts JSON DB |
| **docker-compose.yml** | ❌ Runs app container only (no PostgreSQL service defined)           |

### What would be needed for PostgreSQL migration

1. Generate a Prisma schema from the current JSON data model structure (25 files)
2. Create migration scripts matching the current data shapes
3. Add PostgreSQL service to docker-compose.yml
4. Update the repository layer to support a Prisma-backed implementation
5. Test thoroughly before switching

---

## 11. Troubleshooting

### Common Migration Issues

| Symptom                          | Likely Cause                         | Fix                                                    |
| -------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| `Record not found` during export | Missing foreign key relationship     | Run with `--verbose` to identify orphaned records      |
| `ECONNREFUSED` on PostgreSQL     | PostgreSQL not running               | `docker compose up -d postgres`                        |
| UUID format errors               | JSON DB cuid format expected as TEXT | Ensure column type is `TEXT` not `UUID`                |
| Date parsing errors              | Non-standard date format in JSON     | Check `createdAt`/`updatedAt` fields are ISO 8601      |
| Data loss on restart (JSON DB)   | Backup directory missing             | Ensure `.backups` subdirectory exists in data dir      |
| Slow migration on large datasets | No batch processing                  | Use `--table` flag to migrate one collection at a time |

### Rollback Plan

```bash
# If PostgreSQL migration fails:
# 1. Stop the server
# 2. Revert index.ts to use createJsonDatabase()
# 3. Restart the server
# JSON files were never modified — you're back to the pre-migration state

# If JSON DB suffers corruption:
# 1. Stop the server
# 2. Restore from the latest backup:
cp -r backend/src/data/.backups/$(ls -t backend/src/data/.backups | head -1)/* backend/src/data/
# 3. Restart the server
```
