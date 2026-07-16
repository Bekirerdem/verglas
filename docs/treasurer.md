# Verglas Treasurer

The first resident of the vault: an autonomous corporate treasurer that pays FX-timed supplier invoices **inside the owner's rules**. Born from Hazinedar (our Stellar-side treasury pilot), reborn on Avalanche as a composition over the vault.

## The problem it solves

An importer holds TRY and owes USD-denominated supplier invoices. Banks convert on the due day at a 2–4% spread. The treasurer does two things better:

- **rail spread:** stablecoin rails cost ~0.1% instead of the bank's 2–4% — an unconditional saving;
- **FX timing:** inside the due window it converts at the best observed rate, with a hard deadline guarantee.

**Backtest on real ECB USD/TRY data** (2025-06-02 → 2026-05-29, 12 × $60K invoices, 15-day windows): **3.79% total saving ≈ 1.2M TRY/yr** — decomposed honestly into spread (always positive) + timing (can go negative when TRY strengthens). The harness lives in `agent/src/backtest/`.

## How the composition works

`VerglasTreasurer` **is** the vault's agent. `payFX(supplier, amountUsdc, priceUpdate)`:

1. only the keeper (operator) may call; treasurer must not be paused;
2. refreshes Pyth with the Hermes payload (fee paid in the same call);
3. reads `getPriceNoOlderThan(USD/TRY, 26h)` and normalizes the exponent;
4. **FX circuit breaker:** if the live rate deviates from the owner's reference rate by more than `maxSlippageBps`, revert — a human looks again;
5. **daily cap:** per-calendar-day spend accumulator (`block.timestamp / 1 days`, lazily reset) must stay under `dailyLimit`;
6. delegates to `account.spend()` — whitelist, per-tx limit, budget, and the owner's freeze still rule.

The vault's brake always wins: freezing the **account** silences the treasurer unconditionally (covered by the load-bearing composition test).

## Owner controls

`setPolicy({dailyLimit, maxSlippageBps, referenceRateUsdTry})` · `setOperator` (keeper recoverability) · `pause`/`unpause` (treasurer-local brake, layered under the vault's freeze).

## The keeper

`agent/src/tick.ts` — a one-shot tick, deliberately not a daemon: fetch the live rate from Hermes, compute the window low from the ECB daily series, run the 5-rule deterministic strategy (deadline guarantee + catch-the-dip; not an LLM), and if the decision is *convert*, execute `payFX` with the Pyth update attached.

```bash
TREASURER_ADDRESS=0x... npm run tick   # in agent/
```

> **Note:** hermes.pyth.network requires an API key starting 2026-07-31 (Pyth Core plans). Point `HERMES_URL` at an authenticated endpoint after the cutover.

## Compliance posture (TR)

The ramp is **outside** the product: the business's own licensed exchange account handles TRY↔USDC. The vault is USDC-in/USDC-out for cross-border supplier payments; FX timing acts as a signal plus a timed stablecoin payment — never custody, never brokerage.
