import { useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import type { TreasurerData, VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { usd } from "../../lib/format";
import { sendVaultAction } from "../lib/wallet";

interface Props {
  view: VaultView;
  treasurer: TreasurerData | null;
  wallet: Address | null;
  isOwner: boolean;
  busy: string | null;
  run: (label: string, send: () => Promise<Hex>) => Promise<boolean>;
  onFroze: () => void;
}

/** Assurance card: the rules at a glance, and the stop button — an
    insurance switch, not a panic lever. */
export function GuvenceCard({ view, treasurer, wallet, isOwner, busy, run, onFroze }: Props) {
  const { t } = useI18n();
  const s = view.state;
  const frozen = s.frozen;
  const [armed, setArmed] = useState(false);

  // the confirm window closes itself
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(timer);
  }, [armed]);

  const stop = async () => {
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

  const budgetPct = s.totalBudget > 0n ? Number((s.totalSpent * 1000n) / s.totalBudget) / 10 : 0;
  const stopLabel =
    busy === "freeze" || busy === "unfreeze"
      ? t("b_pending")
      : armed
        ? t("b_stop_confirm")
        : frozen
          ? t("b_resume")
          : t("b_stop");

  return (
    <div className="bcard brise">
      <h3>{t("b_assurance")}</h3>
      <div className="brow">
        <span>
          <span className={`okdot${frozen ? " baddot" : ""}`} />
          <b style={{ fontWeight: 600 }}>{t(frozen ? "b_paused_line" : "b_rules_on")}</b>
        </span>
      </div>
      <div className="brow">
        <span className="k">{t("b_pertx")}</span>
        <span className="v num">{usd(s.perTxLimit)} USDC</span>
      </div>
      <div className="brow">
        <span className="k">{t("b_budget_used")}</span>
        <span className="v num">
          {usd(s.totalSpent)} / {usd(s.totalBudget)}
        </span>
      </div>
      <div className="bmeter">
        <i style={{ width: `${budgetPct}%` }} />
      </div>
      {treasurer && (
        <div className="brow">
          <span className="k">{t("b_daily")}</span>
          <span className="v num">
            {usd(treasurer.spentToday)} / {usd(treasurer.dailyLimit)}
          </span>
        </div>
      )}
      <div className="brow">
        <span className="k">{t("b_wl_only")}</span>
        <span style={{ color: "var(--pos)", fontWeight: 650 }}>✓ {s.whitelist.length}</span>
      </div>
      <button
        className={`stopbtn${armed ? " armed" : ""}${frozen ? " frozen" : ""}`}
        disabled={!isOwner || busy !== null}
        onClick={stop}
      >
        {frozen ? "▶" : "■"} &nbsp;{stopLabel}
      </button>
    </div>
  );
}
