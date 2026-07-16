import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate } from "./simulate.ts";

test("spread saving is positive even at a flat rate", () => {
  const rates = new Array(30).fill(33); // flat USDTRY
  const r = simulate(rates, [{ dueIndex: 20, amountUSD: 100_000 }], {
    windowDays: 15,
    bankSpreadBps: 300,
    railSpreadBps: 10,
  });
  assert.ok(r.spreadSavingTRY > 0, "spread saving must be positive");
});

test("total saving = spread + timing (exact decomposition)", () => {
  const rates = Array.from({ length: 30 }, (_, i) => 33 + Math.sin(i) * 0.5);
  const r = simulate(
    rates,
    [
      { dueIndex: 25, amountUSD: 50_000 },
      { dueIndex: 18, amountUSD: 30_000 },
    ],
    { windowDays: 15, bankSpreadBps: 250, railSpreadBps: 10 },
  );
  assert.ok(Math.abs(r.spreadSavingTRY + r.timingGainTRY - r.totalSavingTRY) < 1e-3);
});

test("with TRY falling (USDTRY rising) the agent gains by converting early", () => {
  // USDTRY 30 -> 44.5 (TRY losing value)
  const rates = Array.from({ length: 30 }, (_, i) => 30 + i * 0.5);
  const r = simulate(rates, [{ dueIndex: 20, amountUSD: 100_000 }], {
    windowDays: 15,
    bankSpreadBps: 300,
    railSpreadBps: 10,
  });
  assert.ok(r.timingGainTRY > 0, "early conversion must act as a shield");
});

test("with TRY strengthening timing can lose BUT spread saving stays positive (honest boundary)", () => {
  // USDTRY 40 -> 25.5: TRY strengthens; converting early makes timing NEGATIVE.
  // The strategy's honest boundary: one-way TRY strength costs timing.
  const rates = Array.from({ length: 30 }, (_, i) => 40 - i * 0.5);
  const r = simulate(rates, [{ dueIndex: 20, amountUSD: 100_000 }], {
    windowDays: 15,
    bankSpreadBps: 300,
    railSpreadBps: 10,
  });
  assert.ok(r.timingGainTRY < 0, "early conversion loses timing when TRY strengthens (expected boundary)");
  // Replacing the bank spread with the stablecoin rail ALWAYS pays.
  assert.ok(r.spreadSavingTRY > 0, "spread saving is unconditionally positive");
});
