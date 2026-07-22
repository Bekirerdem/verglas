import { useCallback, useEffect, useRef, useState } from "react";
import type { Address, Hex } from "viem";
import { FUJI_DEPLOYMENT, TREASURER_DEPLOYMENT } from "@verglas/sdk";
import {
  fetchBalances,
  fetchMyVaults,
  fetchTreasurer,
  fetchVaultView,
  hubChain,
  type TreasurerData,
  type VaultView,
} from "../lib/data";
import { I18nProvider, useI18n } from "../lib/i18n";
import { short, usd, utcDate } from "../lib/format";
import { connect, getConnected } from "./lib/wallet";
import { contactName, initials } from "./lib/contacts";
import { vaultNames } from "./lib/activate";
import { BalanceCard } from "./components/BalanceCard";
import { GuvenceCard } from "./components/GuvenceCard";
import { AuditCard } from "./components/AuditCard";
import { ActionDesk, type Desk } from "./components/ActionDesk";
import { ContactsPanel } from "./components/ContactsPanel";
import { VaultHistory } from "./components/VaultHistory";
import { CreateVaultWizard } from "./components/CreateVaultWizard";

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

const NAV = [
  { key: "overview", label: "b_overview", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { key: "payments", label: "b_payments", icon: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" },
  { key: "rules", label: "b_rules", icon: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" },
  { key: "audit", label: "b_audit", icon: "M9 12l2 2 4-5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "people", label: "b_people", icon: "M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 11a4 4 0 100-8 4 4 0 000 8z" },
] as const;

function Console() {
  const { t, lang, setLang } = useI18n();
  const [selKey, setSelKeyState] = useState(() => localStorage.getItem("verglas-vault") ?? "treasurer");
  const setSelKey = (key: string) => {
    setSelKeyState(key);
    localStorage.setItem("verglas-vault", key);
  };
  const [myVaults, setMyVaults] = useState<readonly Address[]>([]);
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [wizardOpen, setWizardOpen] = useState(false);
  const [view, setView] = useState<VaultView | null>(null);
  const [treasurer, setTreasurer] = useState<TreasurerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<Address | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [justFroze, setJustFroze] = useState(false);
  const [desk, setDesk] = useState<Desk>(null);
  const [navKey, setNavKey] = useState<string>("overview");
  const [query, setQuery] = useState("");
  const [, bump] = useState(0);
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
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("verglas-theme", theme);
  }, [theme]);

  const [switching, setSwitching] = useState(false);
  // Per-vault view cache: revisits swap instantly, then refresh silently.
  const viewCache = useRef<Record<string, VaultView>>({});
  // The vault on screen — a fetch (or its background history scan) that
  // lands after the user switched away must never overwrite the new vault.
  const currentKey = useRef("");

  const load = useCallback((entry: VaultEntry) => {
    const key = entry.account.toLowerCase();
    const apply = (v: VaultView) => {
      viewCache.current[key] = v;
      if (currentKey.current !== key) return;
      setView(v);
      setError(null);
      setSwitching(false);
    };
    // apply runs twice: once with the fast point-read view, once more when
    // the background history scan lands.
    fetchVaultView(entry.account, entry.agentId, apply).then(apply, (e: unknown) => {
      if (currentKey.current !== key) return;
      setError(e instanceof Error ? e.message : String(e));
      setSwitching(false);
    });
    fetchTreasurer().then(setTreasurer, () => {});
  }, []);

  // Stale-while-revalidate: keep the current vault on screen (dimmed) and
  // swap atomically when the new one lands — no blank waiting room.
  useEffect(() => {
    const entry = resolveEntry(selKey, myVaults);
    currentKey.current = entry.account.toLowerCase();
    const cached = viewCache.current[entry.account.toLowerCase()];
    if (cached) setView(cached);
    setSwitching(!cached);
    load(entry);
    const timer = setInterval(() => load(entry), REFRESH_MS);
    return () => clearInterval(timer);
  }, [selKey, myVaults, load]);

  // side-rail balances for every listed vault
  useEffect(() => {
    const accounts = [...myVaults, TREASURER_DEPLOYMENT.account, FUJI_DEPLOYMENT.account];
    fetchBalances(accounts).then(setBalances, () => {});
  }, [myVaults, view?.fetchedAt]);

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

  const vaultLabel = (account: Address): string => {
    if (account.toLowerCase() === TREASURER_DEPLOYMENT.account.toLowerCase()) return "Haznedar";
    if (account.toLowerCase() === FUJI_DEPLOYMENT.account.toLowerCase()) return "Demo Agent";
    const i = myVaults.findIndex((a) => a.toLowerCase() === account.toLowerCase());
    return vaultNames()[account.toLowerCase()] ?? `${t("app_vault_mine")} ${i + 1}`;
  };
  // Labels follow the vault that is actually ON SCREEN (the fetched view),
  // so a switch never shows the new name over the old vault's numbers.
  const selLabel = view ? vaultLabel(view.account) : vaultLabel(sel.account);
  const ownerName = view ? contactName(view.state.owner) : null;
  const balanceOf = (a: Address) => {
    const b = balances[a.toLowerCase()];
    return b === undefined ? "" : usd(b);
  };

  const navigate = (key: string) => {
    setNavKey(key);
    if (key === "overview") window.scrollTo({ top: 0, behavior: "smooth" });
    if (key === "payments") document.getElementById("activity")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (key === "audit") document.getElementById("audit")?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (key === "rules") setDesk(desk === "rules" ? null : "rules");
    if (key === "people") setDesk(desk === "people" ? null : "people");
  };

  const frozen = view?.state.frozen ?? false;
  const lastStamp = view?.stamps.find((s) => s.score > 0);

  return (
    <div className={`console${frozen ? " is-frozen" : ""}${justFroze ? " just-froze" : ""}`}>
      <div className="glaze" aria-hidden="true" />

      <div className="bshell">
        <aside className="bside">
          <a className="bside-brand" href="/">
            <img src="/icon-192.png" alt="" />
            <b>VERGLAS</b>
          </a>

          <div className="bside-me">
            <div className="bside-ava">{initials(ownerName ?? selLabel, view?.state.owner ?? "0xVG")}</div>
            <span>{t("b_welcome")}</span>
            <b>{ownerName ?? selLabel}</b>
          </div>

          <div className="bside-nav">
            {NAV.map((n) => (
              <button
                key={n.key}
                className={`bnav${navKey === n.key ? " on" : ""}`}
                onClick={() => navigate(n.key)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={n.icon} />
                </svg>
                {t(n.label)}
              </button>
            ))}
          </div>

          <div className="bside-sec">{t("b_vaults")}</div>
          <div className="bside-vaults">
            {myVaults.map((a) => (
              <button
                key={a}
                className={`bacct${sel.key === `own-${a}` ? " on" : ""}`}
                onClick={() => setSelKey(`own-${a}`)}
              >
                <span>{vaultLabel(a)}</span>
                <span className="v num">{balanceOf(a)}</span>
              </button>
            ))}
            <button
              className={`bacct${sel.key === "treasurer" ? " on" : ""}`}
              onClick={() => setSelKey("treasurer")}
            >
              <span>
                Haznedar<span className="showcase">{t("b_showcase_lc")}</span>
              </span>
              <span className="v num">{balanceOf(TREASURER_DEPLOYMENT.account)}</span>
            </button>
            <button className={`bacct${sel.key === "demo" ? " on" : ""}`} onClick={() => setSelKey("demo")}>
              <span>
                Demo Agent<span className="showcase">{t("b_showcase_lc")}</span>
              </span>
              <span className="v num">{balanceOf(FUJI_DEPLOYMENT.account)}</span>
            </button>
          </div>
          <button className="bside-new" onClick={() => setWizardOpen(true)}>
            + {t("w_new")}
          </button>

          {!wallet && (
            <button className="bconnect" onClick={onConnect}>
              {t("b_connect")}
            </button>
          )}

          <div className="bside-foot">
            {wallet && (
              <div className="bside-wallet">
                <span className={`chip ${isOwner ? "chip-amber" : "chip-dim"}`}>
                  {t(isOwner ? "app_owner" : "app_viewer")}
                </span>
                <code>{short(wallet)}</code>
              </div>
            )}
            <div className="bside-toggles">
              <button className="btgl" onClick={() => setLang(lang === "en" ? "tr" : "en")}>
                {lang === "en" ? "TR" : "EN"}
              </button>
              <button className="btgl" aria-label="theme" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
                ◐
              </button>
              {installEvt && (
                <button
                  className="btgl"
                  onClick={() => {
                    installEvt.prompt();
                    setInstallEvt(null);
                  }}
                >
                  📲
                </button>
              )}
              <a className="btgl" href="/docs/" style={{ textDecoration: "none" }}>
                Docs
              </a>
            </div>
            <div className="bside-note">
              {iosHint ? t("app_ios_hint") : <>Fuji · Avalanche<br />{t("b_chain_note")}</>}
            </div>
          </div>
        </aside>

        <main className="bmain">
          {error && !view && (
            <div className="err">
              RPC: {error} {t("err_retry")}
            </div>
          )}
          {!view && !error && <div className="loading">{t("app_loading")}</div>}

          {view && (
            <div className={switching ? "bswitching" : undefined}>
              <div className="bhead brise">
                <div>
                  <h1>{t("b_overview")}</h1>
                  <div className="sub">
                    {t(frozen ? "b_sub_frozen" : "b_sub_ok")}
                    {lastStamp && ` — ${t("b_last_audit")}: ${utcDate(lastStamp.lastUpdate)}`}
                  </div>
                </div>
                <div className="bsearch">
                  ⌕
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("b_search")}
                  />
                </div>
                <span className="envchip">{t("b_env")}</span>
              </div>

              {txError && <div className="bnote">⚠ {t("app_tx_failed")}</div>}

              <ActionDesk
                view={view}
                treasurer={showTreasurer}
                wallet={wallet}
                isOwner={isOwner}
                isAgent={isAgent}
                busy={busy}
                open={desk}
                onToggle={(d) => setDesk(desk === d ? null : d)}
                run={run}
              />

              {desk === "people" && <ContactsPanel view={view} onChange={() => bump((n) => n + 1)} />}

              <div className="bgrid">
                <BalanceCard
                  view={view}
                  rateUsdTry={treasurer ? (treasurer.hermesRateUsdTry ?? treasurer.pythRateUsdTry) : null}
                />
                <GuvenceCard
                  view={view}
                  treasurer={showTreasurer}
                  wallet={wallet}
                  isOwner={isOwner}
                  busy={busy}
                  run={run}
                  onFroze={glaze}
                />
                <AuditCard
                  view={view}
                  wallet={wallet}
                  isOwner={isOwner}
                  busy={busy}
                  run={run}
                  onRefresh={() => load(sel)}
                />
              </div>

              <VaultHistory view={view} vaultLabel={selLabel} query={query} />
            </div>
          )}
        </main>
      </div>

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
