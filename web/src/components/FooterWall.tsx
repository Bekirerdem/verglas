import { DEPLOYMENT, NET } from "../lib/network";
import { useI18n } from "../lib/i18n";

/** S7 — the type wall and the operator's on-ramp. */
export function FooterWall() {
  const { t } = useI18n();
  return (
    <footer className="foot">
      <p className="invite">
        {t("foot_invite_1")}
        <b>{t("foot_invite_b")}</b>
        {t("foot_invite_2")}
      </p>

      <a className="wall" href="https://github.com/Bekirerdem/verglas" target="_blank" rel="noreferrer">
        GITHUB/VERGLAS
      </a>

      <div className="cols">
        <div className="col">
          <p className="chead">{t("foot_open_h")}</p>
          <p>{t("foot_open_p")}</p>
        </div>
        <div className="col">
          <p className="chead">{t("foot_docs_h")}</p>
          <p>
            {t("foot_docs_p")}{" "}
            <a className="doclink" href="/docs/">
              /docs →
            </a>
          </p>
        </div>
      </div>

      <div className="legal">
        <span>{t("foot_legal")}</span>
        <span className="links">
          <a href="https://github.com/Bekirerdem/verglas" target="_blank" rel="noreferrer">
            GITHUB
          </a>
          <a href="/docs/">DOCS</a>
          <a href={`${NET.explorer}/address/${DEPLOYMENT.hub}`} target="_blank" rel="noreferrer">
            HUB
          </a>
          <a
            href={`https://subnets-test.avax.network/dispatch/address/${DEPLOYMENT.gate?.address ?? ""}`}
            target="_blank"
            rel="noreferrer"
          >
            GATE
          </a>
        </span>
      </div>
    </footer>
  );
}
