import { FUJI_DEPLOYMENT } from "@verglas/sdk";

/** S6 — back to night: the type wall and the operator's on-ramp. */
export function FooterWall() {
  return (
    <footer className="foot">
      <p className="invite">
        Running an Avalanche L1? Put a gate on your border — <b>one view call</b> tells you whether
        an agent holds a fresh, sufficient attestation.
      </p>

      <a className="wall" href="https://github.com/Bekirerdem/verglas" target="_blank" rel="noreferrer">
        GITHUB/VERGLAS
      </a>

      <div className="cols">
        <div className="col">
          <p className="chead">○ OPEN BY DESIGN</p>
          <p>
            ERC-8004 registries, Groth16 verified on-chain, ICM for transport. No walled identity,
            no custodian — clear as glass, hard as ice.
          </p>
        </div>
        <div className="col">
          <p className="chead">◎ FOR L1 OPERATORS</p>
          <pre>
            <span className="hl">import</span> {"{ VerglasClient }"} <span className="hl">from</span>{" "}
            "@verglas/sdk";{"\n"}
            <span className="hl">const</span> verglas = VerglasClient.fuji();{"\n"}
            <span className="hl">await</span> verglas.isCleared({FUJI_DEPLOYMENT.agentId.toString()}n);{" "}
            <span className="hl">// true</span>
          </pre>
        </div>
        <div className="col">
          <p className="chead">◍ THE DEPLOYMENT</p>
          <pre>
            HUB &nbsp;{FUJI_DEPLOYMENT.hub.slice(0, 20)}…{"\n"}
            GATE {FUJI_DEPLOYMENT.gateOnDispatch.slice(0, 20)}…{"\n"}
            <span className="hl">fuji c-chain → dispatch l1</span>
          </pre>
        </div>
      </div>

      <div className="legal">
        <span>© VERGLAS 2026 · BUILT ON AVALANCHE</span>
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
