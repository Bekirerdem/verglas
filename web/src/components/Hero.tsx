import { FUJI_DEPLOYMENT } from "@verglas/sdk";
import type { DashboardData } from "../lib/data";
import { remaining } from "../lib/format";

/** S1 — THE CHECKPOINT. Center stage: the claim and the live clearance.
    Everything else orbits the edges (wraith composition, lusty live-data). */
export function Hero({ data }: { data: DashboardData }) {
  const { cleared, attestation, gateMaxAge } = data;
  const expires = attestation && gateMaxAge > 0n ? remaining(attestation.issuedAt + gateMaxAge) : "";

  return (
    <header className="hero">
      <svg className="lines" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
        <line x1="-5" y1="72" x2="105" y2="30" />
        <line x1="-5" y1="38" x2="105" y2="66" />
        <line x1="-5" y1="88" x2="105" y2="52" />
        <circle cx="50" cy="47" r="17" />
        <circle cx="50" cy="47" r="27" />
      </svg>

      <div className="topbar">
        <div className="brand">
          VERGLAS<sup>ICM</sup>
        </div>
        <nav className="toplinks">
          <a href="https://github.com/Bekirerdem/verglas" target="_blank" rel="noreferrer">
            GITHUB
          </a>
          <a href="#ledger">LEDGER →</a>
        </nav>
      </div>

      <div className="sat tl">
        <b>ORIGIN</b>
        [ FUJI C-CHAIN · HUB ]
      </div>
      <div className="sat tr">
        <b>DESTINATION</b>
        [ DISPATCH L1 · GATE ]
      </div>
      <div className="sat bl">
        <b>PROOF</b>
        [ GROTH16 · BN254 ]
      </div>
      <div className="sat br">
        <b>TRANSPORT</b>
        [ ICM · TELEPORTER ]
      </div>

      <div className="stampmark hero-anim" aria-hidden="true">
        <span className="score">100</span>
        <span className="of">SCORE</span>
      </div>

      <p className="kicker hero-anim">AGENT TRUST THAT TRAVELS</p>
      <h1>
        <span className="hero-anim" style={{ display: "block" }}>
          Prove once.
        </span>
        <span className="l2 hero-anim">Pass every gate.</span>
      </h1>
      <p className="subline hero-anim">
        an AI agent spends inside contract-enforced rules on one chain — a zero-knowledge proof
        attests the whole window, and the attestation <b>crosses the border</b> to be honored on
        other Avalanche L1s.
      </p>

      <div className="clearance hero-anim" role="status">
        <span className="cell agent">
          AGENT <b>#{FUJI_DEPLOYMENT.agentId.toString()}</b>
        </span>
        <span className={`cell status ${cleared ? "ok" : "no"}`}>
          <span className="dot" />
          {cleared ? "CLEARED AT DISPATCH" : "NOT CLEARED"}
        </span>
        <span className="cell until">{cleared && expires ? `VALID ${expires}` : "LIVE QUERY · FUJI TESTNET"}</span>
      </div>

      <div className="scroll-cue">FOLLOW THE CROSSING</div>
    </header>
  );
}
