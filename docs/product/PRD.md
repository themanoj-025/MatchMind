# PRD — MatchMind: Real-Time Fantasy Sports Draft Platform

| Field        | Value           |
| ------------ | --------------- |
| Version      | v0.1            |
| Last Updated | 2026-08-06      |
| Owner        | Product Manager |
| Status       | In Review       |

---

## 1. Executive Summary

MatchMind is a real-time, football-first social prediction and live auction draft platform with a Bloomberg-style trading terminal aesthetic. Users watch games, bid in live player auctions over low-latency WebSockets, chat in real time, and compete on global leaderboards. Managers draft with a strict $100M salary cap into a mandatory 15-man squad (2 GK, 5 DEF, 5 MID, 3 FWD). Post-draft, real-world performances map to a fantasy points ledger. Built as a modular monolith: React 19 SPA, Node.js/Express API with Socket.IO, PostgreSQL, Redis (BullMQ + caching), Stripe billing, and AI draft insights (Claude).

## 2. Problem Statement

- **User pain:** Fantasy platforms feel disconnected from the live match experience; auction drafts are either absent or laggy; communities lack real-time interaction.
- **Evidence/context:** Built after a multi-volume engineering audit (4.8 → 6.2/10), with 194 passing tests, 45+ endpoints, Lighthouse 98/100 performance.
- **Cost of not solving it:** Boring drafts, snipe frustration, no social glue, unreliable leaderboards.

## 3. Goals & Non-Goals

| Goal                        | Metric                          | Target                  |
| --------------------------- | ------------------------------- | ----------------------- |
| Real-time auction integrity | Bid conflicts under concurrency | 0 lost bids             |
| Engagement                  | Rooms with active chats         | ≥ 60% of rooms (target) |
| Performance                 | Lighthouse                      | ≥ 90 perf / ≥ 95 a11y   |
| Test health                 | Vitest                          | 194 passing             |
| Monetization                | Stripe pro conversion           | ≥ 2% (target)           |

### Non-Goals (v1)

- Other sports beyond football.
- Season-long weekly lineup management (draft-only focus).
- Mobile native apps (responsive web).
- Multiple concurrent draft modes (auction only).

## 4. Target Users & Personas

| Persona               | Role                | Goals                  | Frustrations    | Quote                                 | Tech Comfort |
| --------------------- | ------------------- | ---------------------- | --------------- | ------------------------------------- | ------------ |
| Sam — Fantasy Veteran | Drafts with friends | Fast, fair auctions    | Sniping, lag    | "Don't let me lose to a snipe."       | High         |
| Kiara — Casual Fan    | Watches + predicts  | Fun, social experience | Complexity      | "Make it exciting, not intimidating." | Low          |
| Dev — Room Organizer  | Runs private rooms  | Budget + roster rules  | Broken auctions | "Enforce the rules automatically."    | Medium       |

## 5. User Stories

| ID     | As a... | I want...                   | So that...                  | Priority | Acceptance Criteria                     |
| ------ | ------- | --------------------------- | --------------------------- | -------- | --------------------------------------- |
| US-001 | Manager | bid in live auctions        | I build my squad            | P0       | Bid within budget, no race conflicts    |
| US-002 | Manager | anti-snipe timer            | sniping is blocked          | P0       | Final-seconds bid resets timer          |
| US-003 | Manager | dynamic bid increments      | increments scale with price | P1       | Algorithmic increment rules             |
| US-004 | Manager | $100M cap + 15-man squad    | rules enforced              | P0       | Budget lockout blocks unaffordable bids |
| US-005 | Manager | room + global standings     | I compete                   | P1       | Redis-cached leaderboards               |
| US-006 | User    | real-time chat              | social experience           | P1       | Socket.IO chat                          |
| US-007 | User    | AI draft insights           | better decisions            | P2       | Claude insights in draft UI             |
| US-008 | User    | pro subscription via Stripe | premium features            | P2       | Stripe billing flow                     |

## 6. Feature List

