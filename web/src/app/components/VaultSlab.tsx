import { useEffect, useRef, useState } from "react";
import type { TreasurerData, VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { short, usd } from "../../lib/format";

/** Count-up for the hero number; snaps instantly under reduced motion. */
function useCountUp(target: number): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const base = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / 800, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(base + (target - base) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

const rate4 = (v: bigint) => (Number(v) / 1e8).toFixed(4);

export function VaultSlab({ view, treasurer }: { view: VaultView; treasurer: TreasurerData | null }) {
  const { t } = useI18n();
  const s = view.state;

  const balance = useCountUp(Number(view.balance) / 1e6);
  const budgetPct = s.totalBudget > 0n ? Number((s.totalSpent * 1000n) / s.totalBudget) / 10 : 0;

  let fx: null | {
    live: string;
    ref: string;
    devBps: number;
    maxBps: number;
    pct: number;
    tripped: boolean;
  } = null;
  let epochPct = 0;
  if (treasurer) {
    const ref = treasurer.referenceRateUsdTry;
    const live = treasurer.pythRateUsdTry;
    const diff = live > ref ? live - ref : ref - live;
    const devBps = ref > 0n ? Number((diff * 1_000_000n) / ref) / 100 : 0;
    const maxBps = treasurer.maxSlippageBps;
    fx = {
      live: rate4(live),
      ref: rate4(ref),
      devBps,
      maxBps,
      pct: maxBps > 0 ? Math.min(devBps / maxBps, 1) : 0,
      tripped: devBps > maxBps,
    };
    epochPct =
      treasurer.dailyLimit > 0n ? Number((treasurer.spentToday * 1000n) / treasurer.dailyLimit) / 10 : 0;
  }

  const heat = fx ? (fx.tripped ? "tripped" : fx.pct > 0.8 ? "hot" : fx.pct > 0.5 ? "warm" : "ok") : "ok";

  return (
    <div className="slab glass rise" style={{ animationDelay: "0.05s" }}>
      <div className="slab-head">
        <span className="mono slab-tag">
          {t("vault_label")} #{view.agentId.toString()}
        </span>
        <span className={`chip ${s.frozen ? "chip-frozen" : "chip-ok"}`}>
          {t(s.frozen ? "app_status_frozen" : "app_status_active")}
        </span>
        <span className="mono slab-agent">
          {t("app_agent")} {short(s.agent)}
        </span>
      </div>

      <div className="balance-row">
        <span className="mono balance-label">{t("app_balance")}</span>
        <div className="balance-xl">
          {balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className="balance-unit">USDC</span>
        </div>
      </div>

      <div className="bar-block">
        <div className="bar-line mono">
          <span>{t("app_budget")}</span>
          <span>
            {usd(s.totalSpent)} / {usd(s.totalBudget)}
          </span>
        </div>
        <div className="ice-bar">
          <i style={{ width: `${budgetPct}%` }} />
        </div>
      </div>

      {treasurer && (
        <div className="bar-block">
          <div className="bar-line mono">
            <span>{t("app_epoch")}</span>
            <span>
              {usd(treasurer.spentToday)} / {usd(treasurer.dailyLimit)}
            </span>
          </div>
          <div className="ice-bar epoch">
            <i style={{ width: `${epochPct}%` }} />
          </div>
        </div>
      )}

      {fx && (
        <div className={`fx-panel heat-${heat}`}>
          <div className="fx-head mono">{t("app_fx")}</div>
          <div className="fx-grid">
            <div>
              <span className="mono fx-label">{t("app_fx_live")}</span>
              <span className="fx-rate mono">{fx.live}</span>
            </div>
            <div>
              <span className="mono fx-label">{t("app_fx_ref")}</span>
              <span className="fx-rate mono dim">{fx.ref}</span>
            </div>
            <div>
              <span className="mono fx-label">{t("app_fx_dev")}</span>
              <span className="fx-rate mono">{fx.devBps.toFixed(1)} bps</span>
            </div>
          </div>
          <div className="fx-needle">
            <i style={{ width: `${Math.min(fx.pct, 1) * 100}%` }} />
          </div>
          <div className="fx-foot mono">
            <span>
              {t("app_fx_max")} {fx.maxBps} bps
            </span>
            <span className="fx-verdict">{t(fx.tripped ? "app_fx_tripped" : "app_fx_ok")}</span>
          </div>
        </div>
      )}

      <div className="slab-meta mono">
        <span>
          {t("app_pertx")} {usd(s.perTxLimit)}
        </span>
        <span>
          {t("app_txs")} {s.txCount.toString()}
        </span>
        <span className="wl">
          {t("app_whitelist")}{" "}
          {s.whitelist.map((w) => (
            <em key={w}>{short(w, 4, 3)}</em>
          ))}
        </span>
      </div>
    </div>
  );
}
