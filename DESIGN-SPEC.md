# DESIGN-SPEC — Verglas Owner Console (`/app`)

> Process: spec-first UI (theme → wireframe approval → implement → mirror gate).
> Approved 2026-07-18. Landing spec history lives in the vault
> (`team1-grant/design/landing-iterasyon-gunlugu`); this file covers the app.

## Theme (Layer 0)

**"Command desk on the ice."** The console IS the verglas sheet: the owner's
money sits **under** the ice, the rules are etched **into** the glass, receipts
are stamped **onto** it, and one physical brake lever sits within reach.

- Language: slab / stamp / brake / border (mirrors the landing vocabulary).
- Visual motif: frosted-glass hero slab over the night-ice ground; amber
  reserved for stamp artifacts only.
- Interaction signature: **FREEZE = instant-freeze** — pulling the brake
  glazes the whole scene in one sweep (the brand gesture, now in the product).

## Scene plan (Layer 1)

- **User:** the vault owner — a business owner (or Bekir as customer zero) who
  delegated money to an agent and wants control in hand.
- **First 5 seconds must say:** "My money is safe under the ice, the rules are
  enforcing *right now*, and the brake is under my hand."
- **The single aha:** the FREEZE lever — pull it and everything on the scene
  freezes instantly; release and it thaws.
- **Narrative order:** status (slab) → control (rail) → evidence (receipts) →
  reach (passport).

## Wireframe (approved)

```
NAV (sticky 56px): VG mark · vault picker (#220 Treasurer ▾) · Fuji ● · TR/EN · theme
S1 · VAULT SLAB — hero, 65% viewport, 8/4 asymmetry
     left  (glass slab): balance XL · budget ice-bar · daily epoch · FX gauge
     right (control rail): FREEZE lever (aha) · policy card · operator · pause · withdraw
S2 · RECEIPT SHELF — full-bleed amber band, 20%
     spend/FX stream flows in from the left → weekly ZK stamps pressed onto the rail
S3 · PASSPORT BAND — 15%, 7/5 asymmetry
     C-Chain ──ICM──▶ Dispatch · CLEARED chip · remaining-validity bar that melts
```

**Layout constitution check:** hero ≥60% ✓ · full-bleed moment (S2) ✓ ·
asymmetry 8/4 + 7/5 ✓ · type contrast ≥5× (balance display vs body) ✓ ·
weights 65/20/15 (no equal-weight run) ✓ · 3 depth layers (ground / glass /
interaction) ✓ · load choreography: nav → slab frosts in → numbers count up →
receipts stagger onto the shelf.

**Motion budget:** FX gauge breathes (heats toward accent as deviation nears
the breaker) · stamp press on new receipt (single hit) · validity bar melts
slowly · FREEZE glaze sweep. `prefers-reduced-motion`: states switch instantly.

## Decisions

- **Route:** `/app/` — second Vite entry (`web/app/index.html`); landing and
  `build-site.mjs` untouched.
- **Read-only without a wallet** (projector-safe); MetaMask connect unlocks
  owner writes.
- **Round-1 writes:** freeze / unfreeze, pause / unpause, setPolicy.
  **Round-2:** withdraw, setOperator (visible in the rail, wired later).
- **PWA:** installable app shell (vite-plugin-pwa), `start_url /app/`,
  existing 192/512 icons.
- Data comes from the existing `web/src/lib/data.ts` layer + a generic
  per-vault view; default vault is the Treasurer (#220), picker offers the
  demo agent (#219).

## Mirror gate (before any screenshot reaches Bekir)

1. Does the eye land first on the hero of the aha (slab + lever)?
2. Would this stand out among 100 AI dashboards (is the theme singular)?
3. Are there 3+ consecutive equal-weight sections? (FAIL if yes)
