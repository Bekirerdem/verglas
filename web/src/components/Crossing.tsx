import type { DashboardData } from "../lib/data";
import { remaining } from "../lib/format";

/** The signature moment: a proof stamped on C-Chain crossing to a second L1. */
export function Crossing({ data }: { data: DashboardData }) {
  const { cleared, attestation, gateMaxAge } = data;
  const expires = attestation && gateMaxAge > 0n ? remaining(attestation.issuedAt + gateMaxAge) : "";

  return (
    <div className="card crossing">
      <div className="lane">
        <div className="node">
          <div className="glyph">C</div>
          <div className="nname">Fuji C-Chain</div>
          <div className="nrole">HUB · PROOF VERIFIED HERE</div>
        </div>
        <div className="icmline" aria-hidden="true">
          <span className="icmlabel">INTERCHAIN MESSAGING</span>
          <span className="flow" />
          <span className="flow" />
        </div>
        <div className="node">
          <div className="glyph">D</div>
          <div className="nname">Dispatch L1</div>
          <div className="nrole">GATE · CLEARANCE CHECKED HERE</div>
        </div>
      </div>
      <div className="clearance">
        <span className={`status ${cleared ? "ok" : "no"}`}>
          {cleared ? "✓ AGENT #1599 CLEARED" : "✕ NOT CLEARED"}
        </span>
        <span className="expl">
          {cleared
            ? `asked live on Dispatch${expires ? ` — valid another ${expires}` : ""}`
            : "no fresh attestation at this gate"}
        </span>
      </div>
    </div>
  );
}
