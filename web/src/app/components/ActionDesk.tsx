import { useState } from "react";
import { isAddress, parseUnits, type Address, type Hex } from "viem";
import { FUJI_DEPLOYMENT, TREASURER_DEPLOYMENT } from "@verglas/sdk";
import type { TreasurerData, VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { short, usd } from "../../lib/format";
import {
  sendSetOperator,
  sendSetPolicy,
  sendSpend,
  sendTreasurerAction,
  sendUsdc,
  sendWithdraw,
} from "../lib/wallet";

interface Props {
  view: VaultView;
  treasurer: TreasurerData | null;
  wallet: Address | null;
  isOwner: boolean;
  isAgent: boolean;
  busy: string | null;
  run: (label: string, send: () => Promise<Hex>) => Promise<boolean>;
}

type Desk = "pay" | "deposit" | "withdraw" | "policy" | null;

/** Inline action desk under the status strip: one tab row, one expanding
    panel. No modals — the console works like a terminal, in place. */
export function ActionDesk({ view, treasurer, wallet, isOwner, isAgent, busy, run }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Desk>(null);
  const toggle = (d: Desk) => setOpen(open === d ? null : d);

  // -------- pay --------
  const [payTo, setPayTo] = useState<string>(view.state.whitelist[0] ?? "");
  const [payAmt, setPayAmt] = useState("");
  const budgetLeft = view.state.totalBudget - view.state.totalSpent;
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

  // -------- policy (treasurer vault only) --------
  const [editing, setEditing] = useState(false);
  const [daily, setDaily] = useState("");
  const [slip, setSlip] = useState("");
  const [ref, setRef] = useState("");
  const [rotAddr, setRotAddr] = useState("");
  const openEdit = () => {
    if (!treasurer) return;
    setDaily((Number(treasurer.dailyLimit) / 1e6).toString());
    setSlip(treasurer.maxSlippageBps.toString());
    setRef((Number(treasurer.referenceRateUsdTry) / 1e8).toFixed(4));
    setEditing(true);
  };
  let parsed: { dailyLimit: bigint; maxSlippageBps: number; referenceRateUsdTry: bigint } | null = null;
  try {
    const bps = Number.parseInt(slip, 10);
    const refNum = Number.parseFloat(ref);
    if (Number.isFinite(bps) && bps >= 0 && Number.isFinite(refNum) && refNum > 0) {
      parsed = {
        dailyLimit: parseUnits(daily, 6),
        maxSlippageBps: bps,
        referenceRateUsdTry: BigInt(Math.round(refNum * 1e8)),
      };
    }
  } catch {
    parsed = null;
  }
  const savePolicy = async () => {
    if (!parsed || !isOwner || busy) return;
    const ok = await run("policy", () => sendSetPolicy(TREASURER_DEPLOYMENT.treasurer, wallet!, parsed!));
    if (ok) setEditing(false);
  };
  const rotate = async () => {
    if (!isOwner || busy || !isAddress(rotAddr)) return;
    const ok = await run("rotate", () =>
      sendSetOperator(TREASURER_DEPLOYMENT.treasurer, wallet!, rotAddr as Address),
    );
    if (ok) setRotAddr("");
  };

  return (
    <div className="desk">
      <div className="desk-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={open === "pay"}
          className={`desk-tab primary${open === "pay" ? " on" : ""}`}
          onClick={() => toggle("pay")}
        >
          {t("app_pay")}
          {budgetLeft === 0n && <span className="chip chip-frozen">{t("app_budget_out")}</span>}
        </button>
        <button
          role="tab"
          aria-selected={open === "deposit"}
          className={`desk-tab${open === "deposit" ? " on" : ""}`}
          onClick={() => toggle("deposit")}
        >
          {t("app_deposit")} ⇧
        </button>
        <button
          role="tab"
          aria-selected={open === "withdraw"}
          className={`desk-tab${open === "withdraw" ? " on" : ""}`}
          onClick={() => toggle("withdraw")}
        >
          {t("app_withdraw")} ⇩
        </button>
        {treasurer && (
          <button
            role="tab"
            aria-selected={open === "policy"}
            className={`desk-tab${open === "policy" ? " on" : ""}`}
            onClick={() => toggle("policy")}
          >
            {t("app_policy")}
            {treasurer.paused && <span className="chip chip-frozen">{t("app_paused")}</span>}
          </button>
        )}
      </div>

      {open === "pay" && (
        <div className="desk-panel glass">
          <div className="policy-form mono desk-grid">
            <label>
              {t("app_pay_to")}
              <select value={payTo} onChange={(e) => setPayTo(e.target.value)}>
                {view.state.whitelist.map((w) => (
                  <option key={w} value={w}>
                    {short(w, 8, 6)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("w_amount")} (≤ {usd(view.state.perTxLimit)} · {t("app_budget_left")} {usd(budgetLeft)})
              <input value={payAmt} onChange={(e) => setPayAmt(e.target.value)} inputMode="decimal" />
            </label>
            <button
              className="btn-primary"
              disabled={!isAgent || busy !== null || payParsed === null}
              onClick={pay}
            >
              {busy === "spend" ? t("app_pending") : t("app_pay")}
            </button>
          </div>
          {!isAgent && <p className="rail-hint">{t("app_pay_hint")}</p>}
        </div>
      )}

      {open === "deposit" && (
        <div className="desk-panel glass">
          <div className="policy-form mono desk-grid">
            <label>
              {t("w_amount")}
              <input value={depAmt} onChange={(e) => setDepAmt(e.target.value)} inputMode="decimal" />
            </label>
            <button
              className="btn-primary"
              disabled={!wallet || busy !== null || depParsed === null}
              onClick={deposit}
            >
              {busy === "deposit" ? t("app_pending") : t("app_deposit")}
            </button>
          </div>
        </div>
      )}

      {open === "withdraw" && (
        <div className="desk-panel glass">
          <div className="policy-form mono desk-grid">
            <label>
              {t("w_amount")}
              <input value={wdAmt} onChange={(e) => setWdAmt(e.target.value)} inputMode="decimal" />
            </label>
            <label>
              {t("app_withdraw_to")}
              <input
                value={wdTo}
                onChange={(e) => setWdTo(e.target.value)}
                placeholder={short(view.state.owner)}
                spellCheck={false}
              />
            </label>
            <button className="btn-primary" disabled={!isOwner || busy !== null || !wdValid} onClick={withdraw}>
              {busy === "withdraw" ? t("app_pending") : t("app_withdraw")}
            </button>
          </div>
          {wdIsTokenContract && <span className="wiz-err">{t("app_bad_dest")}</span>}
        </div>
      )}

      {open === "policy" && treasurer && (
        <div className="desk-panel glass">
          {!editing ? (
            <>
              <dl className="policy-list mono desk-policy">
                <div>
                  <dt>{t("app_policy_daily")}</dt>
                  <dd>{usd(treasurer.dailyLimit)} USDC</dd>
                </div>
                <div>
                  <dt>{t("app_policy_slip")}</dt>
                  <dd>{treasurer.maxSlippageBps} bps</dd>
                </div>
                <div>
                  <dt>{t("app_policy_ref")}</dt>
                  <dd>{(Number(treasurer.referenceRateUsdTry) / 1e8).toFixed(4)}</dd>
                </div>
                <div>
                  <dt>{t("app_keeper")}</dt>
                  <dd>{short(treasurer.operator)}</dd>
                </div>
              </dl>
              <div className="rail-actions">
                <button className="btn-ghost" disabled={!isOwner || busy !== null} onClick={openEdit}>
                  {t("app_edit")}
                </button>
                <button
                  className="btn-ghost"
                  disabled={!isOwner || busy !== null}
                  onClick={() =>
                    run(treasurer.paused ? "unpause" : "pause", () =>
                      sendTreasurerAction(
                        TREASURER_DEPLOYMENT.treasurer,
                        wallet!,
                        treasurer.paused ? "unpause" : "pause",
                      ),
                    )
                  }
                >
                  {busy === "pause" || busy === "unpause"
                    ? t("app_pending")
                    : t(treasurer.paused ? "app_unpause" : "app_pause")}
                </button>
              </div>
              <div className="policy-form mono desk-grid">
                <label>
                  {t("app_rotate_new")}
                  <input value={rotAddr} onChange={(e) => setRotAddr(e.target.value)} spellCheck={false} />
                </label>
                <button
                  className="btn-ghost"
                  disabled={!isOwner || !isAddress(rotAddr) || busy !== null}
                  onClick={rotate}
                >
                  {busy === "rotate" ? t("app_pending") : t("app_rotate")}
                </button>
              </div>
            </>
          ) : (
            <div className="policy-form mono desk-grid">
              <label>
                {t("app_policy_daily")}
                <input value={daily} onChange={(e) => setDaily(e.target.value)} inputMode="decimal" />
              </label>
              <label>
                {t("app_policy_slip")}
                <input value={slip} onChange={(e) => setSlip(e.target.value)} inputMode="numeric" />
              </label>
              <label>
                {t("app_policy_ref")}
                <input value={ref} onChange={(e) => setRef(e.target.value)} inputMode="decimal" />
              </label>
              <button className="btn-primary" disabled={!parsed || busy !== null} onClick={savePolicy}>
                {busy === "policy" ? t("app_pending") : t("app_save")}
              </button>
              <button className="btn-ghost" onClick={() => setEditing(false)}>
                {t("app_cancel")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
