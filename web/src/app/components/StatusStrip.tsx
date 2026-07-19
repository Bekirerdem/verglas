import type { TreasurerData, VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { short, usd } from "../../lib/format";

const rate4 = (v: bigint) => (Number(v) / 1e8).toFixed(4);

/** The hero of the working console: one dense KPI strip. Every cell is a
    number the owner actually checks — no cell is allowed to become a stage. */
export function StatusStrip({ view, treasurer }: { view: VaultView; treasurer: TreasurerData | null }) {
  const { t } = useI18n();
  const s = view.state;

  const budgetLeft = s.totalBudget - s.totalSpent;
  const budgetPct = s.totalBudget > 0n ? Number((s.totalSpent * 1000n) / s.totalBudget) / 10 : 0;

  let fx: null | { live: string; liveIsFresh: boolean; devBps: number; maxBps: number; tripped: boolean } = null;
  let epochPct = 0;
  if (treasurer) {
    const ref = treasurer.referenceRateUsdTry;
    const live = treasurer.hermesRateUsdTry ?? treasurer.pythRateUsdTry;
    const diff = live > ref ? live - ref : ref - live;
    const devBps = ref > 0n ? Number((diff * 1_000_000n) / ref) / 100 : 0;
    fx = {
      live: rate4(live),
      liveIsFresh: treasurer.hermesRateUsdTry !== null,
      devBps,
      maxBps: treasurer.maxSlippageBps,
      tripped: devBps > treasurer.maxSlippageBps,
    };
    epochPct =
      treasurer.dailyLimit > 0n ? Number((treasurer.spentToday * 1000n) / treasurer.dailyLimit) / 10 : 0;
  }
  const heat = fx ? (fx.tripped ? "tripped" : fx.devBps / fx.maxBps > 0.8 ? "hot" : "ok") : "ok";

  return (
    <div className="strip glass">
      <div className="strip-cell strip-id">
        <span className="mono strip-label">
          {t("vault_label")} {view.agentId !== null ? `#${view.agentId.toString()}` : short(view.account, 6, 4)}
        </span>
        <span className={`chip ${s.frozen ? "chip-frozen" : "chip-ok"}`}>
          {t(s.frozen ? "app_status_frozen" : "app_status_active")}
        </span>
      </div>

      <div className="strip-cell">
        <span className="mono strip-label">{t("app_balance")}</span>
        <span className="mono strip-num">
          {(Number(view.balance) / 1e6).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          <em>USDC</em>
        </span>
      </div>

      <div className="strip-cell">
        <span className="mono strip-label">{t("app_budget_left")}</span>
        <span className="mono strip-num">
          {usd(budgetLeft)}
          <em>/ {usd(s.totalBudget)}</em>
        </span>
        <span className="strip-bar">
          <i style={{ width: `${budgetPct}%` }} />
        </span>
      </div>

      {treasurer && (
        <div className="strip-cell">
          <span className="mono strip-label">{t("app_epoch")}</span>
          <span className="mono strip-num">
            {usd(treasurer.spentToday)}
            <em>/ {usd(treasurer.dailyLimit)}</em>
          </span>
          <span className="strip-bar epoch">
            <i style={{ width: `${epochPct}%` }} />
          </span>
        </div>
      )}

      {fx && (
        <div className={`strip-cell strip-fx heat-${heat}`}>
          <span className="mono strip-label">
            {t(fx.liveIsFresh ? "app_fx_live" : "app_fx_last")}
          </span>
          <span className="mono strip-num">{fx.live}</span>
          <span className="mono strip-sub fx-verdict">
            {fx.devBps.toFixed(1)}/{fx.maxBps} bps · {t(fx.tripped ? "app_fx_tripped" : "app_fx_ok")}
          </span>
        </div>
      )}

      <div className="strip-cell strip-meta">
        <span className="mono strip-sub">
          {t("app_pertx")} {usd(s.perTxLimit)}
        </span>
        <span className="mono strip-sub">
          {t("app_txs")} {s.txCount.toString()}
        </span>
        <span className="mono strip-sub">
          {t("app_whitelist")} {s.whitelist.length}
        </span>
      </div>
    </div>
  );
}
