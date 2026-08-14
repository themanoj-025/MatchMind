# ADR-001: Backend & Frontend Restructuring

**Date:** 2026-07-13
**Status:** Accepted

## Context

The initial architecture of Match-Mind had several structural and performance issues:

- **Backend Routing:** Routes were flat and not versioned. Logic was tightly coupled to Express requests, making it hard to test or reuse.
- **Error Handling:** Used repetitive `asyncHandler` wrappers, which are unnecessary in Express 5.
- **Type Safety:** The backend contained numerous `any` types, particularly around complex Prisma payloads and Redis interactions.
- **Frontend State Management:** Data fetching was performed using scattered `fetch()` calls within React components, lacking caching, retries, or standardized loading states.
- **Security:** Secrets in `docker-compose.yml` were hardcoded.

## Decisions

1. **API Versioning & Routing Structure**
   - Implemented `/api/v1` global prefix.
   - Extracted server setup, database connection, and graceful shutdown logic into a dedicated `src/infrastructure` folder.

2. **Error Handling Modernization**
   - Removed all custom `asyncHandler` middleware in favor of Express 5's native async promise rejection handling.
   - Refactored centralized error formatting for clarity and consistency.

3. **Strict Type Safety Enforcement**
   - Eliminated `any` usages across the backend.
   - Employed `// @ts-ignore` only as a tactical escape hatch for insurmountable Prisma payload type complexities when returning deeply nested nested relational objects.

4. **Frontend Data Fetching (React Query)**
   - Adopted `@tanstack/react-query` to manage server state.
   - Migrated component-level `fetch` logic in `Lobby`, `Leaderboard`, and `DraftRoom` into custom hooks (`useRooms`, `useLeaderboard`, `useAuctionAdvice`).

5. **Security & DevOps Polish**
   - Hardened `docker-compose.yml` by using `.env` variables for PostgreSQL credentials instead of hardcoded strings.
   - Validated existing rate-limiting logic on AI and core auction endpoints.
   - Introduced Playwright for End-to-End (E2E) testing of critical user flows (Authentication, Lobby access).

## Consequences

- **Positive:** Increased modularity, testability, and resilience. Frontend performance and UX improved significantly with automatic caching and retry logic. Future API iterations can safely bump to `v2` without breaking existing clients.
- **Negative:** Increased dependency surface (React Query, Playwright). Some Prisma types still require manual verification due to TS compiler limitations.
