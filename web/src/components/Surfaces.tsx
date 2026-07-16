import type { TreasurerData } from "../lib/data";
import { usd } from "../lib/format";
import { useI18n } from "../lib/i18n";

function rate8(v: bigint): string {
  return (Number(v) / 1e8).toFixed(2);
}

/** S4 — TWO SURFACES, 7/5 asymmetric: the treasurer for businesses,
    the trust machine for L1s and agent builders. */
export function Surfaces({ treasurer }: { treasurer: TreasurerData | null }) {
  const { t } = useI18n();
  return (
    <section className="surfaces" id="surfaces">
      <p className="ptag will-reveal">{t("s4_tag")}</p>
      <div className="sgrid">
        <div className="scard main will-reveal">
          <p className="sfor">{t("s4_t_for")}</p>
          <h3>{t("s4_t_h")}</h3>
          <p className="sp">{t("s4_t_p")}</p>
          <div className="sproof">
            <span className="pv">{t("s4_t_proof_v")}</span>
            <span className="pt">{t("s4_t_proof")}</span>
          </div>
          {treasurer && (
            <div className="slive">
              <span>
                {t("s4_t_rate")} <b>{rate8(treasurer.pythRateUsdTry)}</b>
              </span>
              <span>
                {t("s4_t_today")} <b>{usd(treasurer.spentToday)}</b> / {usd(treasurer.dailyLimit)} USDC
              </span>
            </div>
          )}
        </div>
        <div className="scard side will-reveal">
          <p className="sfor">{t("s4_m_for")}</p>
          <h3>{t("s4_m_h")}</h3>
          <p className="sp">{t("s4_m_p")}</p>
          <pre className="scode">await verglas.isCleared(agentId) // true</pre>
          <p className="sfoot">{t("s4_m_foot")}</p>
        </div>
      </div>
    </section>
  );
}
