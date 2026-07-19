import { useState } from "react";
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

type Filter = "all" | HistoryItem["kind"];
const FILTERS: Filter[] = ["all", "spend", "deposit", "withdraw", "freeze"];

/** Everything that ever happened to the vault, newest first — the body of
    the working console. Chip filters, dense rows, tx links. */
export function VaultHistory({ view }: { view: VaultView }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  if (view.history.length === 0) return null;

  const rows = view.history.filter(
    (item) => filter === "all" || item.kind === filter || (filter === "freeze" && item.kind === "thaw"),
  );

  return (
    <section className="vhistory">
      <div className="vh-head">
        <h2 className="mono vh-tag">{t("app_history")}</h2>
        <div className="vh-filters" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={`vh-filter mono${filter === f ? " on" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? t("app_f_all") : t(KIND_KEYS[f])}
            </button>
          ))}
        </div>
      </div>
      <div className="vh-rows">
        {rows.map((item, i) => (
          <a
            className={`vh-row kind-${item.kind}`}
            key={`${item.txHash}-${item.kind}-${i}`}
            href={TX + item.txHash}
            target="_blank"
            rel="noreferrer"
          >
            <span className="mono vh-when">{utcDate(item.timestamp)}</span>
            <span className={`chip vh-chip kind-${item.kind}`}>{t(KIND_KEYS[item.kind])}</span>
            <span className="mono vh-who">{item.counterparty ? short(item.counterparty) : "—"}</span>
            <span className="mono vh-amt">
              {item.amount !== null ? `${SIGN[item.kind]}${usd(item.amount)}` : ""}
            </span>
            <span className="mono vh-link">↗</span>
          </a>
        ))}
        {rows.length === 0 && <p className="shelf-empty serif">—</p>}
      </div>
    </section>
  );
}
