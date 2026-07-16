import { FUJI_DEPLOYMENT } from "@verglas/sdk";
import { short } from "../lib/format";
import { useI18n } from "../lib/i18n";

/** avax puts a partner-logo strip under the hero; our partners are on-chain
    facts, so the strip carries deployment evidence instead. */
export function ProofStrip() {
  const { t } = useI18n();
  const items = [
    `HUB ${short(FUJI_DEPLOYMENT.hub)}`,
    `GATE ${short(FUJI_DEPLOYMENT.gateOnDispatch)}`,
    t("strip_gas"),
    t("strip_icm"),
    t("strip_8004"),
    t("strip_live"),
  ];
  return (
    <div className="proof-strip" aria-label="Deployment evidence">
      {items.map((x) => (
        <span key={x}>{x}</span>
      ))}
    </div>
  );
}
