import { FUJI_DEPLOYMENT } from "@verglas/sdk";
import type { DashboardData } from "../lib/data";
import { short, usd, utcDate } from "../lib/format";

/** S5 — THE LEDGER. The archive room: every stamp, every folded spend.
    Lusty-grade functional data on daylight. */
export function Ledger({ data }: { data: DashboardData }) {
  return (
    <section className="ledger" id="ledger">
      <p className="lhead">
        04 · THE LEDGER <i>[ LIVE · FUJI TESTNET ]</i>
      </p>
      <h3 className="will-reveal">
        every stamp is a proof, <em>not a self-report.</em>
      </h3>

      {data.stamps.length === 0 ? (
        <p className="empty-note">No attestations yet — the first proof window is still open.</p>
      ) : (
        <div className="stamp-row">
          {data.stamps.map((s) => (
            <div className="stamp-card will-reveal" key={s.requestHash}>
              <div className="seal" aria-hidden="true">
                <span className="score">{s.score}</span>
                <span className="of">SCORE</span>
              </div>
              <div className="smeta">
                <div className="t">ATTESTED · POLICY COMPLIANCE</div>
                agent #{FUJI_DEPLOYMENT.agentId.toString()}
                {data.attestation?.requestHash === s.requestHash
                  ? ` · window of ${data.attestation.txCount.toString()} spends`
                  : ""}
                <br />
                <span className="hash">{short(s.requestHash, 12, 8)}</span>
                {utcDate(s.lastUpdate)}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.spends.length === 0 ? (
        <p className="empty-note">No spends in the recent scan window.</p>
      ) : (
        <div className="table-scroll">
          <table className="spends">
            <thead>
              <tr>
                <th>#</th>
                <th>TO</th>
                <th>AMOUNT</th>
                <th>FOLDED COMMITMENT</th>
                <th>WHEN</th>
                <th>TX</th>
              </tr>
            </thead>
            <tbody>
              {data.spends.map((s) => (
                <tr key={s.txHash + s.txIndex.toString()}>
                  <td>{s.txIndex.toString()}</td>
                  <td>{short(s.to, 6, 3)}</td>
                  <td className="amt">{usd(s.amount)} vUSD</td>
                  <td>
                    <span className="commit">{short(`0x${s.newCommitment.toString(16).padStart(64, "0")}`, 12, 6)}</span>
                  </td>
                  <td>{utcDate(s.timestamp)}</td>
                  <td>
                    <a href={`https://testnet.snowtrace.io/tx/${s.txHash}`} target="_blank" rel="noreferrer">
                      {short(s.txHash, 8, 4)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
