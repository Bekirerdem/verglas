import { FUJI_DEPLOYMENT } from "@verglas/sdk";
import type { DashboardData } from "../lib/data";
import { short, usd, utcDate } from "../lib/format";

/** S3 — THE PAPERS. How an attestation gets pressed: numbered steps on the
    left, the living document (real chain data) pinned on the right. */
export function Papers({ data }: { data: DashboardData }) {
  const { account, attestation, balance } = data;
  const spentPct = account.totalBudget === 0n ? 0 : Number((account.totalSpent * 100n) / account.totalBudget);

  return (
    <section className="papers">
      <div>
        <p className="lede">
          02 · THE PAPERS <i>[ POSEIDON · GROTH16 · ERC-8004 ]</i>
        </p>
        <h3 className="will-reveal">
          rules in the contract, <em>proof in the math.</em>
        </h3>

        <div className="step will-reveal">
          <div className="num">01 · BOUND</div>
          <div>
            <h4>the vault is the leash</h4>
            <p className="stag">[ WHITELIST · PER-TX LIMIT · BUDGET · FREEZE ]</p>
            <p>
              the agent's only door to the funds is <b>spend()</b> — every rule is checked
              on-chain, and the owner can freeze the account at any moment. no promise, no policy
              PDF; a contract.
            </p>
          </div>
        </div>

        <div className="step will-reveal">
          <div className="num">02 · FOLDED</div>
          <div>
            <h4>every spend freezes into the chain</h4>
            <p className="stag">[ POSEIDON HASH CHAIN ]</p>
            <p>
              each transfer folds into a running commitment — like snow packing into ice. the
              history can't be rewritten, cherry-picked or hidden.
            </p>
          </div>
        </div>

        <div className="step will-reveal">
          <div className="num">03 · PROVEN</div>
          <div>
            <h4>prove the window, reveal nothing</h4>
            <p className="stag">[ GROTH16 · 86K CONSTRAINTS · VERIFIED ON-CHAIN ]</p>
            <p>
              a zero-knowledge proof shows <b>every destination was whitelisted and every amount
              under the limit</b> — without exposing a single transaction. the hub verifies it
              on-chain; no valid proof, no stamp.
            </p>
          </div>
        </div>

        <div className="step will-reveal">
          <div className="num">04 · STAMPED</div>
          <div>
            <h4>the registry takes the stamp</h4>
            <p className="stag">[ ERC-8004 VALIDATION REGISTRY ]</p>
            <p>
              the attestation lands in an open registry any explorer can index — and from there,
              it's ready to travel.
            </p>
          </div>
        </div>
      </div>

      <div className="doc-col">
        <div className="document will-reveal">
          <div className="doc-stamp" aria-hidden="true">
            <span className="score">{attestation ? attestation.score : "—"}</span>
            <span className="of">SCORE</span>
          </div>
          <p className="dlabel">ATTESTATION · POLICY COMPLIANCE</p>
          <p className="dtitle">Agent #{FUJI_DEPLOYMENT.agentId.toString()}</p>
          <div className="drow">
            <span>WINDOW</span>
            <span className="v">{attestation ? `${attestation.txCount.toString()} spends` : "open"}</span>
          </div>
          <div className="drow">
            <span>REQUEST</span>
            <span className="v">{attestation ? short(attestation.requestHash, 12, 8) : "—"}</span>
          </div>
          <div className="drow">
            <span>ISSUED</span>
            <span className="v">{attestation ? utcDate(attestation.issuedAt) : "—"}</span>
          </div>
          <div className="drow">
            <span>VERIFIER</span>
            <span className="v">Groth16 · on-chain</span>
          </div>
        </div>

        <div className="vault-strip will-reveal">
          <div className="vhead">
            <span>VAULT · {short(FUJI_DEPLOYMENT.account)}</span>
            <span className={`state${account.frozen ? " frozen" : ""}`}>{account.frozen ? "FROZEN" : "ACTIVE"}</span>
          </div>
          <div className="vbar">
            <i style={{ width: `${spentPct}%` }} />
          </div>
          <div className="vnums">
            <span>
              spent <b>{usd(account.totalSpent)}</b> / {usd(account.totalBudget)}
            </span>
            <span>
              balance <b>{usd(balance)} vUSD</b>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
