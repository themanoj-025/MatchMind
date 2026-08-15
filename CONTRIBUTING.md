# Contributing to MatchMind

Thanks for your interest in MatchMind! Bug reports, documentation, and pull requests are welcome.

## Getting started

1. Fork the repository and clone your fork.
2. Create a feature branch: `git checkout -b feature/amazing`.
3. Install workspace dependencies and generate the Prisma client: `npm run setup`.
4. Copy `.env.example` to `.env` and configure PostgreSQL + Redis.

## Development workflow

- Add or update tests for every change.
- Run the quality gates:
  - `npm run lint` — ESLint on backend + frontend
  - `npm run typecheck` — `tsc --noEmit`
  - `npm run test` — Vitest suites (backend + frontend)
- Verify the app boots with `npm run dev:up`.

## Commit conventions

Keep commits small and focused. Prefix messages with a type, e.g. `feat:`, `fix:`, `docs:`, `test:`.

## Opening a pull request

1. Push your branch and open a PR against `main`.
2. Describe what you changed and why.
3. Link any related issue.

By contributing, you agree that your contributions are licensed under the MIT License.
