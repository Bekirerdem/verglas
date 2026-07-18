import { useState } from "react";
import { concat, keccak256, parseEventLogs, toHex, type Address } from "viem";
import { identityRegistryAbi } from "@verglas/sdk";
import { hubChain, type VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { remaining, short, utcDate } from "../../lib/format";
import { sendBindAccount, sendRegisterIdentity, sendValidationRequest } from "../lib/wallet";

const TX = "https://testnet.snowtrace.io/tx/";

interface Props {
  view: VaultView;
  wallet: Address | null;
  isOwner: boolean;
  onRefresh: () => void;
}

export function PassportBand({ view, wallet, isOwner, onRefresh }: Props) {
  const { t } = useI18n();
  const att = view.attestation;
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [actErr, setActErr] = useState(false);

  const activate = async () => {
    if (!wallet || !isOwner || step !== 0) return;
    setActErr(false);
    try {
      setStep(1);
      const h1 = await sendRegisterIdentity(wallet);
      const rc = await hubChain.waitForTransactionReceipt({ hash: h1 });
      const minted = parseEventLogs({ abi: identityRegistryAbi, logs: rc.logs, eventName: "Transfer" });
      const agentId = minted[0]?.args.tokenId;
      if (agentId === undefined) throw new Error("no-agent-id");

      setStep(2);
      const h2 = await sendBindAccount(wallet, agentId, view.account);
      await hubChain.waitForTransactionReceipt({ hash: h2 });

      setStep(3);
      const rand = new Uint8Array(32);
      crypto.getRandomValues(rand);
      const requestHash = keccak256(concat([view.account, toHex(rand)]));
      const h3 = await sendValidationRequest(wallet, agentId, requestHash);
      await hubChain.waitForTransactionReceipt({ hash: h3 });
      onRefresh();
    } catch {
      setActErr(true);
    }
    setStep(0);
  };

  if (view.agentId === null) {
    return (
      <section className="passport">
        <div className="passport-route rise" style={{ animationDelay: "0.1s" }}>
          <span className="mono passport-tag">{t("app_passport")}</span>
          <p className="serif app-noid">{t("app_activate_p")}</p>
          {actErr && <span className="wiz-err">{t("w_error")}</span>}
          {isOwner ? (
            <button className="btn-primary act-btn" disabled={step !== 0} onClick={activate}>
              {step === 0
                ? t("app_activate")
                : `${step}/3 · ${t(step === 1 ? "app_act_step1" : step === 2 ? "app_act_step2" : "app_act_step3")}…`}
            </button>
          ) : (
            <p className="rail-hint">{t("app_owner_needed")}</p>
          )}
        </div>
      </section>
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
    <section className="passport">
      <div className="passport-route rise" style={{ animationDelay: "0.1s" }}>
        <span className="mono passport-tag">{t("app_passport")}</span>
        <div className="route-line">
          <span className="route-node mono">{t("app_hub_role")}</span>
          <i className={`route-track${view.cleared ? " live" : ""}`}>
            <b />
          </i>
          <span className="route-node mono">{t("app_gate_role")}</span>
        </div>
        <span className={`chip ${view.cleared ? "chip-ok" : "chip-dim"} passport-verdict`}>
          {t(view.cleared ? "app_cleared" : "app_not_cleared")} · isCleared({view.agentId.toString()})
        </span>
      </div>

      <div className={`passport-validity glass rise${expired ? " expired" : ""}`} style={{ animationDelay: "0.2s" }}>
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
          <p className="serif">{t("app_no_attestation")}</p>
        )}
      </div>
    </section>
  );
}
