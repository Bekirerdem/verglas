import type { TreasurerData, VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { short, usd, utcDate } from "../../lib/format";

const TX = "https://testnet.snowtrace.io/tx/";

export function ReceiptShelf({ view, treasurer }: { view: VaultView; treasurer: TreasurerData | null }) {
  const { t } = useI18n();

  // payFX emits both Spend (vault) and FxPayment (treasurer) in one tx —
  // merge by hash so a payment shows once, with its rate when it has one.
  const fxByTx = new Map((treasurer?.payments ?? []).map((p) => [p.txHash, p]));
  // The shelf shows sealed stamps; a still-unanswered validation request
  // carries score 0 and is represented by the "window open" copy instead.
  const stamps = view.stamps.filter((s) => s.score > 0);

  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2>{t("app_shelf")}</h2>
        <p className="serif">{t("app_shelf_sub")}</p>
      </div>
      <div className="shelf-rail">
        {stamps.map((stamp, i) => (
          <article className="stamp-seal rise" style={{ animationDelay: `${0.1 + i * 0.06}s` }} key={stamp.requestHash}>
            <span className="stamp-vg">VG</span>
            <span className="stamp-score">
              {t("app_stamp_score")} {stamp.score}
            </span>
            <span className="stamp-tag mono">{stamp.tag.replace("verglas:", "")}</span>
            <span className="stamp-date mono">{utcDate(stamp.lastUpdate)}</span>
          </article>
        ))}
        {view.spends.map((spend, i) => {
          const fx = fxByTx.get(spend.txHash);
          return (
            <a
              className="receipt glass rise"
              style={{ animationDelay: `${0.15 + i * 0.05}s` }}
              key={spend.txHash + spend.txIndex.toString()}
              href={TX + spend.txHash}
              target="_blank"
              rel="noreferrer"
            >
              <span className="mono receipt-idx">#{spend.txIndex.toString()}</span>
              <span className="receipt-amt">−{usd(spend.amount)} USDC</span>
              <span className="mono receipt-to">→ {short(spend.to)}</span>
              {fx && <span className="mono receipt-rate">@ {(Number(fx.rateUsdTry) / 1e8).toFixed(4)}</span>}
              <span className="mono receipt-when">{utcDate(spend.timestamp)}</span>
            </a>
          );
        })}
        {stamps.length === 0 && view.spends.length === 0 && (
          <p className="shelf-empty serif">{t("app_shelf_empty")}</p>
        )}
      </div>
    </section>
  );
}
