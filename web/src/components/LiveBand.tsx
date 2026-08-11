import type { DashboardData, FreshClearance, TreasurerData } from "../lib/data";
import { SHOWCASE_AGENT_ID } from "../lib/network";
import { useI18n } from "../lib/i18n";

/** S5 — LIVE PROOF: three chosen numbers instead of a raw table. The
    clearance cell follows the same fresh-record fallback as the hero —
    the proof band must never argue against the page. */
export function LiveBand({
  data,
  fresh,
  treasurer,
}: {
  data: DashboardData | null;
  fresh: FreshClearance | null;
  treasurer: TreasurerData | null;
}) {
  const { t } = useI18n();
  // A live, moving rate is better landing proof than a stale payment — and
  // it needs no eth_getLogs, so the fallback RPCs never 500 on the landing.
  const rate = treasurer ? treasurer.pythRateUsdTry : null;
  const useFallback = data?.cleared === false && fresh !== null;
  const cleared = useFallback ? true : (data?.cleared ?? false);
  const shownId = useFallback ? fresh.agentId : SHOWCASE_AGENT_ID;
  return (
    <section className="liveband" id="live">
      <span className="lb-giant" aria-hidden="true">{t("s5_giant")}</span>
      <p className="ptag will-reveal">{t("s5_tag")}</p>
      <div className="metrics will-reveal">
        <div className="metric">
          <span className="ml">{t("hero_agent")} #{shownId.toString()}</span>
          <span className={`mv ${cleared ? "ok" : ""}`}>
            <span className="dot" /> {cleared ? t("s5_m1_v") : t("s5_m1_off")}
          </span>
        </div>
        <div className="metric">
          <span className="ml">{t("s5_m2_l")}</span>
          <span className="mv">
            {rate ? `${(Number(rate) / 1e8).toFixed(2)} ₺` : t("s5_m2_none")}
          </span>
        </div>
        <div className="metric">
          <span className="ml">{t("s5_m3_l")}</span>
          <span className="mv">{t("s5_m3_v")}</span>
        </div>
      </div>

      <a className="cta-main lb-cta will-reveal" href="/app/">
        {t("r6_biz_cta")}
      </a>
    </section>
  );
}
