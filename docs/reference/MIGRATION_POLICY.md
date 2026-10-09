# Database Migration Policy

## Overview

This document standardizes the approach to modifying the database schema and executing migrations across all Match-Mind environments. Strict adherence is required to prevent data loss or drift.

## Environments

### 1. Local Development (`env: development`)

- **Action**: Iterative, destructive development.
- **Command**: `npx prisma db push`
- **When to Use**: When actively developing features on a local branch. If the changes are destructive (e.g., dropping columns), it is acceptable to use `--force-reset` or `--accept-data-loss` _locally only_.

### 2. Migration Generation (`env: development -> staging`)

- **Action**: Creating a permanent, repeatable script.
- **Command**: `npx prisma migrate dev --name <descriptive-name>`
- **When to Use**: When local development is complete, you must solidify your changes into a migration file _before_ opening a Pull Request.
- **Review**: Migration SQL files must be audited during PR review to ensure no unintentional destructive operations are included (e.g., `DROP TABLE` without replacement).

### 3. Staging & Production (`env: production` or `env: staging`)

- **Action**: Non-destructive, automated deployment.
- **Command**: `npx prisma migrate deploy`
- **When to Use**: Exclusively used by the CI/CD pipeline during the deployment phase.
- **Warning**: **Never** run `db push` or `migrate dev` against a production or staging database.

## Down Migrations

Currently, Prisma does not natively support "down" migrations. If a deployment fails or needs rollback:

1. Revert the code via Git.
2. If the schema change was purely additive, the old code can run against the new schema.
3. If it was destructive or transformative, you must manually connect to the database, write a raw SQL revert script, or restore from the latest automated snapshot. **Do not attempt to push a reverted schema directly.**
