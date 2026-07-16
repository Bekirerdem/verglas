/**
 * Backtest simulation (pure function). Ported logic-verbatim from Hazinedar.
 *
 * Tests the agent's FX-timing strategy against a naive baseline (converting
 * every payment on its due day through the bank spread) over a historical
 * USDTRY series.
 *
 * The saving decomposes into components that sum EXACTLY (no cross term):
 *   - spreadSavingTRY : bank spread (2-4%) replaced by the stablecoin rail
 *                       (~0.1%) -> positive under any rate path
 *   - timingGainTRY   : converting early/at the dip inside the due window
 *                       -> shield + alpha (can go negative when TRY strengthens)
 *   - totalSavingTRY  = spreadSavingTRY + timingGainTRY
 */
import { decideConversion } from "../strategy.ts";

export type Invoice = { dueIndex: number; amountUSD: number };

export type BacktestConfig = {
  windowDays: number;
  bankSpreadBps: number; // bank FX spread (e.g. 300 = 3%)
  railSpreadBps: number; // stablecoin rail spread (e.g. 10 = 0.1%)
};

export type PaymentDetail = {
  dueIndex: number;
  agentIndex: number;
  naiveRate: number;
  agentRate: number;
  amountUSD: number;
};

export type BacktestResult = {
  naiveCostTRY: number;
  agentCostTRY: number;
  spreadSavingTRY: number;
  timingGainTRY: number;
  totalSavingTRY: number;
  savingPct: number;
  payments: PaymentDetail[];
};

export function simulate(rates: number[], invoices: Invoice[], cfg: BacktestConfig): BacktestResult {
  const bankMul = 1 + cfg.bankSpreadBps / 10_000;
  const railMul = 1 + cfg.railSpreadBps / 10_000;

  let naiveCost = 0;
  let agentCost = 0;
  let spreadSaving = 0;
  let timingGain = 0;
  const payments: PaymentDetail[] = [];

  for (const inv of invoices) {
    const due = inv.dueIndex;
    const start = Math.max(0, due - cfg.windowDays);

    // Agent strategy: walk the window day by day, convert on the first "convert".
    let recentMin = Infinity;
    let agentIndex = due; // default: the deadline guarantee
    for (let day = start; day <= due; day++) {
      const rate = rates[day];
      if (rate < recentMin) recentMin = rate;
      const decision = decideConversion({
        daysToDeadline: due - day,
        windowDays: cfg.windowDays,
        currentRate: rate,
        recentMin,
        alreadyConverted: false,
      });
      if (decision.action === "convert") {
        agentIndex = day;
        break;
      }
    }

    const naiveRate = rates[due];
    const agentRate = rates[agentIndex];

    naiveCost += inv.amountUSD * naiveRate * bankMul;
    agentCost += inv.amountUSD * agentRate * railMul;
    spreadSaving += (inv.amountUSD * naiveRate * (cfg.bankSpreadBps - cfg.railSpreadBps)) / 10_000;
    timingGain += inv.amountUSD * (naiveRate - agentRate) * railMul;

    payments.push({ dueIndex: due, agentIndex, naiveRate, agentRate, amountUSD: inv.amountUSD });
  }

  const totalSaving = naiveCost - agentCost;
  return {
    naiveCostTRY: naiveCost,
    agentCostTRY: agentCost,
    spreadSavingTRY: spreadSaving,
    timingGainTRY: timingGain,
    totalSavingTRY: totalSaving,
    savingPct: naiveCost > 0 ? (totalSaving / naiveCost) * 100 : 0,
    payments,
  };
}