| ID      | Epic         | Feature                | Description                   | Priority | Status |
| ------- | ------------ | ---------------------- | ----------------------------- | -------- | ------ |
| REQ-001 | Drafts       | Auction rooms          | Real-time WebSocket auctions  | P0       | Done   |
| REQ-002 | Drafts       | Anti-snipe timer       | Reset on late bids            | P0       | Done   |
| REQ-003 | Drafts       | Dynamic increments     | Price-scaled bid steps        | P1       | Done   |
| REQ-004 | Budget       | $100M salary cap       | Budget enforcement            | P0       | Done   |
| REQ-005 | Budget       | 15-man squad (2-5-5-3) | Roster enforcement            | P0       | Done   |
| REQ-006 | Leaderboard  | Room standings         | Friends competition           | P1       | Done   |
| REQ-007 | Leaderboard  | Global standings       | World ranking                 | P1       | Done   |
| REQ-008 | Social       | Real-time chat         | Socket.IO chat                | P1       | Done   |
| REQ-009 | Points       | Fantasy points ledger  | Post-draft scoring            | P1       | Done   |
| REQ-010 | AI           | Draft insights         | Claude insights               | P2       | Done   |
| REQ-011 | Monetization | Stripe pro             | Premium billing               | P2       | Done   |
| REQ-012 | Ops          | Blind nominations      | Algorithmic player nomination | P0       | Done   |

## 7. User Journeys (high level)

```mermaid
flowchart LR
    U[User] --> REG[Register/Login]
    REG --> ROOM[Join/Create Room]
    ROOM --> DRAFT[Auction Draft]
    DRAFT --> BID[Bid (budget check)]
    DRAFT --> CHAT[Live Chat]
    DRAFT --> INSIGHT[AI Insights]
    DRAFT --> LBD[Standings]
    LBD --> SCORE[Fantasy Points]
```

## 8. Success Metrics / KPIs

| Metric                               | Target             | Measurement       |
| ------------------------------------ | ------------------ | ----------------- |
| North Star: active drafters per week | ≥ 1,000 (target)   | analytics         |
| Auction integrity                    | 0 race conflicts   | concurrency tests |
| Chat engagement                      | ≥ 60% rooms active | metrics           |
| Performance                          | Lighthouse 98/100  | audits            |
| Test health                          | 194 passing        | CI                |

## 9. Assumptions & Dependencies

- PostgreSQL + Redis available (BullMQ with sync fallback).
- Stripe account for billing.
- Claude API for AI insights.
- Single-instance WebSocket in v1 (socket.io-redis-adapter = scale roadmap).

## 10. Risks

Top 3 (full list in ../project/RiskRegister.md):

1. **WebSocket race conditions** — mitigated by Redis-backed distributed locks.
2. **WebSocket horizontal scaling** — documented roadmap (socket.io-redis-adapter).
3. **N+1 queries** — mitigated during audit remediation.

## 11. Release Criteria

- [ ] 194 Vitest tests pass.
- [ ] Auction room: bids conflict-free, anti-snipe works.
- [ ] $100M cap + 15-man roster enforced.
- [ ] Room + global standings live.
- [ ] Chat real-time.
- [ ] Stripe pro flow works.
- [ ] Lighthouse ≥ 90/95.

## 12. Open Questions

| Question                                  | Owner    | Resolve by  |
| ----------------------------------------- | -------- | ----------- |
| Add season-long league mode?              | PM       | Release 2.0 |
| Extract scoring engine to worker service? | Eng Lead | Release 1.1 |

## 13. Related Documents

| Document                                                          | Relationship        |
| ----------------------------------------------------------------- | ------------------- |
| [TechSpec.md](../technical/TechSpec.md)                           | Architecture, stack |
| [AppFlow.md](../design/AppFlow.md)                                | Screen flows        |
| [Design.md](../design/Design.md)                                  | Design system       |
| [Schema.md](../technical/Schema.md)                               | Data model          |
| [ImplementationPlan.md](../project/ImplementationPlan.md)         | Build plan          |
| [Tracker.md](../project/Tracker.md)                               | Task status         |
| [Rules.md](../project/Rules.md)                                   | Standards           |
| [API.md](../technical/API.md)                                     | Endpoints           |
| [SecurityAndCompliance.md](../technical/SecurityAndCompliance.md) | Security            |
| [Testing.md](../technical/Testing.md)                             | Tests               |
| [Deployment.md](../technical/Deployment.md)                       | Deployment          |
| [Glossary.md](../reference/Glossary.md)                           | Vocabulary          |
| [RiskRegister.md](../project/RiskRegister.md)                     | Risks               |
