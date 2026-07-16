import { FUJI_DEPLOYMENT } from "@verglas/sdk";
import { short } from "../lib/format";

/** avax/business puts a partner-logo strip under the hero; our partners are
    on-chain facts, so the strip carries deployment evidence instead. */
export function ProofStrip() {
  const items = [
    `HUB ${short(FUJI_DEPLOYMENT.hub)}`,
    `GATE ${short(FUJI_DEPLOYMENT.gateOnDispatch)}`,
    "GROTH16 · 287K GAS",
    "ICM · DELIVERED IN SECONDS",
    "ERC-8004 REGISTRIES",
    "FUJI TESTNET · LIVE",
  ];
  return (
    <div className="proof-strip" aria-label="Deployment evidence">
      {items.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
  );
}
