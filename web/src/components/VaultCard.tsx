import { FUJI_DEPLOYMENT } from "@verglas/sdk";
import type { DashboardData } from "../lib/data";
import { short, usd } from "../lib/format";

export function VaultCard({ data }: { data: DashboardData }) {
  const { account, balance } = data;
  const spentPct = account.totalBudget === 0n ? 0 : Number((account.totalSpent * 100n) / account.totalBudget);

  return (
    <div className="card">
      <div className="clabel">
        <span>VAULT · {short(FUJI_DEPLOYMENT.account)}</span>
        <span className={`frozen-pill${account.frozen ? " frozen" : ""}`}>
          {account.frozen ? "FROZEN" : "ACTIVE"}
        </span>
      </div>
      <div className="kv">
        <span className="k">Balance</span>
        <span className="v">{usd(balance)} vUSD</span>
      </div>
      <div className="kv">
        <span className="k">Spent this cycle</span>
        <span className="v">
          {usd(account.totalSpent)} / {usd(account.totalBudget)}
        </span>
      </div>
      <div className="bar" role="img" aria-label={`${spentPct}% of budget spent`}>
        <i style={{ width: `${spentPct}%` }} />
      </div>
      <div className="barnote">
        {account.txCount.toString()} spends · per-tx limit {usd(account.perTxLimit)} · owner can freeze anytime
      </div>
      <div className="kv" style={{ marginTop: 18 }}>
        <span className="k">Allowed destinations</span>
        <span className="v mono">{account.whitelist.map((w) => short(w, 4, 2)).join("  ")}</span>
      </div>
      <div className="kv">
        <span className="k">Commitment</span>
        <span className="v mono">{short(`0x${account.commitment.toString(16).padStart(64, "0")}`, 10, 6)}</span>
      </div>
    </div>
  );
}
