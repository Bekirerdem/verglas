import { useI18n } from "../lib/i18n";

/** S2 — THE PROBLEM, split in two: the business and the bot. */
export function Problem() {
  const { t } = useI18n();
  return (
    <section className="problem2" id="problem">
      <p className="ptag will-reveal">{t("r2_tag")}</p>
      <div className="p2-panels">
        <div className="p2-biz will-reveal">
          <h2>{t("r2_biz_h")}</h2>
          <p>{t("r2_biz_p")}</p>
        </div>
        <div className="p2-bot will-reveal">
          <h3>
            {t("r2_bot_h")} <b>{t("r2_bot_b")}</b>
          </h3>
        </div>
      </div>
      <p className="p2-close serif will-reveal">{t("r2_close")}</p>
    </section>
  );
}
