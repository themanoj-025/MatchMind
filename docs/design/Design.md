# Design — MatchMind: Design System & UX Principles

| Field        | Value       |
| ------------ | ----------- |
| Version      | v0.1        |
| Last Updated | 2026-08-06  |
| Owner        | Design Lead |
| Status       | In Review   |

---

## 1. Design Principles

1. **Terminal aesthetic** — Bloomberg-style density for live data.
2. **Speed is the brand** — real-time updates, no jank.
3. **Clarity in chaos** — bid state always obvious.
4. **Social glue** — chat and standings first-class.
5. **Accessible dark** — WCAG AA in dark mode.

## 2. Brand & Visual Identity

- Voice: energetic, competitive, terminal-cool.
- Imagery: player cards, match feeds, scoreboards.

## 3. Color System

| Token        | Hex       | Usage        | Contrast (AA) |
| ------------ | --------- | ------------ | ------------- |
| bg-dark      | `#0A0E17` | terminal bg  | —             |
| surface      | `#111827` | panels       | —             |
| text         | `#F9FAFB` | primary      | 16:1          |
| accent-green | `#10B981` | bids, money  | 5.6:1         |
| accent-blue  | `#3B82F6` | actions      | 5.8:1         |
| danger       | `#EF4444` | blocked bids | 5.5:1         |
| warning      | `#F59E0B` | snipe timer  | 4.8:1         |

## 4. Typography Scale

| Token     | Font | Size | Weight | Line-height | Usage           |
| --------- | ---- | ---- | ------ | ----------- | --------------- |
| display   | mono | 34px | 700    | 1.1         | live prices     |
| heading   | sans | 20px | 600    | 1.3         | page titles     |
| body      | sans | 14px | 400    | 1.5         | content         |
| mono-data | mono | 13px | 400    | 1.4         | tables, tickers |
| label     | sans | 12px | 600    | 1.4         | labels          |

## 5. Spacing & Grid

- Base 4px; dense 8-column ticker grids.
- Breakpoints: 640/768/1024/1280.

## 6. Component Library

**Bid ticket:**

```
┌─────────────────────────┐
│ Kane (FWD)   $18.5M     │
│ [▲ +$1.5M]  Timer 8.2s │ ← anti-snipe
│ [BID] [Pass]            │
└─────────────────────────┘
states: idle, bidding, outbid, sold, blocked (budget)
```

**Ticker bar:** scrolling player prices (mono, green up/red down).

Other: auction room layout (3-pane: pool | stage | chat), standings table, squad card (2-5-5-3), toast, modal, command palette.

## 7. Iconography

Inline SVG set; sports + terminal glyphs.

## 8. Accessibility

- WCAG 2.1 AA (Lighthouse 100).
- Timer not color-only (numeric + bar).
- Keyboard bid shortcuts.

## 9. Responsive

| Breakpoint | Rule                            |
| ---------- | ------------------------------- |
| < 640      | Single column, chat collapsible |
| ≥ 1024     | 3-pane auction room             |

## 10. Motion

- 150ms hover, 200ms modal, ticker scroll (CSS), timer pulse; reduced-motion honored.

## 11. Dark Mode

Dark-first terminal theme; light theme optional.

## 12. Related Documents

| Document                                                          | Relationship |
| ----------------------------------------------------------------- | ------------ |
| [AppFlow.md](AppFlow.md)                                          | Screens      |
| [PRD.md](../product/PRD.md)                                       | UX goals     |
| [TechSpec.md](../technical/TechSpec.md)                           | Stack        |
| [Schema.md](../technical/Schema.md)                               | Display data |
| [ImplementationPlan.md](../project/ImplementationPlan.md)         | Tasks        |
| [Tracker.md](../project/Tracker.md)                               | Status       |
| [Rules.md](../project/Rules.md)                                   | Standards    |
| [API.md](../technical/API.md)                                     | Contracts    |
| [SecurityAndCompliance.md](../technical/SecurityAndCompliance.md) | Security     |
| [Testing.md](../technical/Testing.md)                             | UI tests     |
| [Deployment.md](../technical/Deployment.md)                       | Deploy       |
| [Glossary.md](../reference/Glossary.md)                           | Vocabulary   |
| [RiskRegister.md](../project/RiskRegister.md)                     | Risks        |
