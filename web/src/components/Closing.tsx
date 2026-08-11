import { useI18n } from "../lib/i18n";

/** S6 — WHO IT'S FOR: the avax/business sector grid — a red spine on the
    left, four quiet cells, one dark button each. Every hand that touches
    agent money finds its own door out of the page. */
export function Closing() {
  const { t } = useI18n();
  const cells = [
    { h: "r6_w1_h", p: "r6_w1_p", href: "/app/" },
    { h: "r6_w2_h", p: "r6_w2_p", href: "https://github.com/Bekirerdem/verglas/tree/master/mcp" },
    { h: "r6_w3_h", p: "r6_w3_p", href: "/docs/" },
    { h: "r6_w4_h", p: "r6_w4_p", href: "https://github.com/Bekirerdem/verglas" },
  ] as const;
  return (
    <section className="closing sectors" id="sectors">
      <p className="ptag will-reveal">{t("r6_sec_tag")}</p>
      <div className="sector-grid will-reveal">
        {cells.map((c) => (
          <a className="sector" key={c.h} href={c.href} {...(c.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
            <h3>{t(c.h as "r6_w1_h")}</h3>
            <p>{t(c.p as "r6_w1_p")}</p>
            <span className="mono sector-cta">{t("r6_cta")} →</span>
          </a>
        ))}
      </div>
    </section>
  );
}
