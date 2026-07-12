import { useEffect, useState } from "react";
import { FUJI_DEPLOYMENT } from "@verglas/sdk";
import { fetchDashboard, type DashboardData } from "./lib/data";
import { short } from "./lib/format";
import { VaultCard } from "./components/VaultCard";
import { Crossing } from "./components/Crossing";
import { StampShelf } from "./components/StampShelf";
import { SpendTable } from "./components/SpendTable";

const REFRESH_MS = 45_000;

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchDashboard().then(
        (d) => {
          if (alive) {
            setData(d);
            setError(null);
          }
        },
        (e: unknown) => {
          if (alive) setError(e instanceof Error ? e.message : String(e));
        },
      );
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="wordmark">VERGLAS</div>
        <div className="livepill">
          <span className="dot" /> LIVE ON FUJI TESTNET
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">AGENT TRUST THAT TRAVELS · AVALANCHE</div>
        <h1>
          Prove once.
          <br />
          <em>Pass every gate.</em>
        </h1>
        <p className="sub">
          This is a live AI-agent vault on the Fuji C-Chain. Its spending stays inside owner-set
          rules, a zero-knowledge proof attests the whole window without revealing a single
          transaction — and the attestation travels over Interchain Messaging to be honored on
          other Avalanche L1s.
        </p>
        <div className="addr-row">
          <span className="addr-tag">
            HUB <b>{short(FUJI_DEPLOYMENT.hub)}</b>
          </span>
          <span className="addr-tag">
            REGISTRY <b>{short(FUJI_DEPLOYMENT.validationRegistry)}</b>
          </span>
          <span className="addr-tag">
            GATE ON DISPATCH <b>{short(FUJI_DEPLOYMENT.gateOnDispatch)}</b>
          </span>
        </div>
      </section>

      {error && <div className="err">RPC error: {error} — retrying shortly.</div>}
      {!data && !error && <div className="loading">READING THE CHAIN…</div>}

      {data && (
        <>
          <div className="grid">
            <section className="block" aria-label="Vault">
              <div className="sec-head">
                <h2>The vault</h2>
                <span className="note">rules live in the contract, not in a promise</span>
              </div>
              <VaultCard data={data} />
            </section>
            <section className="block" aria-label="Interchain crossing">
              <div className="sec-head">
                <h2>The crossing</h2>
                <span className="note">one proof, honored on a second chain</span>
              </div>
              <Crossing data={data} />
            </section>
          </div>

          <section className="block" aria-label="Attestations">
            <div className="sec-head">
              <h2>Attestations</h2>
              <span className="note">every stamp is a verified proof — not a self-report</span>
            </div>
            <StampShelf data={data} />
          </section>

          <section className="block" aria-label="Recent spends">
            <div className="sec-head">
              <h2>Recent spends</h2>
              <span className="note">each one folded into the commitment the proof opens</span>
            </div>
            <SpendTable data={data} />
          </section>
        </>
      )}

      <footer>
        <div className="links">
          <a href="https://github.com/Bekirerdem/verglas" target="_blank" rel="noreferrer">
            GITHUB
          </a>
          <a
            href={`https://testnet.snowtrace.io/address/${FUJI_DEPLOYMENT.hub}`}
            target="_blank"
            rel="noreferrer"
          >
            HUB ON SNOWTRACE
          </a>
          <a
            href={`https://subnets-test.avax.network/dispatch/address/${FUJI_DEPLOYMENT.gateOnDispatch}`}
            target="_blank"
            rel="noreferrer"
          >
            GATE ON DISPATCH
          </a>
        </div>
        <div>VERGLAS · CLEAR AS GLASS, HARD AS ICE</div>
      </footer>
    </div>
  );
}
