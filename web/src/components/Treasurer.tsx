import { TREASURER_DEPLOYMENT } from "@verglas/sdk";
import type { TreasurerData } from "../lib/data";
import { short, usd, utcDate } from "../lib/format";
import { useI18n } from "../lib/i18n";
import backtest from "../lib/backtest-report.json";

/** Formats a 1e8 fixed-point USD/TRY rate for display. */
function rate8(v: bigint): string {
  return (Number(v) / 1e8).toFixed(4);
}

/** S6 — THE TREASURER: the V2 vertical, live. Functional skeleton — the
    scene treatment lands with the scrollytelling pass. Six panels following
    the Hazinedar demo's information architecture, honesty labels included. */
export function Treasurer({ data }: { data: TreasurerData | null }) {
  const { t } = useI18n();

  if (!data) {
    return (
      <section className="treasurer" id="treasurer">
        <p className="lhead">{t("t_tag")}</p>
        <p className="empty-note">{t("t_loading")}</p>
      </section>
    );
  }

  const deviationBps =
    data.referenceRateUsdTry > 0n
      ? Number(
          ((data.pythRateUsdTry > data.referenceRateUsdTry
            ? data.pythRateUsdTry - data.referenceRateUsdTry
            : data.referenceRateUsdTry - data.pythRateUsdTry) *
            10_000n) /
            data.referenceRateUsdTry,
        )
      : 0;
  const withinBreaker = deviationBps <= data.maxSlippageBps;
  const spentPct = data.dailyLimit > 0n ? Number((data.spentToday * 100n) / data.dailyLimit) : 0;

  return (
    <section className="treasurer" id="treasurer">
      <p className="lhead">
        {t("t_tag")} <i>{t("t_tag_sub")}</i>
      </p>
      <h3 className="will-reveal">
        {t("t_h_1")}
        <em>{t("t_h_b")}</em>
        {t("t_h_2")}
      </h3>

      <div className="tgrid">
        {/* (a) Treasury status */}
        <div className="tpanel will-reveal">
          <div className="ptag">
            {t("t_status")} <span className="plabel real">{t("t_real")}</span>
          </div>
          <div className="tbig">
            {usd(data.vaultBalance)} USDC
            <span className="tsub">{t("t_balance")}</span>
          </div>
          <div className="tbar" role="img" aria-label={`${spentPct}%`}>
            <div className="tfill" style={{ width: `${Math.min(spentPct, 100)}%` }} />
          </div>
          <div className="trow">
            <span>
              {t("t_spent")}: <b>{usd(data.spentToday)}</b> / {usd(data.dailyLimit)} USDC
            </span>
            <span className={data.vaultFrozen || data.paused ? "warn" : "ok"}>
              {data.vaultFrozen ? t("t_frozen") : data.paused ? t("t_paused") : t("t_active")}
            </span>
          </div>
        </div>

        {/* (b) FX signal */}
        <div className="tpanel will-reveal">
          <div className="ptag">
            {t("t_fx")} <span className="plabel real">{t("t_real")}</span>
          </div>
          <div className="tbig">
            {rate8(data.pythRateUsdTry)}
            <span className="tsub">
              {t("t_rate")} · {utcDate(data.pythPublishTime)}
            </span>
          </div>
          <div className="trow">
            <span>
              {t("t_ref")}: <b>{rate8(data.referenceRateUsdTry)}</b>
            </span>
            <span>
              {t("t_dev")}: <b>{deviationBps}</b>/{data.maxSlippageBps} bps
            </span>
            <span className={withinBreaker ? "ok" : "warn"}>{withinBreaker ? t("t_within") : t("t_tripped")}</span>
          </div>
        </div>

        {/* (f) Identity badge */}
        <div className="tpanel will-reveal">
          <div className="ptag">
            {t("t_id")} <span className="plabel real">{t("t_real")}</span>
          </div>
          <div className="tbig">
            {t("t_agent")} #{data.agentId.toString()}
            <span className="tsub">{t("t_id_reg")}</span>
          </div>
          <div className="trow">
            <span>
              {t("t_operator")}: <b>{short(data.operator, 6, 4)}</b>
            </span>
            <span className="hash">{short(TREASURER_DEPLOYMENT.treasurer, 8, 4)}</span>
          </div>
        </div>

        {/* (e) Backtest proof */}
        <div className="tpanel will-reveal">
          <div className="ptag">
            {t("t_bt")} <span className="plabel hist">{t("t_hist")}</span>
          </div>
          <div className="tbig">
            {backtest.savingPct.toFixed(2)}%
            <span className="tsub">
              {backtest.paymentCount} × ${backtest.amountUSDPerPayment.toLocaleString("en-US")} ·{" "}
              {backtest.period.days} {t("t_bt_days")}
            </span>
          </div>
          <div className="trow">
            <span>
              {t("t_bt_spread")}: <b>{Math.round(backtest.spreadSavingTRY).toLocaleString("en-US")} TRY</b>
            </span>
            <span>
              {t("t_bt_timing")}: <b>{Math.round(backtest.timingGainTRY).toLocaleString("en-US")} TRY</b>
            </span>
          </div>
        </div>
      </div>

      {/* (c) FX payment log */}
      {data.payments.length === 0 ? (
        <p className="empty-note">{t("t_none")}</p>
      ) : (
        <div className="table-scroll">
          <table className="spends">
            <thead>
              <tr>
                <th>{t("t_supplier")}</th>
                <th>{t("th_amount")}</th>
                <th>{t("t_rate_at")}</th>
                <th>{t("th_when")}</th>
                <th>{t("th_tx")}</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.txHash}>
                  <td>{short(p.supplier, 6, 3)}</td>
                  <td className="amt">{usd(p.amount)} USDC</td>
                  <td>{rate8(p.rateUsdTry)}</td>
                  <td>{utcDate(p.timestamp)}</td>
                  <td>
                    <a href={`https://testnet.snowtrace.io/tx/${p.txHash}`} target="_blank" rel="noreferrer">
                      {short(p.txHash, 8, 4)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* (d) Security proof — exercised live in the demo, not from this page */}
      <div className="tsec will-reveal">
        <span className="plabel demo">{t("t_demo")}</span>
        <span>{t("t_sec_1")}</span>
        <span className="tdot">·</span>
        <span>{t("t_sec_2")}</span>
      </div>
    </section>
  );
}
