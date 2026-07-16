import { FUJI_DEPLOYMENT } from "@verglas/sdk";
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
          <p className="chead">{t("foot_ops_h")}</p>
          <pre>
            <span className="hl">import</span> {"{ VerglasClient }"} <span className="hl">from</span>{" "}
            "@verglas/sdk";{"\n"}
            <span className="hl">const</span> verglas = VerglasClient.fuji();{"\n"}
            <span className="hl">await</span> verglas.isCleared({FUJI_DEPLOYMENT.agentId.toString()}n);{" "}
            <span className="hl">// true</span>
          </pre>
        </div>
        <div className="col">
          <p className="chead">{t("foot_dep_h")}</p>
          <pre>
            HUB &nbsp;{FUJI_DEPLOYMENT.hub.slice(0, 20)}…{"\n"}
            GATE {FUJI_DEPLOYMENT.gateOnDispatch.slice(0, 20)}…{"\n"}
            <span className="hl">fuji c-chain → dispatch l1</span>
          </pre>
        </div>
      </div>

      <div className="legal">
        <span>{t("foot_legal")}</span>
        <span className="links">
          <a href="https://github.com/Bekirerdem/verglas" target="_blank" rel="noreferrer">
            GITHUB
          </a>
          <a href={`https://testnet.snowtrace.io/address/${FUJI_DEPLOYMENT.hub}`} target="_blank" rel="noreferrer">
            HUB
          </a>
          <a
            href={`https://subnets-test.avax.network/dispatch/address/${FUJI_DEPLOYMENT.gateOnDispatch}`}
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
