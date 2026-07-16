import { FUJI_DEPLOYMENT } from "@verglas/sdk";
import type { DashboardData } from "../lib/data";
import { short, usd, utcDate } from "../lib/format";
import { useI18n } from "../lib/i18n";

/** S5 — THE LEDGER: the archive room, lusty-grade functional data. */
export function Ledger({ data }: { data: DashboardData }) {
  const { t } = useI18n();
  return (
    <section className="ledger" id="ledger">
      <p className="lhead">
        {t("ledger_lede")} <i>{t("ledger_lede_tag")}</i>
      </p>
      <h3 className="will-reveal">
        {t("ledger_h_1")} <em>{t("ledger_h_2")}</em>
      </h3>

      {data.stamps.length === 0 ? (
        <p className="empty-note">{t("ledger_empty_stamps")}</p>
      ) : (
        <div className="stamp-row">
          {data.stamps.map((s) => (
            <div className="stamp-card will-reveal" key={s.requestHash}>
              <div className="seal" aria-hidden="true" data-ice-glow>
                <span className="score">{s.score}</span>
                <span className="of">SCORE</span>
              </div>
              <div className="smeta">
                <div className="t">{t("ledger_stamp_t")}</div>
                {t("ledger_agent")} #{FUJI_DEPLOYMENT.agentId.toString()}
                {data.attestation?.requestHash === s.requestHash
                  ? ` · ${t("ledger_window_of")} ${data.attestation.txCount.toString()} ${t("ledger_spends")}`
                  : ""}
                <br />
                <span className="hash">{short(s.requestHash, 12, 8)}</span>
                {utcDate(s.lastUpdate)}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.spends.length === 0 ? (
        <p className="empty-note">{t("ledger_empty_spends")}</p>
      ) : (
        <div className="table-scroll">
          <table className="spends">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("th_to")}</th>
                <th>{t("th_amount")}</th>
                <th>{t("th_commit")}</th>
                <th>{t("th_when")}</th>
                <th>{t("th_tx")}</th>
              </tr>
            </thead>
            <tbody>
              {data.spends.map((s) => (
                <tr key={s.txHash + s.txIndex.toString()}>
                  <td>{s.txIndex.toString()}</td>
                  <td>{short(s.to, 6, 3)}</td>
                  <td className="amt">{usd(s.amount)} vUSD</td>
                  <td>
                    <span className="commit">{short(`0x${s.newCommitment.toString(16).padStart(64, "0")}`, 12, 6)}</span>
                  </td>
                  <td>{utcDate(s.timestamp)}</td>
                  <td>
                    <a href={`https://testnet.snowtrace.io/tx/${s.txHash}`} target="_blank" rel="noreferrer">
                      {short(s.txHash, 8, 4)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
