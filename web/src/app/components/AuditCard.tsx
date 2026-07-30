import { useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { latestStamp, migratableIdentities, type VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { remaining, short, utcDate } from "../../lib/format";
import { useAudit } from "../lib/useAudit";
import { DEPLOYMENT, txUrl } from "../../lib/network";



interface Props {
  view: VaultView;
  wallet: Address | null;
  isOwner: boolean;
  busy: string | null;
  run: (label: string, send: () => Promise<Hex>) => Promise<boolean>;
  onRefresh: () => void;
  /** Jump to the audit page (the card is the teaser, the page is the story). */
  onOpenAudit?: () => void;
}

/** Audit card: the ZK machinery translated into auditor language —
    proof ready, verification passed, crossing cleared. The chain shows up
    as one trust line, not as the interface. */
export function AuditCard({ view, wallet, isOwner, busy, run, onRefresh, onOpenAudit }: Props) {
  const { t } = useI18n();
  const { step, actErr, activate, renew, migrate } = useAudit(view, wallet, isOwner, run, onRefresh);

  const [migratable, setMigratable] = useState<bigint[]>([]);
  useEffect(() => {
    if (view.agentId !== null || !wallet || !isOwner) {
      setMigratable([]);
      return;
    }
    let live = true;
    migratableIdentities(wallet, view.account).then(
      (ids) => {
        if (live) setMigratable(ids);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [view.agentId, view.account, wallet, isOwner]);

  if (view.agentId === null) {
    return (
      <div className="bcard brise" id="audit">
        <h3>{t("b_audit")}</h3>
        <p style={{ fontSize: 13.5, color: "var(--ink2)", marginBottom: 14 }}>{t("b_open_audit_p")}</p>
        {actErr && <div className="berr">{t("w_error")}</div>}
        {isOwner ? (
          <>
            <button className="bbtn" disabled={step !== 0} onClick={activate}>
              {step === 0 ? t("b_open_audit") : `${step}/3 · ${t("b_pending")}`}
            </button>
            {migratable.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <p className="bhint" style={{ marginBottom: 6 }}>
                  {t("b_migrate_p")}
                </p>
                {migratable.map((id) => (
                  <button
                    key={id.toString()}
                    className="bmore"
                    disabled={busy !== null}
                    onClick={() => void migrate(id)}
                  >
                    {busy === "migrate" ? t("b_pending") : `${t("b_migrate_do")} №${id.toString()} →`}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="bhint">{t("app_owner_needed")}</p>
        )}
      </div>
    );
  }

  const att = view.attestation;
  const lastStamp = latestStamp(view.stamps);
  const deadline = att && view.gateMaxAge > 0n ? att.issuedAt + view.gateMaxAge : null;
  const left = deadline ? remaining(deadline) : "";
  const proofTx = view.carried[0]?.txHash ?? null;

  return (
    <div className="bcard brise" id="audit">
      <h3>{t("b_audit")}</h3>
      {lastStamp ? (
        <>
          <div className="bseal-row">
            <span className="bseal">VG</span>
            <span>{t("b_audit_ready")}</span>
          </div>
          <div className="bseal-sub">
            {utcDate(lastStamp.lastUpdate)} · {t("b_audit_verified")}
          </div>
          <div className="brow">
            <span className="k">{t("b_compliance")}</span>
            <span style={{ color: "var(--pos)", fontWeight: 650 }}>%{lastStamp.score}</span>
          </div>
        </>
      ) : (
        <div className="bseal-row">
          <span className="bseal">VG</span>
          <span>{t("b_audit_none")}</span>
        </div>
      )}
      <div className="brow">
        <span className="k">{t("b_border")}</span>
        <span className={view.cleared ? "" : "k"} style={view.cleared ? { color: "var(--pos)", fontWeight: 650 } : undefined}>
          {!DEPLOYMENT.gate
            ? t("b_gate_none")
            : view.cleared
              ? `${t("b_border_ok")} · ${left} ${t("b_valid_left")}`
              : t("b_border_wait")}
        </span>
      </div>
      {proofTx && (
        <div className="bchain">
          ⛓ {t("b_proof_chain")}{" "}
          <a href={txUrl(proofTx)} target="_blank" rel="noreferrer">
            {short(proofTx)}
          </a>
        </div>
      )}
      {isOwner && (
        <button className="bmore" disabled={busy !== null} onClick={renew} title={t("b_renew_hint")}>
          {busy === "renew" ? t("b_pending") : `${t("b_renew")} →`}
        </button>
      )}
      {onOpenAudit && (
        <button className="bmore" onClick={onOpenAudit}>
          {t("b_audit_open_page")} →
        </button>
      )}
    </div>
  );
}
