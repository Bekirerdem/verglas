import { useState } from "react";
import { isAddress, parseUnits, type Address } from "viem";
import { fetchMyVaults, hubChain } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { short } from "../../lib/format";
import { sendCreateVault, sendUsdc } from "../lib/wallet";
import { activateStampLine, setVaultName } from "../lib/activate";

const FAUCET = "https://faucet.circle.com/";

const PRESETS = [
  { key: "w_p1", perTx: "2", budget: "10" },
  { key: "w_p2", perTx: "5", budget: "20" },
  { key: "w_p3", perTx: "10", budget: "50" },
] as const;

interface Props {
  wallet: Address | null;
  onConnect: () => void;
  onClose: () => void;
  onCreated: (account: Address) => void;
}

/** The console's "create your vault" flow: rules → sign → fund → stamp line. */
export function CreateVaultWizard({ wallet, onConnect, onClose, onCreated }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [agent, setAgent] = useState<string>(wallet ?? "");
  const [perTx, setPerTx] = useState("5");
  const [budget, setBudget] = useState("20");
  const [wl, setWl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [created, setCreated] = useState<Address | null>(null);
  const [fundAmt, setFundAmt] = useState("2");
  const [fundedTx, setFundedTx] = useState(false);
  const [actStep, setActStep] = useState<0 | 1 | 2 | 3>(0);
  const [actAgentId, setActAgentId] = useState<bigint | null>(null);

  const whitelist = wl
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const wlValid = whitelist.length >= 1 && whitelist.length <= 8 && whitelist.every((a) => isAddress(a));

  let amounts: { perTxLimit: bigint; totalBudget: bigint } | null = null;
  try {
    const p = parseUnits(perTx, 6);
    const b = parseUnits(budget, 6);
    if (p > 0n && b > 0n) amounts = { perTxLimit: p, totalBudget: b };
  } catch {
    amounts = null;
  }
  const valid = !!wallet && isAddress(agent) && wlValid && amounts !== null;

  const create = async () => {
    if (!valid || busy) return;
    setBusy("create");
    setError(false);
    try {
      const hash = await sendCreateVault(wallet!, {
        agent: agent as Address,
        ...amounts!,
        whitelist: whitelist as Address[],
      });
      await hubChain.waitForTransactionReceipt({ hash });
      const vaults = await fetchMyVaults(wallet!);
      const account = vaults[vaults.length - 1] ?? null;
      if (account && name.trim()) setVaultName(account, name.trim());
      setCreated(account);
    } catch {
      setError(true);
    }
    setBusy(null);
  };

  const fund = async () => {
    if (!created || !wallet || busy) return;
    setBusy("fund");
    setError(false);
    try {
      const hash = await sendUsdc(wallet, created, parseUnits(fundAmt, 6));
      await hubChain.waitForTransactionReceipt({ hash });
      setFundedTx(true);
    } catch {
      setError(true);
    }
    setBusy(null);
  };

  const activate = async () => {
    if (!created || !wallet || busy || actStep !== 0) return;
    setBusy("activate");
    setError(false);
    try {
      const agentId = await activateStampLine(wallet, created, setActStep);
      setActAgentId(agentId);
    } catch {
      setError(true);
    }
    setActStep(0);
    setBusy(null);
  };

  return (
    <div className="wiz-overlay" role="dialog" aria-modal="true">
      <div className="wiz">
        <div className="rail-row">
          <span className="mono rail-tag">{t("w_title")}</span>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        {!wallet ? (
          <>
            <p className="rail-hint">{t("w_connect_first")}</p>
            <button className="btn-primary" onClick={onConnect}>
              {t("app_connect")}
            </button>
          </>
        ) : created === null ? (
          <div className="policy-form mono">
            <label>
              {t("w_name")}
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
            </label>
            <label>
              {t("w_agent")}
              <input value={agent} onChange={(e) => setAgent(e.target.value)} spellCheck={false} />
            </label>
            <span className="wiz-hint">{t("w_agent_hint")}</span>
            <div className="rail-actions">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  className={`btn-ghost${perTx === p.perTx && budget === p.budget ? " on" : ""}`}
                  onClick={() => {
                    setPerTx(p.perTx);
                    setBudget(p.budget);
                  }}
                >
                  {t(p.key)}
                </button>
              ))}
            </div>
            <div className="wiz-two">
              <label>
                {t("w_pertx")}
                <input value={perTx} onChange={(e) => setPerTx(e.target.value)} inputMode="decimal" />
              </label>
              <label>
                {t("w_budget")}
                <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" />
              </label>
            </div>
            <label>
              {t("w_wl")}
              <textarea value={wl} onChange={(e) => setWl(e.target.value)} rows={3} spellCheck={false} />
            </label>
            {error && <span className="wiz-err">{t("w_error")}</span>}
            <div className="rail-actions">
              <button className="btn-primary" disabled={!valid || busy !== null} onClick={create}>
                {busy === "create" ? t("app_pending") : t("w_deploy")}
              </button>
              <button className="btn-ghost" onClick={onClose}>
                {t("app_cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="policy-form mono">
            <h3 className="wiz-done">{t("w_done_h")}</h3>
            <div className="wiz-addr">
              <span>{short(created, 10, 8)}</span>
              <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(created)}>
                COPY
              </button>
            </div>

            <span className="mono rail-tag">{t("w_fund")}</span>
            <p className="rail-hint">{t("w_fund_p")}</p>
            <div className="wiz-two">
              <label>
                {t("w_amount")}
                <input value={fundAmt} onChange={(e) => setFundAmt(e.target.value)} inputMode="decimal" />
              </label>
              <div className="rail-actions wiz-fundrow">
                <button className="btn-ghost" disabled={busy !== null} onClick={fund}>
                  {busy === "fund" ? t("app_pending") : fundedTx ? "✓ " + t("w_send") : t("w_send")}
                </button>
                <a className="btn-ghost" href={FAUCET} target="_blank" rel="noreferrer">
                  {t("w_faucet")}
                </a>
              </div>
            </div>

            <span className="mono rail-tag">{t("w_stamp")}</span>
            <p className="rail-hint">{t("app_activate_p")}</p>
            {actAgentId !== null ? (
              <span className="chip chip-amber wiz-act-done">
                ✓ {t("w_stamp_done")} #{actAgentId.toString()}
              </span>
            ) : (
              <button className="btn-ghost" disabled={busy !== null} onClick={activate}>
                {actStep === 0
                  ? t("app_activate")
                  : `${actStep}/3 · ${t(actStep === 1 ? "app_act_step1" : actStep === 2 ? "app_act_step2" : "app_act_step3")}…`}
              </button>
            )}

            {error && <span className="wiz-err">{t("w_error")}</span>}
            <button className="btn-primary" onClick={() => onCreated(created)}>
              {t("w_close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
