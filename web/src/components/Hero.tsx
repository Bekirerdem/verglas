import { FUJI_DEPLOYMENT } from "@verglas/sdk";
import type { DashboardData } from "../lib/data";
import { remaining } from "../lib/format";
import { useI18n } from "../lib/i18n";

export function Hero({
  data,
  theme,
  onToggleTheme,
}: {
  data: DashboardData;
  theme: string;
  onToggleTheme: () => void;
}) {
  const { t, lang, setLang } = useI18n();
  const { cleared, attestation, gateMaxAge } = data;
  const expires = attestation && gateMaxAge > 0n ? remaining(attestation.issuedAt + gateMaxAge) : "";

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
          href={`https://subnets-test.avax.network/dispatch/address/${FUJI_DEPLOYMENT.gateOnDispatch}`}
          target="_blank"
          rel="noreferrer"
        >
          {t("nav_cta")}
        </a>
      </div>

      <div className="hero-block">
        <p className="kicker hero-anim">{t("s1_kicker")}</p>
        <h1>
          <span className="hero-anim" style={{ display: "block" }}>
            {t("s1_h1a")}
          </span>
          <span className="l2 hero-anim">{t("s1_h1b")}</span>
        </h1>
        <p className="subline hero-anim">
          {t("s1_sub_1")}
          <b>{t("s1_sub_b")}</b>
          {t("s1_sub_2")}
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
            {t("hero_agent")} <b>#{FUJI_DEPLOYMENT.agentId.toString()}</b>
          </span>
          <span className={`cell status ${cleared ? "ok" : "no"}`}>
            <span className="dot" />
            {cleared ? t("hero_cleared") : t("hero_not_cleared")}
          </span>
          <span className="cell until">
            {cleared && expires ? `${t("hero_valid")} ${expires}` : t("hero_live")}
          </span>
        </div>
      </div>

      <div className="stampmark hero-anim" aria-hidden="true" data-ice-glow>
        <span className="score">100</span>
        <span className="of">SCORE</span>
      </div>
    </header>
  );
}
