import type { Address, Hex } from "viem";
import { latestStamp, type VaultView } from "../../lib/data";
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
}

/** Audit page: the product's signature surface, writ large. What the weekly
    proof actually proves, the passport's journey across chains (vault →
    stamp → gate), and the full shelf of ZK seals. */
export function AuditPage({ view, wallet, isOwner, busy, run, onRefresh }: Props) {
  const { t } = useI18n();
  const { step, actErr, activate, renew } = useAudit(view, wallet, isOwner, run, onRefresh);

  if (view.agentId === null) {
    return (
      <div className="bcard brise">
        <h3>{t("b_audit")}</h3>
        <p style={{ fontSize: 13.5, color: "var(--ink2)", marginBottom: 14 }}>{t("b_open_audit_p")}</p>
        {actErr && <div className="berr">{t("w_error")}</div>}
        {isOwner ? (
          <button className="bbtn" disabled={step !== 0} onClick={activate}>
            {step === 0 ? t("b_open_audit") : `${step}/3 · ${t("b_pending")}`}
          </button>
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
  const now = BigInt(Math.floor(Date.now() / 1000));
  const validPct =
    deadline && att && view.gateMaxAge > 0n && deadline > now
      ? Number(((deadline - now) * 100n) / view.gateMaxAge)
      : 0;
  const lastCarry = view.carried[0] ?? null;
  const gate = DEPLOYMENT.gate ?? null;

  const stampDone = !!lastStamp;
  const carryDone = view.cleared;

  return (
    <>
      <p className="bexplain brise">{t("b_audit_explain")}</p>

      <section className="bcard brise bpassport">
        <h3>{t("b_passport")}</h3>
        <div className="bpassport-band">
          <div className="pstop done">
            <span className="pdot">✓</span>
            <b>{t("b_pass_vault")}</b>
            <span>C-Chain</span>
            <span className="psub">{t("b_pass_vault_s")}</span>
          </div>
          <div className={`pline${stampDone ? " done" : ""}`} />
          <div className={`pstop${stampDone ? " done" : ""}`}>
            <span className="pdot">{stampDone ? "✓" : "…"}</span>
            <b>{t("b_pass_stamp")}</b>
            <span>C-Chain</span>
            <span className="psub">{stampDone ? `${t("b_compliance")} %${lastStamp.score}` : t("b_border_wait")}</span>
          </div>
          <div className={`pline${carryDone ? " done" : ""}`} />
          <div className={`pstop${carryDone ? " done" : ""}${gate ? "" : " absent"}`}>
            {/* Two different states share this stop and must not look alike:
                "no gate on this network" (mainnet — cross-chain clearance is a
                later milestone) is not the same as "carried, waiting". */}
            <span className="pdot">{carryDone ? "✓" : gate ? "…" : "—"}</span>
            <b>{t("b_pass_gate")}</b>
            <span>{gate?.chainLabel ?? t("b_gate_none_where")}</span>
            <span className="psub">
              {!gate
                ? t("b_gate_none")
                : carryDone
                  ? `${t("b_border_ok")} · ${left} ${t("b_valid_left")}`
                  : t("b_border_wait")}
            </span>
          </div>
        </div>
        {carryDone && (
          <div className="bvalid">
            <span className="k">{t("b_valid_meter")}</span>
            <div className="bmeter pass">
              <i style={{ width: `${validPct}%` }} />
            </div>
            <span className="v num">{left}</span>
          </div>
        )}
        {lastCarry && (
          <div className="bchain">
            ⛓ {t("b_carry_tx")}{" "}
            <a href={txUrl(lastCarry.txHash)} target="_blank" rel="noreferrer">
              {short(lastCarry.txHash)}
            </a>
            {" · "}
            {utcDate(lastCarry.timestamp)}
          </div>
        )}
        {isOwner && (
          <button className="bbtn ghost" disabled={busy !== null} onClick={renew} title={t("b_renew_hint")} style={{ marginTop: 12 }}>
            {busy === "renew" ? t("b_pending") : `${t("b_renew")} →`}
          </button>
        )}
      </section>

      <section className="btx brise">
        <div className="btx-head">
          <h2>{t("b_seal_shelf")}</h2>
        </div>
        {view.stamps.length === 0 ? (
          <div className="bempty">{t("b_seal_none")}</div>
        ) : (
          <div className="bshelf">
            {view.stamps.map((s) => (
              <div className="bshelf-item" key={s.requestHash}>
                <span className={`bseal${s.score > 0 ? "" : " pending"}`}>VG</span>
                <div>
                  <b>{s.score > 0 ? `${t("b_compliance")} %${s.score}` : t("b_seal_pending")}</b>
                  <span>{s.lastUpdate > 0n ? utcDate(s.lastUpdate) : "—"}</span>
                  <code>{short(s.requestHash, 10, 6)}</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
