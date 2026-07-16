import { useI18n } from "../lib/i18n";

/** S6 — the V2 teaser: the treasurer moves into the vault. */
export function NextBand() {
  const { t } = useI18n();
  return (
    <section className="next-band">
      <p className="ntag">{t("next_tag")}</p>
      <h3 className="will-reveal">
        {t("next_1")}
        <b>{t("next_b")}</b>
        {t("next_2")}
      </h3>
      <p className="nsub">{t("next_sub")}</p>
    </section>
  );
}
