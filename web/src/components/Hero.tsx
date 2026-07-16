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
          <a href="#why">{t("nav_why")}</a>
          <a href="#crossing">{t("nav_crossing")}</a>
          <a href="#ledger">{t("nav_ledger")}</a>
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
