import { useCallback, useEffect, useRef, useState } from "react";
import type { Address, Hex } from "viem";
import { NET, SHOWCASE_ACCOUNT, SHOWCASE_AGENT_ID, TREASURER } from "../lib/network";
import { NetworkChip } from "./components/NetworkChip";
import {
  fetchBalances,
  fetchMyVaults,
  fetchTreasurer,
  fetchVaultView,
  hubChain,
  latestStamp,
  type HistoryKind,
  type TreasurerData,
  type VaultView,
} from "../lib/data";
import { I18nProvider, useI18n } from "../lib/i18n";
import { short, usd, utcDate } from "../lib/format";
import { connect, ensureChain, getConnected } from "./lib/wallet";
import { txErrorReason } from "./lib/txError";
import { contactName, initials } from "./lib/contacts";
import { memoFor } from "./lib/memos";
import { vaultNames } from "./lib/activate";
import { BalanceCard } from "./components/BalanceCard";
import { GuvenceCard } from "./components/GuvenceCard";
import { AuditCard } from "./components/AuditCard";
import { ActionDesk, type Desk } from "./components/ActionDesk";
import { ContactsPanel } from "./components/ContactsPanel";
import { VaultHistory } from "./components/VaultHistory";
import { CreateVaultWizard } from "./components/CreateVaultWizard";
import { RulesPage } from "./components/RulesPage";
import { AuditPage } from "./components/AuditPage";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const REFRESH_MS = 30_000;

interface VaultEntry {
  key: string;
  account: Address;
  agentId: bigint | null;
}

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

function resolveEntry(selKey: string, myVaults: readonly Address[]): VaultEntry {
  if (selKey.startsWith("own-")) {
    const account = selKey.slice(4) as Address;
    if (myVaults.includes(account)) return { key: selKey, account, agentId: null };
  }
  if (selKey === "demo" && SHOWCASE_ACCOUNT !== ZERO) {
    return { key: "demo", account: SHOWCASE_ACCOUNT, agentId: SHOWCASE_AGENT_ID };
  }
  if (TREASURER) {
    return { key: "treasurer", account: TREASURER.account, agentId: TREASURER.agentId };
  }
  // A network with no showcase and no own vault yet: fall back to the first own
  // vault if one exists, otherwise report "nothing selected" so the console
  // renders the create-your-vault state instead of reading the zero address.
  if (myVaults.length > 0) return { key: `own-${myVaults[0]}`, account: myVaults[0], agentId: null };
  return { key: "none", account: ZERO, agentId: null };
}

