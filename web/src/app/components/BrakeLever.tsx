import { useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import type { VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { sendVaultAction } from "../lib/wallet";

interface Props {
  view: VaultView;
  wallet: Address | null;
  isOwner: boolean;
  busy: string | null;
  run: (label: string, send: () => Promise<Hex>) => Promise<boolean>;
  onFroze: () => void;
}

/** The emergency brake, always within reach at the bottom of the side rail. */
export function BrakeLever({ view, wallet, isOwner, busy, run, onFroze }: Props) {
  const { t } = useI18n();
  const frozen = view.state.frozen;
  const [armed, setArmed] = useState(false);

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

  return (
    <div className="cside-brake">
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
    </div>
  );
}
