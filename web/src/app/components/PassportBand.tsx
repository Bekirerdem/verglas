import { useState } from "react";
import { concat, keccak256, toHex, type Address, type Hex } from "viem";
import type { VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { remaining, short, utcDate } from "../../lib/format";
import { activateStampLine } from "../lib/activate";
import { sendValidationRequest } from "../lib/wallet";

const TX = "https://testnet.snowtrace.io/tx/";

interface Props {
  view: VaultView;
  wallet: Address | null;
  isOwner: boolean;
  busy: string | null;
  run: (label: string, send: () => Promise<Hex>) => Promise<boolean>;
  onRefresh: () => void;
}

/** Compact passport module for the audit rail: crossing state, validity
    melt bar, and the one-signature window renewal. */
export function PassportBand({ view, wallet, isOwner, busy, run, onRefresh }: Props) {
  const { t } = useI18n();
  const att = view.attestation;
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [actErr, setActErr] = useState(false);

  const activate = async () => {
    if (!wallet || !isOwner || step !== 0) return;
    setActErr(false);
    try {
      await activateStampLine(wallet, view.account, setStep);
      onRefresh();
    } catch {
      setActErr(true);
    }
    setStep(0);
  };

  const renew = () => {
    if (!wallet || !isOwner || view.agentId === null) return;
    const rand = new Uint8Array(32);
    crypto.getRandomValues(rand);
    const requestHash = keccak256(concat([view.account, toHex(rand)]));
    void run("renew", () => sendValidationRequest(wallet, view.agentId!, requestHash)).then((ok) => {
      if (ok) onRefresh();
    });
  };

  if (view.agentId === null) {
    return (
      <div className="audit-card glass">
        <span className="mono rail-tag">{t("app_passport")}</span>
        <p className="serif audit-p">{t("app_activate_p")}</p>
        {actErr && <span className="wiz-err">{t("w_error")}</span>}
        {isOwner ? (
          <button className="btn-primary" disabled={step !== 0} onClick={activate}>
            {step === 0
              ? t("app_activate")
              : `${step}/3 · ${t(step === 1 ? "app_act_step1" : step === 2 ? "app_act_step2" : "app_act_step3")}…`}
          </button>
        ) : (
          <p className="rail-hint">{t("app_owner_needed")}</p>
        )}
      </div>
    );
  }

  const deadline = att && view.gateMaxAge > 0n ? att.issuedAt + view.gateMaxAge : null;
  const left = deadline ? remaining(deadline) : "";
  const expired = deadline !== null && left === "";
  const meltPct =
    deadline && !expired && view.gateMaxAge > 0n
      ? Math.max(
          0,
          Math.min(
            100,
            ((Number(deadline) - Math.floor(Date.now() / 1000)) / Number(view.gateMaxAge)) * 100,
          ),
        )
      : 0;
  const lastCarry = view.carried[0];

  return (
    <div className={`audit-card glass${expired ? " expired" : ""}`}>
      <div className="rail-row">
        <span className="mono rail-tag">{t("app_passport")}</span>
        <span className={`chip ${view.cleared ? "chip-ok" : "chip-dim"}`}>
          {t(view.cleared ? "app_cleared" : "app_not_cleared")}
        </span>
      </div>

      <div className="route-line">
        <span className="route-node mono">{t("app_hub_role")}</span>
        <i className={`route-track${view.cleared ? " live" : ""}`}>
          <b />
        </i>
        <span className="route-node mono">{t("app_gate_role")}</span>
      </div>
      <span className="mono strip-sub">isCleared({view.agentId.toString()})</span>

      {att ? (
        <>
          <div className="bar-line mono">
            <span>{t("app_valid_for")}</span>
            <span>{expired ? t("app_expired") : left}</span>
          </div>
          <div className="melt-bar">
            <i style={{ width: `${meltPct}%` }} />
          </div>
          <dl className="policy-list mono">
            <div>
              <dt>{t("doc_issued")}</dt>
              <dd>{utcDate(att.issuedAt)}</dd>
            </div>
            <div>
              <dt>{t("app_stamp_score")}</dt>
              <dd>{att.score}</dd>
            </div>
            {lastCarry && (
              <div>
                <dt>{t("app_carry")}</dt>
                <dd>
                  <a href={TX + lastCarry.txHash} target="_blank" rel="noreferrer">
                    {short(lastCarry.txHash)} ↗
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </>
      ) : (
        <p className="serif audit-p">{t("app_no_attestation")}</p>
      )}

      {isOwner && (
        <>
          <button className="btn-ghost" disabled={busy !== null} onClick={renew}>
            {busy === "renew" ? t("app_pending") : t("app_renew")}
          </button>
          <p className="rail-hint">{t("app_renew_hint")}</p>
        </>
      )}
    </div>
  );
}
