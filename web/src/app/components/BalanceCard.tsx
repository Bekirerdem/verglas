import type { VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { usd } from "../../lib/format";

const DAY = 86_400n;

/** The balance card: one number a business owner trusts, its ₺ mirror from
    the live rate, and a real sparkline built from the vault's own history. */
export function BalanceCard({ view, rateUsdTry }: { view: VaultView; rateUsdTry: bigint | null }) {
  const { t, lang } = useI18n();

  // Walk history backwards from the live balance to a running series.
  const delta = (kind: string, amount: bigint | null): bigint => {
    if (amount === null) return 0n;
    if (kind === "deposit") return amount;
    if (kind === "spend" || kind === "withdraw") return -amount;
    return 0n;
  };
  const oldestFirst = [...view.history].reverse();
  let running = view.balance;
  const series: { ts: bigint; bal: bigint }[] = [{ ts: BigInt(Math.floor(Date.now() / 1000)), bal: view.balance }];
  for (const item of [...view.history]) {
    running -= delta(item.kind, item.amount);
    series.unshift({ ts: item.timestamp, bal: running });
  }
  const pts = series.slice(-40);
  const max = pts.reduce((m, p) => (p.bal > m ? p.bal : m), 1n);
  const path = pts
    .map((p, i) => {
      const x = pts.length > 1 ? (i / (pts.length - 1)) * 300 : 300;
      const y = 52 - Number((p.bal * 44n) / max);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // Last-30-days money in / out.
  const cutoff = BigInt(Math.floor(Date.now() / 1000)) - 30n * DAY;
  let inSum = 0n;
  let outSum = 0n;
  for (const item of oldestFirst) {
    if (item.timestamp < cutoff || item.amount === null) continue;
    if (item.kind === "deposit") inSum += item.amount;
    if (item.kind === "spend" || item.kind === "withdraw") outSum += item.amount;
  }

  const tryValue =
    rateUsdTry !== null && rateUsdTry > 0n ? (view.balance * rateUsdTry) / 100_000_000n : null;
  const tryText =
    tryValue !== null
      ? (Number(tryValue) / 1e6).toLocaleString(lang === "tr" ? "tr-TR" : "en-US", {
          maximumFractionDigits: Number(tryValue) / 1e6 >= 100 ? 0 : 2,
        })
      : null;

  return (
    <div className="bcard brise">
      <h3>{t("b_balance")}</h3>
      <div className="bbalance num">
        {(Number(view.balance) / 1e6).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
        <small>USDC</small>
      </div>
      {tryText && rateUsdTry !== null && (
        <div className="btry num">
          ≈ <b>₺{tryText}</b> · {t("b_live_rate")} {(Number(rateUsdTry) / 1e8).toFixed(2)}
        </div>
      )}
      <svg className="bspark" height="58" viewBox="0 0 300 58" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8b0d1a" stopOpacity=".16" />
            <stop offset="1" stopColor="#8b0d1a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L300,58 L0,58 Z`} fill="url(#sparkfill)" />
        <path d={path} fill="none" stroke="#8b0d1a" strokeWidth="2" />
      </svg>
      <div className="bmonth num">
        <span className="in">↑ {usd(inSum)} {t("b_in")}</span>
        <span>↓ {usd(outSum)} {t("b_out")}</span>
        <span className="rangenote">{t("b_30d")}</span>
      </div>
    </div>
  );
}
