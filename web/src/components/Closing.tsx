import { FUJI_DEPLOYMENT } from "@verglas/sdk";
import { useI18n } from "../lib/i18n";

/** S6 — THE CLOSE: one invitation, two doors. */
export function Closing() {
  const { t } = useI18n();
  return (
    <section className="closing">
      <h2 className="will-reveal">
        {t("s6_h")}
        <em>{t("s6_sub")}</em>
      </h2>
      <div className="ccta will-reveal">
        <a
          className="cta-main"
          href={`https://subnets-test.avax.network/dispatch/address/${FUJI_DEPLOYMENT.gateOnDispatch}`}
          target="_blank"
          rel="noreferrer"
        >
          {t("s6_cta_gate")}
        </a>
        <a className="cta-ghost" href="/docs/">
          {t("s6_cta_docs")}
        </a>
      </div>
    </section>
  );
}
