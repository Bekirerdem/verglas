import { FUJI_DEPLOYMENT } from "@verglas/sdk";
import type { DashboardData } from "../lib/data";
import { remaining } from "../lib/format";

/** S1 — avax/business hero: the mountain does the talking. Copy sits
    bottom-left, minimal; the live clearance is the one proof on screen. */
export function Hero({ data }: { data: DashboardData }) {
  const { cleared, attestation, gateMaxAge } = data;
  const expires = attestation && gateMaxAge > 0n ? remaining(attestation.issuedAt + gateMaxAge) : "";

  return (
    <header className="hero">
      <div className="topbar">
        <div className="brand">
          VERGLAS<sup>ICM</sup>
        </div>
        <nav className="navlinks">
          <a href="#why">WHY</a>
          <a href="#crossing">CROSSING</a>
          <a href="#ledger">LEDGER</a>
        </nav>
        <a
          className="cta-pill"
          href={`https://subnets-test.avax.network/dispatch/address/${FUJI_DEPLOYMENT.gateOnDispatch}`}
          target="_blank"
          rel="noreferrer"
        >
          LIVE GATE →
        </a>
      </div>

      <div className="hero-block">
        <p className="kicker hero-anim">AGENT TRUST THAT TRAVELS · BUILT ON AVALANCHE</p>
        <h1>
          <span className="hero-anim" style={{ display: "block" }}>
            Prove once.
          </span>
          <span className="l2 hero-anim">Pass every gate.</span>
        </h1>
        <p className="subline hero-anim">
          Contract-enforced rules on one chain, a zero-knowledge proof over the whole window — and
          an attestation that <b>crosses the border</b> to any Avalanche L1.
        </p>

        <div className="clearance hero-anim" role="status">
          <span className="cell agent">
            AGENT <b>#{FUJI_DEPLOYMENT.agentId.toString()}</b>
          </span>
          <span className={`cell status ${cleared ? "ok" : "no"}`}>
            <span className="dot" />
            {cleared ? "CLEARED AT DISPATCH" : "NOT CLEARED"}
          </span>
          <span className="cell until">{cleared && expires ? `VALID ${expires}` : "LIVE QUERY"}</span>
        </div>
      </div>

      <div className="stampmark hero-anim" aria-hidden="true">
        <span className="score">100</span>
        <span className="of">SCORE</span>
      </div>
    </header>
  );
}
