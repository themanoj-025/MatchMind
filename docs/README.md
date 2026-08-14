# MatchMind — Documentation Index

Single home for all MatchMind documentation. MatchMind is a real-time fantasy
sports draft platform: live auction rooms over WebSockets, a strict salary-cap
draft, fantasy points ledger, Stripe billing, and AI draft insights (Claude).

**Start here:** [architecture.md](architecture.md) (system map) →
[folder_structure.md](folder_structure.md) (repo tree) →
[technical/TechSpec.md](technical/TechSpec.md) (build details).

## Structure

```
docs/
├── README.md                      ← this index
├── architecture.md                system architecture
├── folder_structure.md            repository + docs tree
├── module_dependency.md           dependency graph
├── package_overview.md            module inventory
├── startup_flow.md                boot + draft flow
├── community/
│   ├── CHANGELOG.md               changelog
│   ├── CODE_OF_CONDUCT.md         code of conduct
│   ├── CONTRIBUTING.md            contribution guide
│   ├── SECURITY.md                security policy
│   └── SUPPORT.md                 support channels
├── decisions/
│   ├── 0001-json-db-over-postgres.md     ADR: JSON DB before Postgres
│   └── 001-backend-frontend-restructure.md  ADR: backend/frontend restructure
├── design/
│   ├── AppFlow.md                 app screens / states / flows
│   └── Design.md                  design decisions
├── product/
│   └── PRD.md                     product requirements
├── project/
│   ├── analysis_report.md         repo inventory & classification
│   ├── ImplementationPlan.md      implementation plan
│   ├── RiskRegister.md            risks & mitigations
│   ├── Rules.md                   engineering rules
│   └── Tracker.md                 status tracker
├── reference/
│   ├── README.md                  reference index (incl. audit report)
│   ├── Glossary.md                terminology
│   ├── ISSUES.md                  deferred issues log
│   ├── MIGRATION_POLICY.md        DB migration policy
│   ├── migration-strategy.md      JSON↔Postgres migration strategy
│   ├── REMEDIATION_STATUS.md      10/10 remediation tracking
│   └── Volume-99-Comprehensive-Engineering-Audit.md
├── technical/
│   ├── API.md                     endpoint reference
│   ├── DEPLOYMENT_TOPOLOGY.md     deployment topology
│   ├── Deployment.md              deployment guide
│   ├── Schema.md                  data model
│   ├── schema-discovery.md        discovered schema notes
│   ├── SecurityAndCompliance.md   security baseline
│   ├── TechSpec.md                technical spec
│   └── Testing.md                 test strategy
├── migration/
│   ├── migration_summary.md       modernization record
│   ├── old_tree_to_new_tree.md    restructure before/after
│   └── file_move_ledger.md        file-move ledger
└── audit/
    ├── cleanup-audit-2026-08-13.md  previous cleanup audit
    └── cleanup-audit-2026-08-15.md  docs de-LLM-ification audit
```

## Guidance

| You want...                       | Read                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| How the platform works end-to-end | [architecture.md](architecture.md)                                                                               |
| Full engineering audit            | [reference/Volume-99-Comprehensive-Engineering-Audit.md](reference/Volume-99-Comprehensive-Engineering-Audit.md) |
| Migration strategy                | [reference/migration-strategy.md](reference/migration-strategy.md)                                               |
| Remediation status                | [reference/REMEDIATION_STATUS.md](reference/REMEDIATION_STATUS.md)                                               |
| Deployment topology               | [technical/DEPLOYMENT_TOPOLOGY.md](technical/DEPLOYMENT_TOPOLOGY.md)                                             |
| API surface                       | [technical/API.md](technical/API.md)                                                                             |
| What's shipped / next             | [project/Tracker.md](project/Tracker.md)                                                                         |
| Risks & follow-ups                | [project/RiskRegister.md](project/RiskRegister.md)                                                               |
