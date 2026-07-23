import { useI18n } from "../lib/i18n";

/** S4 — WHY YOU'D BELIEVE IT: the three guarantees, one card each. The
    interchain crossing now has its own scene (Passport), so this section
    stays a compact, tonally-raised proof triad. */
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
    </section>
  );
}
