import { useCallback, useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { FUJI_DEPLOYMENT, TREASURER_DEPLOYMENT } from "@verglas/sdk";
import {
  fetchMyVaults,
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
import { CreateVaultWizard } from "./components/CreateVaultWizard";
import { vaultNames } from "./lib/activate";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const REFRESH_MS = 30_000;

interface VaultEntry {
  key: string;
  account: Address;
  agentId: bigint | null;
}

function resolveEntry(selKey: string, myVaults: readonly Address[]): VaultEntry {
  if (selKey.startsWith("own-")) {
    const account = selKey.slice(4) as Address;
    if (myVaults.includes(account)) return { key: selKey, account, agentId: null };
  }
  if (selKey === "demo") {
    return { key: "demo", account: FUJI_DEPLOYMENT.account, agentId: FUJI_DEPLOYMENT.agentId };
  }
  return { key: "treasurer", account: TREASURER_DEPLOYMENT.account, agentId: TREASURER_DEPLOYMENT.agentId };
}

function Console() {
  const { t, lang, setLang } = useI18n();
  const [selKey, setSelKeyState] = useState(() => localStorage.getItem("verglas-vault") ?? "treasurer");
  const setSelKey = (key: string) => {
    setSelKeyState(key);
    localStorage.setItem("verglas-vault", key);
  };
  const [myVaults, setMyVaults] = useState<readonly Address[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [view, setView] = useState<VaultView | null>(null);
  const [treasurer, setTreasurer] = useState<TreasurerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<Address | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [justFroze, setJustFroze] = useState(false);
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  // iOS never fires beforeinstallprompt — show the manual path instead.
  const [iosHint] = useState(
    () =>
      /iPhone|iPad|iPod/.test(navigator.userAgent) &&
      !window.matchMedia("(display-mode: standalone)").matches,
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  const [theme, setTheme] = useState<string>(() => {
    const saved = localStorage.getItem("verglas-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("verglas-theme", theme);
  }, [theme]);

  const load = useCallback((entry: VaultEntry) => {
    fetchVaultView(entry.account, entry.agentId).then(
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
    const entry = resolveEntry(selKey, myVaults);
    load(entry);
    const timer = setInterval(() => load(entry), REFRESH_MS);
    return () => clearInterval(timer);
  }, [selKey, myVaults, load]);

  const refreshMyVaults = useCallback((owner: Address) => {
    fetchMyVaults(owner).then((v) => {
      setMyVaults(v);
      // First visit with an own vault: land the user on THEIR vault.
      if (v.length > 0 && localStorage.getItem("verglas-vault") === null) {
        setSelKeyState(`own-${v[0]}`);
      }
    }, () => {});
  }, []);

  useEffect(() => {
    getConnected().then((addr) => {
      setWallet(addr);
      if (addr) refreshMyVaults(addr);
    }, () => {});
  }, [refreshMyVaults]);

  const sel = resolveEntry(selKey, myVaults);
  const isOwner = !!wallet && !!view && wallet.toLowerCase() === view.state.owner.toLowerCase();
  const isAgent = !!wallet && !!view && wallet.toLowerCase() === view.state.agent.toLowerCase();
  const showTreasurer = sel.key === "treasurer" ? treasurer : null;

  /** Sign → wait for the receipt → refetch. Returns whether the tx landed. */
  const run = async (label: string, send: () => Promise<Hex>): Promise<boolean> => {
    if (busy) return false;
    setBusy(label);
    try {
      const hash = await send();
      const rc = await hubChain.waitForTransactionReceipt({ hash });
      if (rc.status !== "success") throw new Error("reverted");
      setTxError(null);
      load(sel);
      return true;
    } catch {
      setTxError(label); // rejected in the wallet or reverted by a vault rule
      return false;
    } finally {
      setBusy(null);
    }
  };

  const onConnect = () =>
    connect().then((addr) => {
      setWallet(addr);
      refreshMyVaults(addr);
    }, () => {});

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
          <img className="mark" src="/icon-192.png" alt="" />
          <span className="logotype">
            VERGLAS<sup>{t("app_title")}</sup>
          </span>
        </a>
        <div className="cnav-picker" role="tablist">
          <button
            role="tab"
            aria-selected={sel.key === "treasurer"}
            className={sel.key === "treasurer" ? "on" : ""}
            onClick={() => setSelKey("treasurer")}
          >
            {t("app_vault_treasurer")}
          </button>
          <button
            role="tab"
            aria-selected={sel.key === "demo"}
            className={sel.key === "demo" ? "on" : ""}
            onClick={() => setSelKey("demo")}
          >
            {t("app_vault_demo")}
          </button>
          {myVaults.map((a, i) => (
            <button
              key={a}
              role="tab"
              aria-selected={sel.key === `own-${a}`}
              className={sel.key === `own-${a}` ? "on" : ""}
              onClick={() => setSelKey(`own-${a}`)}
            >
              {vaultNames()[a.toLowerCase()] ?? `${t("app_vault_mine")} ${i + 1}`}
            </button>
          ))}
          <button className="cnav-new" onClick={() => setWizardOpen(true)}>
            + {t("w_new")}
          </button>
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
          {installEvt && (
            <button
              className="mono cnav-new"
              onClick={() => {
                installEvt.prompt();
                setInstallEvt(null);
              }}
            >
              {t("app_install")}
            </button>
          )}
          {iosHint && <span className="mono ios-hint">{t("app_ios_hint")}</span>}
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
          {txError && (
            <div className="tx-error mono">
              ⚠ {t("app_tx_failed")} ({txError})
            </div>
          )}
          <section className="slab-hero">
            <VaultSlab view={view} treasurer={showTreasurer} />
            <ControlRail
              view={view}
              treasurer={showTreasurer}
              wallet={wallet}
              isOwner={isOwner}
              isAgent={isAgent}
              busy={busy}
              onConnect={onConnect}
              run={run}
              onFroze={glaze}
            />
          </section>
          <ReceiptShelf view={view} treasurer={showTreasurer} />
          <PassportBand view={view} wallet={wallet} isOwner={isOwner} onRefresh={() => load(sel)} />
        </>
      )}

      {wizardOpen && (
        <CreateVaultWizard
          wallet={wallet}
          onConnect={onConnect}
          onClose={() => setWizardOpen(false)}
          onCreated={(account) => {
            setWizardOpen(false);
            if (wallet) {
              fetchMyVaults(wallet).then((v) => {
                setMyVaults(v);
                setSelKey(`own-${account}`);
              }, () => {});
            }
          }}
        />
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
