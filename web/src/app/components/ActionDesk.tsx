import { useState } from "react";
import { isAddress, parseUnits, type Address, type Hex } from "viem";
import { FUJI_DEPLOYMENT } from "@verglas/sdk";
import type { VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { short, usd } from "../../lib/format";
import { contactName } from "../lib/contacts";
import { sendSpend, sendUsdc, sendWithdraw } from "../lib/wallet";

export type Desk = "pay" | "deposit" | "withdraw" | null;

interface Props {
  view: VaultView;
  wallet: Address | null;
  isOwner: boolean;
  isAgent: boolean;
  busy: string | null;
  open: Desk;
  onToggle: (d: Desk) => void;
  run: (label: string, send: () => Promise<Hex>) => Promise<boolean>;
}

/** Action pills + one inline panel. Everything happens in place, in plain
    language; the wallet appears only at signature time. */
export function ActionDesk({ view, wallet, isOwner, isAgent, busy, open, onToggle, run }: Props) {
  const { t } = useI18n();
  const budgetLeft = view.state.totalBudget - view.state.totalSpent;

  // -------- pay --------
  const [payTo, setPayTo] = useState<string>(view.state.whitelist[0] ?? "");
  const [payAmt, setPayAmt] = useState("");
  let payParsed: bigint | null = null;
  try {
    const v = parseUnits(payAmt, 6);
    if (v > 0n && v <= view.state.perTxLimit && v <= budgetLeft) payParsed = v;
  } catch {
    payParsed = null;
  }
  const pay = async () => {
    if (!wallet || !isAgent || busy || payParsed === null || !isAddress(payTo)) return;
    const ok = await run("spend", () => sendSpend(view.account, wallet, payTo as Address, payParsed!));
    if (ok) setPayAmt("");
  };

  // -------- deposit --------
  const [depAmt, setDepAmt] = useState("");
  let depParsed: bigint | null = null;
  try {
    const v = parseUnits(depAmt, 6);
    if (v > 0n) depParsed = v;
  } catch {
    depParsed = null;
  }
  const deposit = async () => {
    if (!wallet || busy || depParsed === null) return;
    const ok = await run("deposit", () => sendUsdc(wallet, view.account, depParsed!));
    if (ok) setDepAmt("");
  };

  // -------- withdraw --------
  const [wdAmt, setWdAmt] = useState("");
  const [wdTo, setWdTo] = useState("");
  let wdParsed: bigint | null = null;
  try {
    const v = parseUnits(wdAmt, 6);
    if (v > 0n) wdParsed = v;
  } catch {
    wdParsed = null;
  }
  const wdDest = wdTo.trim() === "" ? view.state.owner : wdTo.trim();
  // Guard against the classic loss: pasting the token CONTRACT address
  // (what MetaMask shows on the token page) instead of your own account.
  const wdIsTokenContract = wdDest.toLowerCase() === FUJI_DEPLOYMENT.usdc.toLowerCase();
  const wdValid = wdParsed !== null && isAddress(wdDest) && !wdIsTokenContract;
  const withdraw = async () => {
    if (!isOwner || busy || !wdValid) return;
    const ok = await run("withdraw", () =>
      sendWithdraw(view.account, wallet!, wdDest as Address, wdParsed!),
    );
    if (ok) setWdAmt("");
  };

  return (
    <>
      <div className="bpills">
        <button
          className={`bpill primary${open === "pay" ? " on" : ""}`}
          onClick={() => onToggle("pay")}
        >
          ↗ &nbsp;{t("b_pay")}
        </button>
        <button className={`bpill${open === "deposit" ? " on" : ""}`} onClick={() => onToggle("deposit")}>
          ⇧ &nbsp;{t("b_load")}
        </button>
        <button className={`bpill${open === "withdraw" ? " on" : ""}`} onClick={() => onToggle("withdraw")}>
          ⇩ &nbsp;{t("b_withdraw")}
        </button>
      </div>

      {open === "pay" && (
        <div className="bpanel brise">
          <h4>
            {t("b_pay")}{" "}
            {budgetLeft === 0n && <span className="bchip sec">{t("app_budget_out")}</span>}
          </h4>
          <div className="bform">
            <label>
              {t("b_to")} {t("b_to_wl")}
              <select value={payTo} onChange={(e) => setPayTo(e.target.value)}>
                {view.state.whitelist.map((w) => (
                  <option key={w} value={w}>
                    {contactName(w) ?? short(w, 8, 6)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("b_amount")} · ≤ {usd(view.state.perTxLimit)} · {t("app_budget_left")} {usd(budgetLeft)}
              <input value={payAmt} onChange={(e) => setPayAmt(e.target.value)} inputMode="decimal" />
            </label>
            <button className="bbtn" disabled={!isAgent || busy !== null || payParsed === null} onClick={pay}>
              {busy === "spend" ? t("b_pending") : t("b_send")}
            </button>
          </div>
          {!isAgent && <p className="bhint">{t("b_agent_only")}</p>}
        </div>
      )}

      {open === "deposit" && (
        <div className="bpanel brise">
          <h4>{t("b_load")}</h4>
          <div className="bform">
            <label>
              {t("b_amount")}
              <input value={depAmt} onChange={(e) => setDepAmt(e.target.value)} inputMode="decimal" />
            </label>
            <button className="bbtn" disabled={!wallet || busy !== null || depParsed === null} onClick={deposit}>
              {busy === "deposit" ? t("b_pending") : t("b_send")}
            </button>
          </div>
        </div>
      )}

      {open === "withdraw" && (
        <div className="bpanel brise">
          <h4>{t("b_withdraw")}</h4>
          <div className="bform">
            <label>
              {t("b_amount")}
              <input value={wdAmt} onChange={(e) => setWdAmt(e.target.value)} inputMode="decimal" />
            </label>
            <label>
              {t("b_wd_to")}
              <input
                value={wdTo}
                onChange={(e) => setWdTo(e.target.value)}
                placeholder={short(view.state.owner)}
                spellCheck={false}
              />
            </label>
            <button className="bbtn" disabled={!isOwner || busy !== null || !wdValid} onClick={withdraw}>
              {busy === "withdraw" ? t("b_pending") : t("b_send")}
            </button>
          </div>
          {wdIsTokenContract && <div className="berr">{t("app_bad_dest")}</div>}
        </div>
      )}
    </>
  );
}
