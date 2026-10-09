# SecurityAndCompliance — MatchMind: Security

| Field        | Value             |
| ------------ | ----------------- |
| Version      | v0.1              |
| Last Updated | 2026-08-06        |
| Owner        | Security Engineer |
| Status       | In Review         |

---

## 1. Threat Model (STRIDE)

| Threat          | Surface      | Impact           | Mitigation                                 |
| --------------- | ------------ | ---------------- | ------------------------------------------ |
| Spoofing        | JWT forgery  | Account takeover | RS256 + refresh rotation + revocation      |
| Tampering       | Bid payloads | Auction fraud    | Zod validation + budget checks server-side |
| Repudiation     | Bids         | Disputes         | Bid history + timestamps                   |
| Info disclosure | PII          | Leak             | Masked logs, RBAC                          |
| DoS             | Socket flood | Outage           | Rate limits + connection limits            |
| Elevation       | Pro features | Revenue loss     | Stripe webhook verification + RBAC         |

## 2. Auth / Authorization

- JWT access + refresh (separated secrets), refresh rotation, revocation on logout/password change.
- Google OAuth.
- CSRF tokens on state-changing requests.
- Rate limiting (Helmet/CORS/CSRF/limits).

## 3. Data Classification

| Data          | Class      | Handling          |
| ------------- | ---------- | ----------------- |
| email         | PII        | masked logs       |
| password_hash | credential | bcrypt            |
| stripe_id     | financial  | access-controlled |
| bids/rooms    | internal   | RBAC room-scoped  |

## 4. Encryption

- In transit: TLS.
- At rest: bcrypt passwords; DB encryption via hosting.

## 5. Compliance Checklist

- [ ] CSRF + rate limits
- [ ] Token revocation tests
- [ ] Separated JWT secrets
- [ ] Gitleaks in CI
- [ ] Dependency scans
- [ ] Stripe webhook signature verification

## 6. Incident Response Plan (outline)

1. Detect: alerts/metrics.
2. Triage.
3. Contain: revoke tokens, disable room.
4. Remediate + regression tests.
5. Recover.
6. Postmortem (blameless).

## 7. Related Documents

| Document                                                  | Relationship      |
| --------------------------------------------------------- | ----------------- |
| [Rules.md](../project/Rules.md)                           | Security baseline |
| [API.md](API.md)                                          | Auth              |
| [Schema.md](Schema.md)                                    | Sensitive map     |
| [TechSpec.md](TechSpec.md)                                | NFRs              |
| [PRD.md](../product/PRD.md)                               | Goals             |
| [AppFlow.md](../design/AppFlow.md)                        | Flows             |
| [Design.md](../design/Design.md)                          | Design            |
| [ImplementationPlan.md](../project/ImplementationPlan.md) | Tasks             |
| [Tracker.md](../project/Tracker.md)                       | Status            |
| [Testing.md](Testing.md)                                  | Security tests    |
| [Deployment.md](Deployment.md)                            | Secrets           |
| [Glossary.md](../reference/Glossary.md)                   | Vocabulary        |
| [RiskRegister.md](../project/RiskRegister.md)             | Risks             |
