import type { DashboardData } from "../lib/data";
import { short, usd, utcDate } from "../lib/format";

export function SpendTable({ data }: { data: DashboardData }) {
  if (data.spends.length === 0) {
    return <div className="spends-empty">No spends in the recent scan window.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
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
                <span className="commit">{short(`0x${s.newCommitment.toString(16).padStart(64, "0")}`, 10, 6)}</span>
              </td>
              <td>{utcDate(s.timestamp)}</td>
              <td>
                <a
                  href={`https://testnet.snowtrace.io/tx/${s.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {short(s.txHash, 8, 4)}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
