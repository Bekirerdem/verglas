import { SHOWCASE_AGENT_ID, gateUrl } from "../lib/network";
import type { DashboardData } from "../lib/data";
import { remaining } from "../lib/format";
import { useI18n } from "../lib/i18n";

export function Hero({
  data,
  theme,
  onToggleTheme,
}: {
  data: DashboardData | null;
  theme: string;
  onToggleTheme: () => void;
}) {
  const { t, lang, setLang } = useI18n();
  // The page never waits for the chain: the clearance cell streams in when
  // the read lands and stays neutral until then.
  const cleared = data?.cleared ?? null;
  const expires =
    data?.attestation && data.gateMaxAge > 0n ? remaining(data.attestation.issuedAt + data.gateMaxAge) : "";

  return (
    <header className="hero">
      <div className="topbar">
        <div className="brand">
          <img className="mark" src="/icon-192.png" alt="" aria-hidden="true" />
          <span className="logotype">
            VERGLAS<sup>ICM</sup>
          </span>
        </div>
        <nav className="navlinks">
          <a href="#scene">{t("nav_how")}</a>
          <a href="#motor">{t("nav_product")}</a>
          <a href="#live">{t("nav_live")}</a>
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
        <a
          className="cta-pill"
          href={gateUrl()}
          target="_blank"
          rel="noreferrer"
        >
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
          <a className="cta-ghost" href="/docs/">
            {t("s1_cta_docs")}
          </a>
        </div>

        <div className="clearance hero-anim" role="status">
          <span className="cell agent">
            {t("hero_agent")} <b>#{SHOWCASE_AGENT_ID.toString()}</b>
          </span>
          <span className={`cell status ${cleared === null ? "" : cleared ? "ok" : "no"}`}>
            <span className="dot" />
            {cleared === null ? "· · ·" : cleared ? t("hero_cleared") : t("hero_not_cleared")}
          </span>
          <span className="cell until">
            {cleared && expires ? `${t("hero_valid")} ${expires}` : t("hero_live")}
          </span>
        </div>
      </div>

      {/* The passport artifact — the moat, previewed. Replaces the orphan
          amber score chip: the same seal, now anchored to the hero as the
          thing the whole page is about. */}
      <aside className="hero-passport hero-anim" aria-hidden="true" data-ice-glow>
        <div className="hp-head">
          <span className="hp-agent">
            {t("hero_agent")} #{SHOWCASE_AGENT_ID.toString()}
          </span>
          <span className={`hp-status ${cleared ? "ok" : ""}`}>
            <span className="dot" />
            {cleared === null ? "· · ·" : cleared ? t("hero_cleared") : t("hero_not_cleared")}
          </span>
        </div>
        <div className="hp-seal">
          <span className="hp-vg">VG</span>
          <span className="hp-score">100</span>
        </div>
        <div className="hp-foot">
          <span>{t("hp_sealed")}</span>
          <span>{cleared && expires ? expires : t("hero_live")}</span>
        </div>
      </aside>
    </header>
  );
}
