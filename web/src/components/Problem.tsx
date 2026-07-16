import { useI18n } from "../lib/i18n";

/** S2 — THE PROBLEM: three sentences of "but", in human language. */
export function Problem() {
  const { t } = useI18n();
  return (
    <section className="problem" id="problem">
      <p className="ptag will-reveal">{t("s2_tag")}</p>
      <h2 className="will-reveal">
        {t("s2_p1_1")}
        <b>{t("s2_p1_b1")}</b>
        {t("s2_p1_2")}
        <b>{t("s2_p1_b2")}</b>
        {t("s2_p1_3")}
      </h2>
      <p className="pafter will-reveal">{t("s2_p2")}</p>
    </section>
  );
}
