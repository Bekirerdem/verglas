import { useI18n } from "../lib/i18n";

/** S2 — THE PROBLEM: payment instructions that never line up. Scraps of the
    real workflow drift on the ice (ambient float, out of alignment on
    purpose) — then one sentence names the gap. */
export function Problem() {
  const { t } = useI18n();
  return (
    <section className="problem2" id="problem">
      <p className="ptag will-reveal">{t("r2_tag")}</p>
      <div className="p2-drift">
        <div className="p2-card will-reveal">{t("r2_c1")}</div>
        <div className="p2-card will-reveal">{t("r2_c2")}</div>
        <div className="p2-card p2-file mono will-reveal">{t("r2_c3")}</div>
        <div className="p2-card p2-bot will-reveal">
          {t("r2_bot_h")} <b>{t("r2_bot_b")}</b>
        </div>
      </div>
      <p className="p2-close serif will-reveal">{t("r2_close")}</p>
    </section>
  );
}
