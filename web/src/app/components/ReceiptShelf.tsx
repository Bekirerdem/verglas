import type { TreasurerData, VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { short, usd, utcDate } from "../../lib/format";

const TX = "https://testnet.snowtrace.io/tx/";

/** Audit-rail proof shelf: amber ZK seals on top, payment receipts under
    them — compact rows, newest first. */
export function ReceiptShelf({ view, treasurer }: { view: VaultView; treasurer: TreasurerData | null }) {
  const { t } = useI18n();

  // payFX emits both Spend (vault) and FxPayment (treasurer) in one tx —
  // merge by hash so a payment shows once, with its rate when it has one.
  const fxByTx = new Map((treasurer?.payments ?? []).map((p) => [p.txHash, p]));
  // The shelf shows sealed stamps; a still-unanswered validation request
  // carries score 0 and is represented by the "window open" copy instead.
  const stamps = view.stamps.filter((s) => s.score > 0);

  return (
    <div className="audit-card glass">
      <span className="mono rail-tag">{t("app_seals")}</span>

      {stamps.map((stamp) => (
        <article className="seal-row" key={stamp.requestHash}>
          <span className="stamp-vg">VG</span>
          <span className="mono seal-score">
            {t("app_stamp_score")} {stamp.score}
          </span>
          <span className="mono seal-tag">{stamp.tag.replace("verglas:", "")}</span>
          <span className="mono seal-date">{utcDate(stamp.lastUpdate)}</span>
        </article>
      ))}

      {view.spends.slice(0, 6).map((spend) => {
        const fx = fxByTx.get(spend.txHash);
        return (
          <a
            className="receipt-row"
            key={spend.txHash + spend.txIndex.toString()}
            href={TX + spend.txHash}
            target="_blank"
            rel="noreferrer"
          >
            <span className="mono receipt-idx">#{spend.txIndex.toString()}</span>
            <span className="mono receipt-amt">−{usd(spend.amount)}</span>
            <span className="mono receipt-to">→ {short(spend.to, 4, 3)}</span>
            {fx ? (
              <span className="mono receipt-rate">@ {(Number(fx.rateUsdTry) / 1e8).toFixed(4)}</span>
            ) : (
              <span />
            )}
          </a>
        );
      })}

      {stamps.length === 0 && view.spends.length === 0 && (
        <p className="serif audit-p">{t("app_shelf_empty")}</p>
      )}
    </div>
  );
}
