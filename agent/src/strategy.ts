/**
 * Autonomous FX-timing decision engine (pure function, side-effect free,
 * testable). Ported logic-verbatim from Hazinedar's strategy.ts — the proof
 * asset behind the 3.79% backtest figure.
 *
 * Importer scenario: the business holds TRY and must convert to USDC for a
 * USD supplier payment coming due. Rate = USDTRY (how many TRY per 1 USD).
 *
 * Strategy (defensible + simple, deliberately deterministic — not an LLM):
 *  1. If the due window has not opened yet, wait.
 *  2. If this payment was already converted, wait.
 *  3. On the due day, ALWAYS convert (deadline guarantee — caps devaluation risk).
 *  4. If the current rate has touched the best level seen in the window
 *     (lowest USDTRY = strongest TRY), convert (catch the dip = timing alpha).
 *  5. Otherwise keep waiting for a better rate.
 */

export type ConversionInput = {
  /** Days until the payment is due (0 = due today). */
  daysToDeadline: number;
  /** Width of the observation window the agent watches before the deadline (days). */
  windowDays: number;
  /** Current USDTRY rate (1 USD = X TRY). */
  currentRate: number;
  /** Lowest USDTRY observed within the window so far (TRY at its strongest). */
  recentMin: number;
  /** Whether this payment has already been converted. */
  alreadyConverted: boolean;
};

export type ConversionDecision = {
  action: "convert" | "hold";
  reason: string;
};

export function decideConversion(i: ConversionInput): ConversionDecision {
  if (i.alreadyConverted) {
    return { action: "hold", reason: "already converted" };
  }
  if (i.daysToDeadline > i.windowDays) {
    return { action: "hold", reason: "due window not open yet" };
  }
  if (i.daysToDeadline <= 0) {
    return { action: "convert", reason: "due day - deadline guarantee" };
  }
  if (i.currentRate <= i.recentMin) {
    return { action: "convert", reason: "window low caught - low USDTRY" };
  }
  return { action: "hold", reason: "waiting for a better rate" };
}
