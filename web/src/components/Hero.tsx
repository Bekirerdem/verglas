import { SHOWCASE_AGENT_ID } from "../lib/network";
import { ShatterGlass } from "./ShatterGlass";
import type { DashboardData, FreshClearance } from "../lib/data";
import { remaining, SPAN_UNITS_TR } from "../lib/format";
import { useI18n } from "../lib/i18n";

export function Hero({
  data,
  fresh,
  theme,
  onToggleTheme,
}: {
  data: DashboardData | null;
  fresh: FreshClearance | null;
  theme: string;
  onToggleTheme: () => void;
}) {
  const { t, lang, setLang } = useI18n();
  // The page never waits for the chain: the clearance cell streams in when
  // the read lands and stays neutral until then. If the selected network's
  // stamp has lapsed, the badge follows the fresh Fuji record instead of
  // opening the page on a red light.
  const cleared = data?.cleared ?? null;
  const useFallback = cleared === false && fresh !== null;
  const shownId = useFallback ? fresh.agentId : SHOWCASE_AGENT_ID;
  const shownCleared = useFallback ? true : cleared;
  const expires =
    !useFallback && data?.attestation && data.gateMaxAge > 0n
      ? remaining(data.attestation.issuedAt + data.gateMaxAge, lang === "tr" ? SPAN_UNITS_TR : undefined)
      : "";
  const checkHref = `/check/${shownId.toString()}`;

  return (
    <header className="hero">
      <ShatterGlass />
      <div className="topbar">
        <div className="brand">
          <img className="mark" src="/mark.png" alt="" aria-hidden="true" />
          <span className="logotype">
            VERGLAS<sup>ICM</sup>
          </span>
        </div>
        <nav className="navlinks">
          <a href="#problem">{t("nav_how")}</a>
          <a href="#scene">{t("nav_product")}</a>
          <a href="#live">{t("nav_live")}</a>
          <a href={checkHref}>{t("nav_registry")}</a>
          <a href="/docs/">{t("nav_docs")}</a>
          <a href="/app/">{t("nav_app")}</a>
        </nav>
        <div className="toggles">
          <button className="tgl" onClick={() => setLang(lang === "en" ? "tr" : "en")} aria-label="Language">
            {lang === "en" ? "TR" : "EN"}
          </button>
          <button className="tgl" onClick={onToggleTheme} aria-label="Theme">
            {theme === "light" ? "◑" : "◐"}
          </button>
        </div>
        <a className="cta-pill" href="/app/">
          {t("nav_cta")}
        </a>
      </div>

      <div className="hero-block">
        <p className="kicker hero-anim">{t("hero_kicker")}</p>
        <h1>
          <span className="hero-anim" style={{ display: "block" }}>
            {t("hero_l1")}
          </span>
          <span className="l2 hero-anim">{t("hero_l2")}</span>
        </h1>
        <p className="subline hero-anim">
          {t("hero_sub_1")}
          <b>{t("hero_sub_b")}</b>
          {t("hero_sub_2")}
        </p>

        <div className="hero-ctas hero-anim">
          <a className="cta-main" href="/app/">
            {t("s1_cta_demo")}
          </a>
          <a className="cta-ghost" href={checkHref}>
            {t("s1_cta_registry")}
          </a>
        </div>

        <div className="clearance hero-anim" role="status">
          <span className="cell agent">
            {t("hero_agent")} <b>#{shownId.toString()}</b>
          </span>
          <span className={`cell status ${shownCleared === null ? "" : shownCleared ? "ok" : "no"}`}>
            <span className="dot" />
            {shownCleared === null ? "· · ·" : shownCleared ? t("hero_cleared") : t("hero_not_cleared")}
          </span>
          <span className="cell until">
            {shownCleared && expires ? `${t("hero_valid")} ${expires}` : t("hero_live")}
          </span>
        </div>
      </div>

      {/* The passport artifact — the page's one recurring character. Born
          here, stamped in the product scene, carried across in the registry
          scene; clicking it opens the same agent's public record. */}
      <a className="hero-passport hero-anim" href={checkHref} data-ice-glow>
        <div className="hp-head">
          <span className="hp-agent">
            {t("hero_agent")} #{shownId.toString()}
          </span>
          <span className={`hp-status ${shownCleared ? "ok" : ""}`}>
            <span className="dot" />
            {shownCleared === null ? "· · ·" : shownCleared ? t("hero_cleared") : t("hero_not_cleared")}
          </span>
        </div>
        <div className="hp-seal">
          <span className="hp-vg">VG</span>
          <span className="hp-score">100</span>
        </div>
        <div className="hp-foot">
          <span>{t("hp_sealed")}</span>
          <span>{shownCleared && expires ? expires : t("hero_live")}</span>
        </div>
      </a>
    </header>
  );
}
