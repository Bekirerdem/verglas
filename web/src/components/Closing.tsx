import { useI18n } from "../lib/i18n";

/** S6 — THE CLOSE: two doors, one per persona. */
export function Closing() {
  const { t } = useI18n();
  return (
    <section className="closing doors">
      <a className="door door-biz will-reveal" href="/app/">
        <h3>{t("r6_biz_h")}</h3>
        <p className="serif">{t("r6_biz_p")}</p>
        <span className="mono door-cta">{t("r6_biz_cta")}</span>
      </a>
      <a className="door door-dev will-reveal" href="/docs/">
        <h3>{t("r6_dev_h")}</h3>
        <p className="serif">{t("r6_dev_p")}</p>
        <span className="mono door-cta">{t("r6_dev_cta")}</span>
      </a>
    </section>
  );
}
