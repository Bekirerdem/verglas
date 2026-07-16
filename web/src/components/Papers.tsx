import { FUJI_DEPLOYMENT } from "@verglas/sdk";
import type { DashboardData } from "../lib/data";
import { short, usd, utcDate } from "../lib/format";
import { useI18n, type TKey } from "../lib/i18n";

const STEPS = ["step1", "step2", "step3", "step4"] as const;

/** S3 — THE PAPERS: numbered press line + the living document (real data). */
export function Papers({ data }: { data: DashboardData }) {
  const { t } = useI18n();
  const { account, attestation, balance } = data;
  const spentPct = account.totalBudget === 0n ? 0 : Number((account.totalSpent * 100n) / account.totalBudget);

  return (
    <section className="papers">
      <div>
        <p className="lede">
          {t("papers_lede")} <i>{t("papers_lede_tag")}</i>
        </p>
        <h3 className="will-reveal">
          {t("papers_h_1")} <em>{t("papers_h_2")}</em>
        </h3>

        {STEPS.map((s) => (
          <div className="step will-reveal" key={s}>
            <div className="num">{t(`${s}_num` as TKey)}</div>
            <div>
              <h4>{t(`${s}_t` as TKey)}</h4>
              <p className="stag">{t(`${s}_tag` as TKey)}</p>
              <p>{t(`${s}_p` as TKey)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="doc-col">
        <div className="document will-reveal">
          <div className="doc-stamp" aria-hidden="true" data-ice-glow>
            <span className="score">{attestation ? attestation.score : "—"}</span>
            <span className="of">SCORE</span>
          </div>
          <p className="dlabel">{t("doc_label")}</p>
          <p className="dtitle">
            {t("doc_agent")} #{FUJI_DEPLOYMENT.agentId.toString()}
          </p>
          <div className="drow">
            <span>{t("doc_window")}</span>
            <span className="v">
              {attestation ? `${attestation.txCount.toString()} ${t("doc_spends")}` : t("doc_window_open")}
            </span>
          </div>
          <div className="drow">
            <span>{t("doc_request")}</span>
            <span className="v">{attestation ? short(attestation.requestHash, 12, 8) : "—"}</span>
          </div>
          <div className="drow">
            <span>{t("doc_issued")}</span>
            <span className="v">{attestation ? utcDate(attestation.issuedAt) : "—"}</span>
          </div>
          <div className="drow">
            <span>{t("doc_verifier")}</span>
            <span className="v">{t("doc_verifier_v")}</span>
          </div>
        </div>

        <div className="vault-strip will-reveal">
          <div className="vhead">
            <span>
              {t("vault_label")} · {short(FUJI_DEPLOYMENT.account)}
            </span>
            <span className={`state${account.frozen ? " frozen" : ""}`}>
              {account.frozen ? t("vault_frozen") : t("vault_active")}
            </span>
          </div>
          <div className="vbar">
            <i style={{ width: `${spentPct}%` }} />
          </div>
          <div className="vnums">
            <span>
              {t("vault_spent")} <b>{usd(account.totalSpent)}</b> / {usd(account.totalBudget)}
            </span>
            <span>
              {t("vault_balance")} <b>{usd(balance)} USDC</b>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
