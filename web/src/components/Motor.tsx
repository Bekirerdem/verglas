import { useI18n } from "../lib/i18n";

/** S4 — THE ENGINE: why you'd believe it. Compact; the full-bleed ice band
    carries the stamp from hub to gate in a slow loop. */
export function Motor() {
  const { t } = useI18n();
  const cards = [1, 2, 3] as const;
  return (
    <section className="motor" id="motor">
      <h2 className="serif will-reveal">{t("r4_h")}</h2>
      <div className="m-cards">
        {cards.map((n) => (
          <div className="m-card will-reveal" key={n}>
            <span className="mono m-tag">{t(`r4_c${n}_t` as "r4_c1_t")}</span>
            <p>{t(`r4_c${n}_p` as "r4_c1_p")}</p>
          </div>
        ))}
      </div>
      <div className="m-band" aria-hidden="true">
        <span className="mono m-node">C-CHAIN</span>
        <i className="m-rail">
          <b className="m-stamp">VG</b>
        </i>
        <span className="mono m-node">DISPATCH</span>
        <span className="m-bandtext">
          {t("band_1")} → {t("band_2")}
        </span>
      </div>
    </section>
  );
}
