import type { DashboardData, TreasurerData } from "../lib/data";
import { usd } from "../lib/format";
import { useI18n } from "../lib/i18n";

/** S5 — LIVE RIGHT NOW: three chosen numbers instead of a raw table,
    then the four differences, compact. */
export function LiveBand({ data, treasurer }: { data: DashboardData; treasurer: TreasurerData | null }) {
  const { t } = useI18n();
  const lastFx = treasurer?.payments[0];
  const diffs = [
    { t: t("s5_d1_t"), b: t("s5_d1_b"), p: t("s5_d1_p") },
    { t: t("s5_d2_t"), b: t("s5_d2_b"), p: t("s5_d2_p") },
    { t: t("s5_d3_t"), b: t("s5_d3_b"), p: t("s5_d3_p") },
    { t: t("s5_d4_t"), b: t("s5_d4_b"), p: t("s5_d4_p") },
  ];
  return (
    <section className="liveband" id="live">
      <p className="ptag will-reveal">{t("s5_tag")}</p>
      <div className="metrics will-reveal">
        <div className="metric">
          <span className="ml">{t("s5_m1_l")}</span>
          <span className={`mv ${data.cleared ? "ok" : ""}`}>
            <span className="dot" /> {data.cleared ? t("s5_m1_v") : t("s5_m1_off")}
          </span>
        </div>
        <div className="metric">
          <span className="ml">{t("s5_m2_l")}</span>
          <span className="mv">
            {lastFx ? `${usd(lastFx.amount)} USDC @ ${(Number(lastFx.rateUsdTry) / 1e8).toFixed(2)}` : t("s5_m2_none")}
          </span>
        </div>
        <div className="metric">
          <span className="ml">{t("s5_m3_l")}</span>
          <span className="mv">{t("s5_m3_v")}</span>
        </div>
      </div>

      <div className="diffs">
        {diffs.map((d) => (
          <div className="diff will-reveal" key={d.b}>
            <h4>
              {d.t} <b>{d.b}</b>
            </h4>
            <p>{d.p}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
