import { useState } from "react";
import type { HistoryItem, HistoryKind, VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { short, usd, utcDate } from "../../lib/format";
import { contactName, initials } from "../lib/contacts";
import { memoFor, setMemo } from "../lib/memos";

const TX = "https://testnet.snowtrace.io/tx/";

const COLORS = ["#4c3b2a", "#2a3a4c", "#3c2a4c", "#2a4c3b", "#4c463d", "#5c2a2a"];
const colorFor = (addr: string) => COLORS[parseInt(addr.slice(-2), 16) % COLORS.length];

const SIGN: Record<HistoryItem["kind"], string> = {
  spend: "−",
  withdraw: "−",
  deposit: "+",
  freeze: "",
  thaw: "",
};

interface Props {
  view: VaultView;
  vaultLabel: string;
  query: string;
  /** Show only the newest N rows (the overview teaser). */
  limit?: number;
  /** Restrict to one movement kind (the payments page chips);
      "security" covers freeze + thaw together. */
  kind?: HistoryKind | "security" | null;
  /** Editable per-row memos (payments page only). */
  withMemo?: boolean;
  /** "See all" link target — rendered when rows were cut by limit. */
  onSeeAll?: () => void;
}

/** Recent activity as a banking statement: named parties, human
    descriptions, quiet receipt links. */
export function VaultHistory({ view, vaultLabel, query, limit, kind = null, withMemo, onSeeAll }: Props) {
  const { t } = useI18n();
  const [, bump] = useState(0);

  const describe = (item: HistoryItem): { title: string; sub: string; badge: string; color: string } => {
    switch (item.kind) {
      case "spend": {
        const name = contactName(item.counterparty);
        return {
          title: name ?? short(item.counterparty ?? "0x", 6, 4),
          sub: t("b_h_payment_sub"),
          badge: initials(name, item.counterparty ?? "0x00"),
          color: colorFor(item.counterparty ?? "0x00"),
        };
      }
      case "deposit":
        return { title: t("b_h_deposit"), sub: t("b_h_deposit_sub"), badge: "⇧", color: "#1d7a4f" };
      case "withdraw":
        return { title: t("b_h_withdraw"), sub: t("b_h_withdraw_sub"), badge: "⇩", color: "#4c463d" };
      case "freeze":
        return { title: t("b_h_freeze"), sub: t("b_h_by_owner"), badge: "■", color: "#8b0d1a" };
      case "thaw":
        return { title: t("b_h_thaw"), sub: t("b_h_by_owner"), badge: "▶", color: "#1d7a4f" };
    }
  };

  const q = query.trim().toLowerCase();
  const matchesKind = (k: HistoryKind) =>
    kind === null || (kind === "security" ? k === "freeze" || k === "thaw" : k === kind);
  const filtered = view.history.filter((item) => {
    if (!matchesKind(item.kind)) return false;
    if (q === "") return true;
    const d = describe(item);
    return (
      d.title.toLowerCase().includes(q) ||
      d.sub.toLowerCase().includes(q) ||
      (item.counterparty ?? "").toLowerCase().includes(q) ||
      item.txHash.toLowerCase().includes(q) ||
      (memoFor(item.txHash) ?? "").toLowerCase().includes(q)
    );
  });
  const rows = limit !== undefined ? filtered.slice(0, limit) : filtered;
  const cut = limit !== undefined && filtered.length > limit;

  return (
    <section className="btx brise" id="activity">
      <div className="btx-head">
        <h2>{t("b_activity")}</h2>
        {cut && onSeeAll && (
          <button className="bmore" onClick={onSeeAll}>
            {t("b_see_all")} →
          </button>
        )}
      </div>
      <div className="btx-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("b_th_date")}</th>
              <th>{t("b_th_desc")}</th>
              {withMemo ? <th>{t("b_th_memo")}</th> : <th>{t("b_th_account")}</th>}
              <th style={{ textAlign: "right" }}>{t("b_th_amount")}</th>
              <th>{t("b_th_status")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((item, i) => {
              const d = describe(item);
              const security = item.kind === "freeze" || item.kind === "thaw";
              return (
                <tr key={`${item.txHash}-${item.kind}-${i}`}>
                  <td className="bdate num">{utcDate(item.timestamp).replace(", 2026", "")}</td>
                  <td>
                    <div className="bwho">
                      <span className="bpfp" style={{ background: d.color }}>{d.badge}</span>
                      <span className="txt">
                        <b>{d.title}</b>
                        <span>{d.sub}</span>
                      </span>
                    </div>
                  </td>
                  {withMemo ? (
                    <td>
                      <input
                        className="bmemo"
                        defaultValue={memoFor(item.txHash) ?? ""}
                        placeholder={t("b_memo_ph")}
                        onBlur={(e) => {
                          setMemo(item.txHash, e.target.value);
                          bump((n) => n + 1);
                        }}
                      />
                    </td>
                  ) : (
                    <td className="bdate">{vaultLabel}</td>
                  )}
                  <td className={`bamt num${item.kind === "deposit" ? " plus" : ""}${item.amount === null ? " dim" : ""}`}>
                    {item.amount !== null ? `${SIGN[item.kind]}${usd(item.amount)} USDC` : "—"}
                  </td>
                  <td>
                    <span className={`bchip ${security ? "sec" : "ok"}`}>
                      {t(security ? "b_security" : "b_done")}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <a className="breceipt" href={TX + item.txHash} target="_blank" rel="noreferrer">
                      {t(security ? "b_detail" : "b_receipt")} ↗
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="bempty">{t("b_empty_history")}</div>}
    </section>
  );
}
