import type { DashboardData } from "../lib/data";
import { short, utcDate } from "../lib/format";

export function StampShelf({ data }: { data: DashboardData }) {
  const { stamps, attestation } = data;

  if (stamps.length === 0) {
    return <div className="shelf-empty">No attestations yet — the first proof window is still open.</div>;
  }

  return (
    <div className="shelf">
      {stamps.map((s) => (
        <div className="stamp" key={s.requestHash}>
          <div className="seal">
            <span className="score">{s.score}</span>
            <span className="of">SCORE</span>
          </div>
          <div className="stampmeta">
            <div className="t">ATTESTED · POLICY COMPLIANCE</div>
            agent #1599
            {attestation?.requestHash === s.requestHash
              ? ` · window of ${attestation.txCount.toString()} spends`
              : ""}
            <br />
            <span className="hash">{short(s.requestHash, 10, 6)}</span>
            {utcDate(s.lastUpdate)}
          </div>
        </div>
      ))}
    </div>
  );
}
