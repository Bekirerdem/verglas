import { useState } from "react";
import { isAddress, parseUnits, type Address, type Hex } from "viem";
import { TREASURER_DEPLOYMENT } from "@verglas/sdk";
import type { TreasurerData, VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { short, usd } from "../../lib/format";
import { contactName, initials } from "../lib/contacts";
import { sendSetOperator, sendSetPolicy, sendTreasurerAction } from "../lib/wallet";
import { GuvenceCard } from "./GuvenceCard";

const COLORS = ["#4c3b2a", "#2a3a4c", "#3c2a4c", "#2a4c3b", "#4c463d", "#5c2a2a"];
const colorFor = (addr: string) => COLORS[parseInt(addr.slice(-2), 16) % COLORS.length];

interface Props {
  view: VaultView;
  treasurer: TreasurerData | null;
  wallet: Address | null;
  isOwner: boolean;
  busy: string | null;
  run: (label: string, send: () => Promise<Hex>) => Promise<boolean>;
  onFroze: () => void;
  onNewVault: () => void;
}

/** Rules page: the vault's constitution in plain language. Base rules are
    immutable by design — the page says so and points to the wizard; the
    Treasurer's policy layer (daily limit, FX breaker) stays editable. */
export function RulesPage({ view, treasurer, wallet, isOwner, busy, run, onFroze, onNewVault }: Props) {
  const { t } = useI18n();

  // -------- treasurer policy form (moved from the old rules desk) --------
  const [editing, setEditing] = useState(false);
  const [daily, setDaily] = useState("");
  const [slip, setSlip] = useState("");
  const [ref, setRef] = useState("");
  const [rotAddr, setRotAddr] = useState("");
  const openEdit = () => {
    if (!treasurer) return;
    setDaily((Number(treasurer.dailyLimit) / 1e6).toString());
    setSlip(treasurer.maxSlippageBps.toString());
    setRef((Number(treasurer.referenceRateUsdTry) / 1e8).toFixed(4));
    setEditing(true);
  };
  let parsed: { dailyLimit: bigint; maxSlippageBps: number; referenceRateUsdTry: bigint } | null = null;
  try {
    const bps = Number.parseInt(slip, 10);
    const refNum = Number.parseFloat(ref);
    if (Number.isFinite(bps) && bps >= 0 && Number.isFinite(refNum) && refNum > 0) {
      parsed = {
        dailyLimit: parseUnits(daily, 6),
        maxSlippageBps: bps,
        referenceRateUsdTry: BigInt(Math.round(refNum * 1e8)),
      };
    }
  } catch {
    parsed = null;
  }
  const savePolicy = async () => {
    if (!parsed || !isOwner || busy) return;
    const ok = await run("policy", () => sendSetPolicy(TREASURER_DEPLOYMENT.treasurer, wallet!, parsed!));
    if (ok) setEditing(false);
  };
  const rotate = async () => {
    if (!isOwner || busy || !isAddress(rotAddr)) return;
    const ok = await run("rotate", () =>
      sendSetOperator(TREASURER_DEPLOYMENT.treasurer, wallet!, rotAddr as Address),
    );
    if (ok) setRotAddr("");
  };

  return (
    <>
      <div className="bgrid">
        <GuvenceCard
          view={view}
          treasurer={treasurer}
          wallet={wallet}
          isOwner={isOwner}
          busy={busy}
          run={run}
          onFroze={onFroze}
        />

        <div className="bcard brise">
          <h3>{t("b_rules_wl")}</h3>
          <p className="bhint" style={{ marginTop: 0 }}>{t("b_rules_wl_p")}</p>
          {view.state.whitelist.map((w) => {
            const name = contactName(w);
            return (
              <div className="bcontact slim" key={w}>
                <span className="bpfp" style={{ background: colorFor(w) }}>{initials(name, w)}</span>
                <div>
                  <span className="addr">{name ?? short(w, 8, 6)}</span>
                  <span className="role">{name ? short(w, 8, 6) : t("b_role_wl")}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bcard brise">
          <h3>{t("b_rules_locked_h")}</h3>
          <p className="bhint" style={{ marginTop: 0 }}>{t("b_rules_locked_p")}</p>
          <button className="bbtn ghost" onClick={onNewVault} style={{ marginTop: 10 }}>
            + {t("w_new")}
          </button>
        </div>
      </div>

      {treasurer && (
        <div className="bpanel brise" style={{ marginTop: 14 }}>
          <h4>
            {t("b_rules_policy")}{" "}
            {treasurer.paused && <span className="bchip sec">{t("app_paused")}</span>}
          </h4>
          <p className="bhint" style={{ marginTop: 0 }}>{t("b_rules_policy_p")}</p>
          {!editing ? (
            <>
              <div className="brow">
                <span className="k">{t("b_daily_limit")}</span>
                <span className="v num">{usd(treasurer.dailyLimit)} USDC</span>
              </div>
              <div className="brow">
                <span className="k">{t("b_slip")}</span>
                <span className="v num">{treasurer.maxSlippageBps}</span>
              </div>
              <div className="brow">
                <span className="k">{t("b_ref_rate")}</span>
                <span className="v num">{(Number(treasurer.referenceRateUsdTry) / 1e8).toFixed(4)}</span>
              </div>
              <div className="brow">
                <span className="k">{t("b_keeper")}</span>
                <span className="v">{contactName(treasurer.operator) ?? short(treasurer.operator)}</span>
              </div>
              <div className="bform" style={{ marginTop: 10 }}>
                <button className="bbtn ghost" disabled={!isOwner || busy !== null} onClick={openEdit}>
                  {t("app_edit")}
                </button>
                <button
                  className="bbtn ghost"
                  disabled={!isOwner || busy !== null}
                  onClick={() =>
                    run(treasurer.paused ? "unpause" : "pause", () =>
                      sendTreasurerAction(
                        TREASURER_DEPLOYMENT.treasurer,
                        wallet!,
                        treasurer.paused ? "unpause" : "pause",
                      ),
                    )
                  }
                >
                  {busy === "pause" || busy === "unpause"
                    ? t("b_pending")
                    : t(treasurer.paused ? "b_resume_t" : "b_pause_t")}
                </button>
                <label style={{ flexBasis: 260 }}>
                  {t("b_rotate")}
                  <input value={rotAddr} onChange={(e) => setRotAddr(e.target.value)} spellCheck={false} />
                </label>
                <button
                  className="bbtn ghost"
                  disabled={!isOwner || !isAddress(rotAddr) || busy !== null}
                  onClick={rotate}
                >
                  {busy === "rotate" ? t("b_pending") : t("b_save")}
                </button>
              </div>
            </>
          ) : (
            <div className="bform">
              <label>
                {t("b_daily_limit")}
                <input value={daily} onChange={(e) => setDaily(e.target.value)} inputMode="decimal" />
              </label>
              <label>
                {t("b_slip")}
                <input value={slip} onChange={(e) => setSlip(e.target.value)} inputMode="numeric" />
              </label>
              <label>
                {t("b_ref_rate")}
                <input value={ref} onChange={(e) => setRef(e.target.value)} inputMode="decimal" />
              </label>
              <button className="bbtn" disabled={!parsed || busy !== null} onClick={savePolicy}>
                {busy === "policy" ? t("b_pending") : t("b_save")}
              </button>
              <button className="bbtn ghost" onClick={() => setEditing(false)}>
                {t("b_cancel")}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