const NAV = [
  { key: "overview", label: "b_overview", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { key: "payments", label: "b_payments", icon: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" },
  { key: "rules", label: "b_rules", icon: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" },
  { key: "audit", label: "b_audit", icon: "M9 12l2 2 4-5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "people", label: "b_people", icon: "M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 11a4 4 0 100-8 4 4 0 000 8z" },
] as const;

type Page = (typeof NAV)[number]["key"];

/** Real pages behind the sidebar: the URL hash is the router, so the back
    button and reloads land where the user actually was. */
function pageFromHash(): Page {
  const h = location.hash.replace(/^#\/?/, "");
  return (NAV.some((n) => n.key === h) ? h : "overview") as Page;
}

/** Networks without showcase vaults (mainnet today) must not open on a borrowed
    row — they land on the visitor's own first vault, or on the empty state. */
const hasShowcase = SHOWCASE_ACCOUNT !== "0x0000000000000000000000000000000000000000";
const DEFAULT_SEL = TREASURER ? "treasurer" : hasShowcase ? "demo" : "own-none";

function Console() {
  const { t, lang, setLang } = useI18n();
  const [selKey, setSelKeyState] = useState(() => localStorage.getItem("verglas-vault") ?? DEFAULT_SEL);
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
  const [txErrorDetail, setTxErrorDetail] = useState<string>("");
  const [justFroze, setJustFroze] = useState(false);
  const [desk, setDesk] = useState<Desk>(null);
  const [page, setPage] = useState<Page>(pageFromHash);
  const [query, setQuery] = useState("");
  const [kindF, setKindF] = useState<HistoryKind | "security" | null>(null);

  useEffect(() => {
    const onHash = () => {
      setPage(pageFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
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
    // Paper canvas is the brand default; dark stays one toggle away.
    return "light";
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
    // A network with no showcase and no own vault yet has nothing to read —
    // reading the zero address would surface a raw RPC error to a visitor
    // whose only sensible next step is "create your vault".
    if (entry.account === ZERO) {
      setView(null);
      setError(null);
      setSwitching(false);
      return;
    }
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
    if (TREASURER) fetchTreasurer().then(setTreasurer, () => {});
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
    const accounts = [...myVaults, ...(TREASURER ? [TREASURER.account] : []), SHOWCASE_ACCOUNT];
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
      await ensureChain();
      const hash = await send();
      const rc = await hubChain.waitForTransactionReceipt({ hash });
      if (rc.status !== "success") throw new Error("reverted");
      setTxError(null);
      setTxErrorDetail("");
      load(sel);
      return true;
    } catch (e) {
      console.error("[tx]", label, e);
      setTxError(label);
      setTxErrorDetail(txErrorReason(e)); // the line that names the actual cause
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
    if (TREASURER && account.toLowerCase() === TREASURER.account.toLowerCase()) return "Haznedar";
    if (account === ZERO) return "—";
    const i = myVaults.findIndex((a) => a.toLowerCase() === account.toLowerCase());
    const named = vaultNames()[account.toLowerCase()];
    // The showcase stand-in name is for visitors only — the owner of the
    // showcase vault sees it as their own (mainnet's showcase IS an owned vault).
    if (i < 0 && !named && hasShowcase && account.toLowerCase() === SHOWCASE_ACCOUNT.toLowerCase()) {
      return "Demo Agent";
    }
    return named ?? `${t("app_vault_mine")} ${i + 1}`;
  };
  // Labels follow the vault that is actually ON SCREEN (the fetched view),
  // so a switch never shows the new name over the old vault's numbers.
  const selLabel = view ? vaultLabel(view.account) : vaultLabel(sel.account);
  const ownerName = view ? contactName(view.state.owner) : null;
  const balanceOf = (a: Address) => {
    const b = balances[a.toLowerCase()];
    return b === undefined ? "" : usd(b);
  };

  const navigate = (key: Page) => {
    location.hash = key === "overview" ? "/" : `/${key}`;
    window.scrollTo(0, 0); // clicking the current page still returns to top
  };

  /** Statement rows as an accountant-ready CSV, memos included. */
  const exportCsv = () => {
    if (!view) return;
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = view.history.map((h) =>
      [
        new Date(Number(h.timestamp) * 1000).toISOString(),
        h.kind,
        esc(contactName(h.counterparty) ?? ""),
        h.counterparty ?? "",
        h.amount !== null ? `${h.kind === "deposit" ? "" : "-"}${(Number(h.amount) / 1e6).toFixed(2)}` : "",
        esc(memoFor(h.txHash) ?? ""),
        h.txHash,
      ].join(","),
    );
    const csv = ["date_utc,type,counterparty_name,counterparty_address,amount_usdc,memo,tx_hash", ...rows].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `verglas-${selLabel.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const frozen = view?.state.frozen ?? false;
  const lastStamp = view ? latestStamp(view.stamps) : undefined;

  return (
    <div className={`console${frozen ? " is-frozen" : ""}${justFroze ? " just-froze" : ""}`}>
      <div className="glaze" aria-hidden="true" />

      <div className="bshell">
        <aside className="bside">
          <a className="bside-brand" href="/">
            <img src="/mark.png" alt="" />
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
                className={`bnav${page === n.key ? " on" : ""}`}
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
            {TREASURER && (
              <button
                className={`bacct${sel.key === "treasurer" ? " on" : ""}`}
                onClick={() => setSelKey("treasurer")}
              >
                <span>
                  Haznedar<span className="showcase">{t("b_showcase_lc")}</span>
                </span>
                <span className="v num">{balanceOf(TREASURER.account)}</span>
              </button>
            )}
            {hasShowcase && !myVaults.some((a) => a.toLowerCase() === SHOWCASE_ACCOUNT.toLowerCase()) && (
              <button className={`bacct${sel.key === "demo" ? " on" : ""}`} onClick={() => setSelKey("demo")}>
                <span>
                  {vaultLabel(SHOWCASE_ACCOUNT)}
                  <span className="showcase">{t("b_showcase_lc")}</span>
                </span>
                <span className="v num">{balanceOf(SHOWCASE_ACCOUNT)}</span>
              </button>
            )}
            {!TREASURER && !hasShowcase && myVaults.length === 0 && (
              <p className="bhint" style={{ margin: "2px 4px 0" }}>
                {t("b_no_showcase")}
              </p>
            )}
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
                {/* The role is about the vault on screen; with none open it
                    would read "viewer" and look like a broken connection. */}
                {view && (
                  <span className={`chip ${isOwner ? "chip-amber" : "chip-dim"}`}>
                    {t(isOwner ? "app_owner" : "app_viewer")}
                  </span>
                )}
                <code>{short(wallet)}</code>
              </div>
            )}
            <div className="bside-net">
              <NetworkChip />
            </div>
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
              {iosHint ? t("app_ios_hint") : <>{NET.label} · {t(NET.kind === "mainnet" ? "b_env_main" : "b_env")}<br />{t("b_chain_note")}</>}
            </div>
          </div>
        </aside>

        <main className="bmain">
          {error && !view && (
            <div className="err">
              RPC: {error} {t("err_retry")}
            </div>
          )}
          {!view && !error && sel.account === ZERO && (
            <div className="bcard brise" style={{ maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
              <h3>{t("b_empty_h")}</h3>
              <p style={{ fontSize: 13.5, color: "var(--ink2)", marginBottom: 14 }}>{t("b_empty_p")}</p>
              <button className="bbtn" onClick={() => setWizardOpen(true)}>
                + {t("w_new")}
              </button>
            </div>
          )}
          {!view && !error && sel.account !== ZERO && <div className="loading">{t("app_loading")}</div>}

          {view && (
            <div className={switching ? "bswitching" : undefined}>
              <div className="bhead brise">
                <div>
                  <h1>{t(NAV.find((n) => n.key === page)!.label)}</h1>
                  <div className="sub">
                    {page === "overview" ? (
                      <>
                        {t(frozen ? "b_sub_frozen" : "b_sub_ok")}
                        {lastStamp && ` — ${t("b_last_audit")}: ${utcDate(lastStamp.lastUpdate)}`}
                      </>
                    ) : (
                      t(`b_sub_${page}`)
                    )}
                  </div>
                </div>
                {page === "payments" && (
                  <div className="bsearch">
                    ⌕
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t("b_search")}
                    />
                  </div>
                )}
              </div>

              {txError && (
                <div className="bnote">
                  ⚠ {t("app_tx_failed")}
                  {txErrorDetail && <div className="bnote-detail">{txErrorDetail}</div>}
                </div>
              )}

              {(page === "overview" || page === "payments") && (
                <ActionDesk
                  view={view}
                  wallet={wallet}
                  isOwner={isOwner}
                  isAgent={isAgent}
                  busy={busy}
                  open={desk}
                  onToggle={(d) => setDesk(desk === d ? null : d)}
                  run={run}
                />
              )}

              {page === "overview" && (
                <>
                  <div className="bgrid">
                    <BalanceCard
                      view={view}
                      rateUsdTry={treasurer ? treasurer.pythRateUsdTry : null}
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
                      onOpenAudit={() => navigate("audit")}
                    />
                  </div>
                  <VaultHistory
                    view={view}
                    vaultLabel={selLabel}
                    query=""
                    limit={6}
                    onSeeAll={() => navigate("payments")}
                  />
                </>
              )}

              {page === "payments" && (
                <>
                  <div className="bfilters brise">
                    {(
                      [
                        [null, "b_f_all"],
                        ["spend", "b_f_pay"],
                        ["deposit", "b_f_dep"],
                        ["withdraw", "b_f_wd"],
                        ["security", "b_f_sec"],
                      ] as const
                    ).map(([k, label]) => (
                      <button
                        key={label}
                        className={`bfchip${kindF === k ? " on" : ""}`}
                        onClick={() => setKindF(k)}
                      >
                        {t(label)}
                      </button>
                    ))}
                    <button className="bfchip csv" onClick={exportCsv}>
                      ⇣ {t("b_csv")}
                    </button>
                  </div>
                  <VaultHistory view={view} vaultLabel={selLabel} query={query} kind={kindF} withMemo />
                </>
              )}

              {page === "rules" && (
                <RulesPage
                  view={view}
                  treasurer={showTreasurer}
                  wallet={wallet}
                  isOwner={isOwner}
                  busy={busy}
                  run={run}
                  onFroze={glaze}
                  onNewVault={() => setWizardOpen(true)}
                />
              )}

              {page === "audit" && (
                <AuditPage
                  view={view}
                  wallet={wallet}
                  isOwner={isOwner}
                  busy={busy}
                  run={run}
                  onRefresh={() => load(sel)}
                />
              )}

              {page === "people" && (
                <>
                  <ContactsPanel view={view} onChange={() => bump((n) => n + 1)} />
                  <div className="bpanel brise" style={{ marginTop: 14 }}>
                    <h4>{t("b_people_locked_h")}</h4>
                    <p className="bhint" style={{ marginTop: 0 }}>{t("b_people_locked_p")}</p>
                    <button className="bbtn ghost" onClick={() => setWizardOpen(true)}>
                      + {t("w_new")}
                    </button>
                  </div>
                </>
              )}
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
