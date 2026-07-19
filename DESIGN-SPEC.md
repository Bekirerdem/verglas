# DESIGN-SPEC — Verglas Owner Console (`/app`)

> Process: spec-first UI (theme → wireframe approval → implement → mirror gate).
> v2 approved 2026-07-19 after the "showcase ratio" rejection: the giant
> balance slab read absurd with testnet money and the console felt like a
> display, not a tool. Reference study: AUREX (Plainthing), ZYRA (Atmix),
> Behance real-time market dashboard — all three converge on the same
> anatomy: compact KPI strip as hero, dense rows as body, audit rail on the
> right. Landing spec history lives in the vault
> (`team1-grant/design/landing-iterasyon-gunlugu`); this file covers the app.

## Theme (Layer 0)

**"Command terminal on the ice."** Mainnet-grade working tool: information
density of a trading terminal, wearing the Verglas identity. The money sits
under the ice, the rules are etched into the glass — but the console is a
desk you *work* at, not a stage you look at.

- Language: strip / desk / feed / rail (working-tool vocabulary).
- Visual motif: panel anatomy separated by hairline edges over the night-ice
  ground; amber reserved for stamp artifacts only; green/red only for
  semantic deltas.
- Interaction signature: **FREEZE = instant-freeze** — pulling the brake
  glazes the whole scene in one sweep (the brand gesture, kept from v1).

## Scene plan (Layer 1)

- **User:** the vault owner-operator — checks "is everything inside the
  rules?" several times a day. Secondary: a workshop attendee creating
  their first vault.
- **First 5 seconds must say:** "Control is in my hand — I can see exactly
  where I stand against the rules, at a glance."
- **The single hero (working-tool reading):** the STATUS STRIP — one dense
  sticky row: balance, budget left, epoch, FX breaker, frozen state. The
  giant balance number is retired; balance is a cell, not a stage.
- **Narrative order:** status (strip) → act (desk) → evidence (feed) →
  trust (audit rail).

## Wireframe (approved 2026-07-19 — "senin incelemelerine göre devam et")

```
NAV (sticky 55px): VG mark · Fuji ● · docs/site · TR/EN · theme · install
┌─SIDE 224px────┬──────── WORK (flex) ─────────────┬─AUDIT 304px──────────┐
│ VAULTS        │ STATUS STRIP (sticky, hero)      │ PASSPORT card        │
│ my vaults…    │ [id·state][balance][budget▓]     │ hub──▶gate · chip    │
│ #220 SHOWCASE │ [epoch▓][fx][pertx·txs·wl]       │ melt bar · RENEW     │
│ #219 SHOWCASE │──────────────────────────────────│──────────────────────│
│ + CREATE      │ DESK: PAY · DEPOSIT · WITHDRAW · │ ZK SEALS (amber rows)│
│───────────────│ POLICY  → inline panel, no modal │ + compact receipts   │
│ wallet card   │──────────────────────────────────│                      │
│ BRAKE lever   │ HISTORY feed — chip filters,     │                      │
│ (bottom,      │ dense rows: when·kind·who·amt·tx │                      │
│  in reach)    │                                  │                      │
└───────────────┴──────────────────────────────────┴──────────────────────┘
Mobile (iPhone 13): side collapses to a horizontal vault-chip row + compact
wallet + brake; strip wraps to 2 rows (static); feed is the body; audit
stacks last. PAY stays one tap away in the desk tabs.
```

**Layout constitution check (working-tool interpretation):** hero = the
strip + live feed working column (the eye lands on the strip first) ✓ ·
asymmetry 224/flex/304 ✓ · density: 44-48px rows, 4-8-12 padding ✓ ·
mono `tabular-nums` for every number, right-aligned amounts ✓ · no giant
single card, no equal-weight section run ✓ · 3 depth layers (ground /
panels / interaction) ✓ · load choreography: strip → desk → feed stagger.

**Motion budget:** data updates 150ms subtle · FREEZE glaze sweep · crossing
dot on the passport track · validity bar melts. No decorative animation.
`prefers-reduced-motion`: states switch instantly.

## Decisions

- **Route:** `/app/` — second Vite entry (`web/app/index.html`); landing and
  `build-site.mjs` untouched.
- **Read-only without a wallet** (projector-safe); MetaMask connect unlocks
  owner writes.
- **Writes:** freeze/unfreeze · pause/unpause · setPolicy · withdraw ·
  setOperator · spend (agent) · deposit · stamp-line activation ·
  **window renewal (one-signature validationRequest, new in v2)**.
- **PWA:** installable app shell (vite-plugin-pwa), `start_url /app/`,
  existing 192/512 icons; SW registered from every entry.
- Data comes from `web/src/lib/data.ts` + the generic per-vault view;
  a connected user lands on their own vault, #220/#219 carry SHOWCASE chips.
- **Testnet honesty:** FUJI is a small chip in the nav, never a stage; the
  layout is sized for mainnet numbers.

## Mirror gate (before any screenshot reaches Bekir)

1. Does the eye land first on the status strip (the hero of the tool)?
2. Would this stand out among 100 AI dashboards (is the theme singular)?
3. Are there 3+ consecutive equal-weight sections? (FAIL if yes)
4. Does any single card exceed ~20% of the viewport? (FAIL if yes)
