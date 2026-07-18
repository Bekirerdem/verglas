import { useEffect, useState } from "react";
import { isAddress, parseUnits, type Address, type Hex } from "viem";
import { FUJI_DEPLOYMENT, TREASURER_DEPLOYMENT } from "@verglas/sdk";
import type { TreasurerData, VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { short, usd } from "../../lib/format";
import {
  sendClaimUsdc,
  sendSetOperator,
  sendSetPolicy,
  sendSpend,
  sendTreasurerAction,
  sendUsdc,
  sendVaultAction,
  sendWithdraw,
} from "../lib/wallet";

interface Props {
  view: VaultView;
  treasurer: TreasurerData | null;
  wallet: Address | null;
  isOwner: boolean;
  isAgent: boolean;
  busy: string | null;
  onConnect: () => void;
  run: (label: string, send: () => Promise<Hex>) => Promise<boolean>;
  onFroze: () => void;
}

export function ControlRail({ view, treasurer, wallet, isOwner, isAgent, busy, onConnect, run, onFroze }: Props) {
  const { t } = useI18n();
  const frozen = view.state.frozen;
  const [armed, setArmed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [daily, setDaily] = useState("");
  const [slip, setSlip] = useState("");
  const [ref, setRef] = useState("");
  const [rotating, setRotating] = useState(false);
  const [rotAddr, setRotAddr] = useState("");
  const [wdAmt, setWdAmt] = useState("");
  const [wdTo, setWdTo] = useState("");

  // the confirm window closes itself
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(timer);
  }, [armed]);

  const pullBrake = async () => {
    if (!isOwner || busy) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    const fn = frozen ? "unfreeze" : "freeze";
    const ok = await run(fn, () => sendVaultAction(view.account, wallet!, fn));
    if (ok && fn === "freeze") onFroze();
  };

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
    if (ok) {
      setRotating(false);
      setRotAddr("");
    }
  };

  const [payTo, setPayTo] = useState<string>(view.state.whitelist[0] ?? "");
  const [payAmt, setPayAmt] = useState("");
  let payParsed: bigint | null = null;
  try {
    const v = parseUnits(payAmt, 6);
    if (v > 0n && v <= view.state.perTxLimit) payParsed = v;
  } catch {
    payParsed = null;
  }
  const pay = async () => {
    if (!wallet || !isAgent || busy || payParsed === null || !isAddress(payTo)) return;
    const ok = await run("spend", () => sendSpend(view.account, wallet, payTo as Address, payParsed!));
    if (ok) setPayAmt("");
  };

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
    <aside className="rail rise" style={{ animationDelay: "0.18s" }}>
      <div className="rail-card glass">
        {wallet ? (
          <>
            <div className="rail-row">
              <span className="mono wallet-addr">{short(wallet)}</span>
              <span className={`chip ${isOwner ? "chip-amber" : "chip-dim"}`}>
                {t(isOwner ? "app_owner" : "app_viewer")}
              </span>
            </div>
            <div className="rail-actions">
              <a className="btn-ghost" href="https://faucet.circle.com/" target="_blank" rel="noreferrer">
                {t("app_circle")}
              </a>
              <a
                className="btn-ghost"
                href="https://core.app/tools/testnet-faucet/"
                target="_blank"
                rel="noreferrer"
              >
                {t("app_gas")}
              </a>
              <button
                className="btn-ghost"
                disabled={busy !== null}
                onClick={() => run("claim", () => sendClaimUsdc(wallet))}
              >
                {busy === "claim" ? t("app_pending") : t("app_claim")}
              </button>
            </div>
            <p className="rail-hint">{t("app_claim_hint")}</p>
          </>
        ) : (
          <button className="btn-connect" onClick={onConnect}>
            {t("app_connect")}
          </button>
        )}
      </div>

      <div className="rail-card glass brake-card">
        <span className="mono rail-tag">{t("app_brake")}</span>
        <button
          className={`lever${frozen ? " lever-frozen" : ""}${armed ? " lever-armed" : ""}`}
          disabled={!isOwner || busy !== null}
          onClick={pullBrake}
        >
          <i className="lever-track">
            <b className="lever-knob" />
          </i>
          <span>
            {busy === "freeze" || busy === "unfreeze"
              ? t("app_pending")
              : armed
                ? t("app_confirm")
                : t(frozen ? "app_unfreeze" : "app_freeze")}
          </span>
        </button>
        <p className="rail-hint">{t(isOwner ? "app_brake_hint_owner" : "app_brake_hint_viewer")}</p>
      </div>

      {treasurer && (
        <div className="rail-card glass">
          <div className="rail-row">
            <span className="mono rail-tag">{t("app_policy")}</span>
            {treasurer.paused && <span className="chip chip-frozen">{t("app_paused")}</span>}
          </div>

          {!editing ? (
            <>
              <dl className="policy-list mono">
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
              {rotating ? (
                <div className="policy-form mono">
                  <label>
                    {t("app_rotate_new")}
                    <input value={rotAddr} onChange={(e) => setRotAddr(e.target.value)} spellCheck={false} />
                  </label>
                  <div className="rail-actions">
                    <button
                      className="btn-primary"
                      disabled={!isAddress(rotAddr) || busy !== null}
                      onClick={rotate}
                    >
                      {busy === "rotate" ? t("app_pending") : t("app_rotate")}
                    </button>
                    <button className="btn-ghost" onClick={() => setRotating(false)}>
                      {t("app_cancel")}
                    </button>
                  </div>
                </div>
              ) : (
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
                  <button
                    className="btn-ghost"
                    disabled={!isOwner || busy !== null}
                    onClick={() => setRotating(true)}
                  >
                    {t("app_rotate")}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="policy-form mono">
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
              <div className="rail-actions">
                <button className="btn-primary" disabled={!parsed || busy !== null} onClick={savePolicy}>
                  {busy === "policy" ? t("app_pending") : t("app_save")}
                </button>
                <button className="btn-ghost" onClick={() => setEditing(false)}>
                  {t("app_cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rail-card glass">
        <div className="rail-row">
          <span className="mono rail-tag">{t("app_pay")}</span>
          {isAgent && <span className="chip chip-ok">{t("app_role_agent")}</span>}
        </div>
        <div className="policy-form mono">
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
            {t("w_amount")} (≤ {usd(view.state.perTxLimit)})
            <input value={payAmt} onChange={(e) => setPayAmt(e.target.value)} inputMode="decimal" />
          </label>
          <div className="rail-actions">
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
      </div>

      <div className="rail-card glass">
        <span className="mono rail-tag">{t("app_deposit")} ⇧</span>
        <div className="policy-form mono">
          <label>
            {t("w_amount")}
            <input value={depAmt} onChange={(e) => setDepAmt(e.target.value)} inputMode="decimal" />
          </label>
          <div className="rail-actions">
            <button
              className="btn-ghost"
              disabled={!wallet || busy !== null || depParsed === null}
              onClick={deposit}
            >
              {busy === "deposit" ? t("app_pending") : t("app_deposit")}
            </button>
          </div>
        </div>
      </div>

      <div className="rail-card glass">
        <span className="mono rail-tag">{t("app_withdraw")} ⇩</span>
        <div className="policy-form mono">
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
          {wdIsTokenContract && <span className="wiz-err">{t("app_bad_dest")}</span>}
          <div className="rail-actions">
            <button className="btn-ghost" disabled={!isOwner || busy !== null || !wdValid} onClick={withdraw}>
              {busy === "withdraw" ? t("app_pending") : t("app_withdraw")}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
