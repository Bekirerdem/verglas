import type { HistoryItem, VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { short, usd, utcDate } from "../../lib/format";

const TX = "https://testnet.snowtrace.io/tx/";

const KIND_KEYS = {
  spend: "app_h_spend",
  withdraw: "app_h_withdraw",
  deposit: "app_h_deposit",
  freeze: "app_h_freeze",
  thaw: "app_h_thaw",
} as const;

const SIGN: Record<HistoryItem["kind"], string> = {
  spend: "−",
  withdraw: "−",
  deposit: "+",
  freeze: "",
  thaw: "",
};

/** Everything that ever happened to the vault, newest first. */
export function VaultHistory({ view }: { view: VaultView }) {
  const { t } = useI18n();
  if (view.history.length === 0) return null;

  return (
    <section className="vhistory">
      <h2 className="mono vh-tag">{t("app_history")}</h2>
      <div className="vh-rows">
        {view.history.map((item, i) => (
          <a
            className={`vh-row kind-${item.kind}`}
            key={`${item.txHash}-${item.kind}-${i}`}
            href={TX + item.txHash}
            target="_blank"
            rel="noreferrer"
          >
            <span className={`chip vh-chip kind-${item.kind}`}>{t(KIND_KEYS[item.kind])}</span>
            <span className="mono vh-amt">
              {item.amount !== null ? `${SIGN[item.kind]}${usd(item.amount)} USDC` : "—"}
            </span>
            <span className="mono vh-who">{item.counterparty ? short(item.counterparty) : ""}</span>
            <span className="mono vh-when">{utcDate(item.timestamp)}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
