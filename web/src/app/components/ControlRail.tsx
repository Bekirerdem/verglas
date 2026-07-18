import { useEffect, useState } from "react";
import { parseUnits, type Address, type Hex } from "viem";
import { TREASURER_DEPLOYMENT } from "@verglas/sdk";
import type { TreasurerData, VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { short, usd } from "../../lib/format";
import { sendSetPolicy, sendTreasurerAction, sendVaultAction } from "../lib/wallet";

interface Props {
  view: VaultView;
  treasurer: TreasurerData | null;
  wallet: Address | null;
  isOwner: boolean;
  busy: string | null;
  onConnect: () => void;
  run: (label: string, send: () => Promise<Hex>) => Promise<boolean>;
  onFroze: () => void;
}

export function ControlRail({ view, treasurer, wallet, isOwner, busy, onConnect, run, onFroze }: Props) {
  const { t } = useI18n();
  const frozen = view.state.frozen;
  const [armed, setArmed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [daily, setDaily] = useState("");
  const [slip, setSlip] = useState("");
  const [ref, setRef] = useState("");

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

  return (
    <aside className="rail rise" style={{ animationDelay: "0.18s" }}>
      <div className="rail-card glass wallet-card">
        {wallet ? (
          <>
            <span className="mono wallet-addr">{short(wallet)}</span>
            <span className={`chip ${isOwner ? "chip-amber" : "chip-dim"}`}>
              {t(isOwner ? "app_owner" : "app_viewer")}
            </span>
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

      <div className="rail-card glass round2">
        <span className="chip chip-dim">{t("app_round2")}</span>
        <div className="rail-actions">
          <button className="btn-ghost" disabled title={t("app_round2")}>
            {t("app_withdraw")} ⇩
          </button>
          <button className="btn-ghost" disabled title={t("app_round2")}>
            {t("app_rotate")}
          </button>
        </div>
      </div>
    </aside>
  );
}
