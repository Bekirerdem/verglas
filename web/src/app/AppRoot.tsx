import { useCallback, useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { FUJI_DEPLOYMENT, TREASURER_DEPLOYMENT } from "@verglas/sdk";
import {
  fetchTreasurer,
  fetchVaultView,
  hubChain,
  type TreasurerData,
  type VaultView,
} from "../lib/data";
import { I18nProvider, useI18n } from "../lib/i18n";
import { connect, getConnected } from "./lib/wallet";
import { VaultSlab } from "./components/VaultSlab";
import { ControlRail } from "./components/ControlRail";
import { ReceiptShelf } from "./components/ReceiptShelf";
import { PassportBand } from "./components/PassportBand";

const REFRESH_MS = 30_000;

export type VaultKey = "treasurer" | "demo";

const VAULTS: Record<VaultKey, { account: Address; agentId: bigint }> = {
  treasurer: { account: TREASURER_DEPLOYMENT.account, agentId: TREASURER_DEPLOYMENT.agentId },
  demo: { account: FUJI_DEPLOYMENT.account, agentId: FUJI_DEPLOYMENT.agentId },
};

function Console() {
  const { t, lang, setLang } = useI18n();
  const [vaultKey, setVaultKey] = useState<VaultKey>("treasurer");
  const [view, setView] = useState<VaultView | null>(null);
  const [treasurer, setTreasurer] = useState<TreasurerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<Address | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [justFroze, setJustFroze] = useState(false);
  const [theme, setTheme] = useState<string>(() => {
    const saved = localStorage.getItem("verglas-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("verglas-theme", theme);
  }, [theme]);

  const load = useCallback((key: VaultKey) => {
    fetchVaultView(VAULTS[key].account, VAULTS[key].agentId).then(
      (v) => {
        setView(v);
        setError(null);
      },
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
    fetchTreasurer().then(setTreasurer, () => {});
  }, []);

  useEffect(() => {
    setView(null);
    load(vaultKey);
    const timer = setInterval(() => load(vaultKey), REFRESH_MS);
    return () => clearInterval(timer);
  }, [vaultKey, load]);

  useEffect(() => {
    getConnected().then(setWallet, () => {});
  }, []);

  const isOwner = !!wallet && !!view && wallet.toLowerCase() === view.state.owner.toLowerCase();
  const showTreasurer = vaultKey === "treasurer" ? treasurer : null;

  /** Sign → wait for the receipt → refetch. Returns whether the tx landed. */
  const run = async (label: string, send: () => Promise<Hex>): Promise<boolean> => {
    if (busy) return false;
    setBusy(label);
    try {
      const hash = await send();
      await hubChain.waitForTransactionReceipt({ hash });
      load(vaultKey);
      return true;
    } catch {
      return false; // user rejected or reverted — the poll keeps the truth
    } finally {
      setBusy(null);
    }
  };

  const onConnect = () => connect().then(setWallet, () => {});
  const glaze = () => {
    setJustFroze(true);
    setTimeout(() => setJustFroze(false), 1100);
  };

  const frozen = view?.state.frozen ?? false;

  return (
    <div className={`console${frozen ? " is-frozen" : ""}${justFroze ? " just-froze" : ""}`}>
      <div className="grain" aria-hidden="true" />
      <div className="glaze" aria-hidden="true" />

      <nav className="cnav glass">
        <a className="cnav-brand" href="/">
          <img className="mark" src="/favicon.svg" alt="" />
          <span className="logotype">
            VERGLAS<sup>{t("app_title")}</sup>
          </span>
        </a>
        <div className="cnav-picker" role="tablist">
          {(Object.keys(VAULTS) as VaultKey[]).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={vaultKey === k}
              className={vaultKey === k ? "on" : ""}
              onClick={() => setVaultKey(k)}
            >
              {t(k === "treasurer" ? "app_vault_treasurer" : "app_vault_demo")}
            </button>
          ))}
        </div>
        <div className="cnav-right">
          <span className="net-dot mono">
            <i /> {t("app_net")}
          </span>
          <a className="mono cnav-link" href="/docs/">
            {t("nav_docs")}
          </a>
          <a className="mono cnav-link" href="/">
            {t("app_nav_site")}
          </a>
          <button className="mono cnav-toggle" onClick={() => setLang(lang === "en" ? "tr" : "en")}>
            {lang === "en" ? "TR" : "EN"}
          </button>
          <button
            className="mono cnav-toggle"
            aria-label="theme"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            ◐
          </button>
        </div>
      </nav>

      {error && !view && (
        <div className="err">
          RPC: {error} {t("err_retry")}
        </div>
      )}
      {!view && !error && <div className="loading">{t("app_loading")}</div>}

      {view && (
        <>
          <section className="slab-hero">
            <VaultSlab view={view} treasurer={showTreasurer} />
            <ControlRail
              view={view}
              treasurer={showTreasurer}
              wallet={wallet}
              isOwner={isOwner}
              busy={busy}
              onConnect={onConnect}
              run={run}
              onFroze={glaze}
            />
          </section>
          <ReceiptShelf view={view} treasurer={showTreasurer} />
          <PassportBand view={view} />
        </>
      )}
    </div>
  );
}

export default function AppRoot() {
  return (
    <I18nProvider>
      <Console />
    </I18nProvider>
  );
}
