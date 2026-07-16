/**
 * Runs the backtest on real USD/TRY data and writes the report.
 * Run: `npm run backtest` (inside agent/) or `node src/backtest/run.ts`.
 *
 * Scenario: a Bursa textile importer paying a supplier $60,000 every
 * ~21 business days. The committed agent/backtest-report.json was produced
 * by Hazinedar's original run over 2025-06-02..2026-05-29 (3.7858%) and is
 * the citable proof asset — re-running refreshes the window and overwrites it.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchUsdTry, ratesOf } from "./fetchRates.ts";
import { simulate, type Invoice } from "./simulate.ts";

const START = "2025-06-02";
const END = "2026-05-29";
const PAYMENT_EVERY_DAYS = 21; // ~monthly (business days)
const AMOUNT_USD = 60_000;
const CFG = { windowDays: 15, bankSpreadBps: 300, railSpreadBps: 10 };

const points = await fetchUsdTry(START, END);
const rates = ratesOf(points);

const invoices: Invoice[] = [];
for (let i = PAYMENT_EVERY_DAYS; i < rates.length; i += PAYMENT_EVERY_DAYS) {
  invoices.push({ dueIndex: i, amountUSD: AMOUNT_USD });
}

const result = simulate(rates, invoices, CFG);

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
console.log("=== VERGLAS TREASURER BACKTEST (real USD/TRY data) ===");
console.log(`Period: ${points[0].date} -> ${points.at(-1)!.date} (${rates.length} days)`);
console.log(`Payments: ${invoices.length} x ${fmt(AMOUNT_USD)} USD`);
console.log(`Bank spread: ${CFG.bankSpreadBps / 100}% | Rail spread: ${CFG.railSpreadBps / 100}%`);
console.log("-----------------------------------------------");
console.log(`Naive cost   : ${fmt(result.naiveCostTRY)} TRY`);
console.log(`Agent cost   : ${fmt(result.agentCostTRY)} TRY`);
console.log(`Spread saving: ${fmt(result.spreadSavingTRY)} TRY`);
console.log(`Timing gain  : ${fmt(result.timingGainTRY)} TRY`);
console.log(`TOTAL SAVING : ${fmt(result.totalSavingTRY)} TRY (${result.savingPct.toFixed(2)}%)`);

const outPath = join(import.meta.dirname, "..", "..", "backtest-report.json");
writeFileSync(
  outPath,
  JSON.stringify(
    {
      period: { start: points[0].date, end: points.at(-1)!.date, days: rates.length },
      config: CFG,
      paymentCount: invoices.length,
      amountUSDPerPayment: AMOUNT_USD,
      ...result,
    },
    null,
    2,
  ),
);
console.log(`\nReport written: ${outPath}`);
