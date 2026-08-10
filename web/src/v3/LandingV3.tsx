import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { DashboardData, FreshClearance, TreasurerData } from "../lib/data";
import { SHOWCASE_AGENT_ID } from "../lib/network";
import { useI18n } from "../lib/i18n";

gsap.registerPlugin(ScrollTrigger);

const VaultScene = lazy(() => import("./VaultScene").then((m) => ({ default: m.VaultScene })));

function webglOk(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** V3 — the marketing page over the agreed narrative: the security layer
    for trusting software with money. Dark hero with the 3D glass vault,
    light product sections with REAL screenshots, dark breach scene, live
    proof, the public record, personas, close. */
export function LandingV3({
  data,
  fresh,
  treasurer,
}: {
  data: DashboardData | null;
  fresh: FreshClearance | null;
  treasurer: TreasurerData | null;
}) {
  const { t, lang, setLang } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const [gl] = useState(webglOk);
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  const cleared = data?.cleared ?? null;
  const useFallback = cleared === false && fresh !== null;
  const shownId = useFallback ? fresh.agentId : SHOWCASE_AGENT_ID;
  const shownCleared = useFallback ? true : cleared;
  const checkHref = `/check/${shownId.toString()}`;
  const rate = treasurer ? (Number(treasurer.pythRateUsdTry) / 1e8).toFixed(2) : null;

  useEffect(() => {
    if (!root.current) return;
    const ctx = gsap.context(() => {
      const showAll = () => gsap.set(".v3-up, .v3-reveal", { opacity: 1, clearProps: "transform" });
      // A hidden tab has no animation frames: entrance tweens would freeze
      // on their first (invisible) keyframe. Play only on a visible tab.
      if (reduced || document.visibilityState !== "visible") {
        showAll();
        return;
      }
      gsap.fromTo(
        ".v3-hero .v3-up",
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.09, delay: 0.05 },
      );
      gsap.utils.toArray<HTMLElement>(".v3-reveal").forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 86%" } },
        );
      });
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  const scene = (breach: boolean) =>
    gl && !reduced ? (
      <Suspense fallback={<div className="v3-scene-fallback" />}>
        <VaultScene breach={breach} />
      </Suspense>
    ) : (
      <div className="v3-scene-fallback" />
    );

  return (
    <div className="v3" ref={root}>
      {/* ─── nav ─── */}
      <header className="v3-nav">
        <a className="v3-brand" href="/">
          <img src="/mark.png" alt="" width="24" height="24" />
          <span>VERGLAS</span>
        </a>
        <nav className="v3-links">
          <a href="#how">{t("v3_nav_how")}</a>
          <a href="#record">{t("v3_nav_record")}</a>
          <a href="/docs/">{t("v3_nav_docs")}</a>
        </nav>
        <div className="v3-nav-right">
          <button className="v3-lang" onClick={() => setLang(lang === "en" ? "tr" : "en")}>
            {lang === "en" ? "TR" : "EN"}
          </button>
          <a className="v3-btn v3-btn-solid" href="/app/">
            {t("v3_nav_console")}
          </a>
        </div>
      </header>

      {/* ─── hero: dark, the glass vault ─── */}
      <section className="v3-hero">
        <div className="v3-hero-copy">
          <p className="v3-kicker v3-up">{t("v3_kicker")}</p>
          <h1 className="v3-up">
            {t("v3_h1a")} <em>{t("v3_h1b")}</em>
          </h1>
          <p className="v3-sub v3-up">{t("v3_sub")}</p>
          <div className="v3-ctas v3-up">
            <a className="v3-btn v3-btn-solid" href="/app/">
              {t("v3_cta_console")}
            </a>
            <a className="v3-btn v3-btn-ghost" href={checkHref}>
              {t("v3_cta_record")}
            </a>
          </div>
          <a className={`v3-badge v3-up ${shownCleared ? "ok" : ""}`} href={checkHref}>
            <span className="v3-dot" />
            {t("v3_live_agent")} #{shownId.toString()} ·{" "}
            {shownCleared === null ? t("v3_badge_loading") : shownCleared ? t("v3_badge_cleared") : "…"}
          </a>
        </div>
        <div className="v3-hero-scene" aria-hidden="true">
          {scene(false)}
        </div>
      </section>

      {/* ─── how it works: light, real product ─── */}
      <section className="v3-light" id="how">
        <div className="v3-wrap">
          <p className="v3-kicker v3-reveal">{t("v3_how_kicker")}</p>
          <h2 className="v3-h2 v3-reveal">{t("v3_how_h")}</h2>

          <div className="v3-step v3-reveal">
            <div className="v3-step-copy">
              <span className="v3-num mono">01</span>
              <h3>{t("v3_s1_h")}</h3>
              <p>{t("v3_s1_p")}</p>
            </div>
            <figure className="v3-shot">
              <img src="/shots/rules.jpg" alt="Verglas console — rules" loading="lazy" />
            </figure>
          </div>

          <div className="v3-step v3-step-flip v3-reveal">
            <div className="v3-step-copy">
              <span className="v3-num mono">02</span>
              <h3>{t("v3_s2_h")}</h3>
              <p>{t("v3_s2_p")}</p>
            </div>
            <figure className="v3-shot v3-code">
              <pre className="mono">{`// the agent is a wallet address
createVault({
  agent:    0xBOT,
  perTx:    5 USDC,
  budget:   10 USDC,
  approved: [supplier, api],
})
// every spend checked at this door`}</pre>
            </figure>
          </div>

          <div className="v3-step v3-reveal">
            <div className="v3-step-copy">
              <span className="v3-num mono">03</span>
              <h3>{t("v3_s3_h")}</h3>
              <p>{t("v3_s3_p")}</p>
            </div>
            <figure className="v3-shot">
              <img src="/shots/console.jpg" alt="Verglas console — weekly proof" loading="lazy" />
            </figure>
          </div>
        </div>
      </section>

      {/* ─── breach: dark, the frozen ray ─── */}
      <section className="v3-breach">
        <div className="v3-breach-scene" aria-hidden="true">
          {scene(true)}
        </div>
        <div className="v3-breach-copy">
          <p className="v3-kicker v3-reveal">{t("v3_breach_kicker")}</p>
          <h2 className="v3-h2 v3-reveal">{t("v3_breach_h")}</h2>
          <p className="v3-p v3-reveal">{t("v3_breach_p")}</p>
          <div className="v3-errors mono v3-reveal">
            <span>✘ NotInWhitelist(to)</span>
            <span>✘ PerTxLimitExceeded(amount, limit)</span>
            <span>✘ BudgetExceeded(wouldBe, budget)</span>
          </div>
        </div>
      </section>

      {/* ─── live strip ─── */}
      <section className="v3-live">
        <p className="v3-kicker v3-reveal">{t("v3_live_kicker")}</p>
        <div className="v3-live-row v3-reveal">
          <div className="v3-cell">
            <span className="v3-cell-k">{t("v3_live_agent")} #{shownId.toString()}</span>
            <span className={`v3-cell-v ${shownCleared ? "ok" : ""}`}>
              <span className="v3-dot" /> {shownCleared ? t("v3_badge_cleared") : "…"}
            </span>
          </div>
          <div className="v3-cell">
            <span className="v3-cell-k">{t("v3_live_rate")}</span>
            <span className="v3-cell-v mono">{rate ? `${rate} ₺` : "…"}</span>
          </div>
          <div className="v3-cell">
            <span className="v3-cell-k">{t("v3_live_proof")}</span>
            <span className="v3-cell-v mono">{t("v3_live_proof_v")}</span>
          </div>
        </div>
      </section>

      {/* ─── the record: light ─── */}
      <section className="v3-light" id="record">
        <div className="v3-wrap v3-record">
          <div className="v3-step-copy v3-reveal">
            <p className="v3-kicker">{t("v3_rec_kicker")}</p>
            <h2 className="v3-h2">{t("v3_rec_h")}</h2>
            <p className="v3-p">{t("v3_rec_p")}</p>
            <a className="v3-btn v3-btn-dark" href={checkHref}>
              {t("v3_rec_cta")}
            </a>
          </div>
          <figure className="v3-shot v3-reveal">
            <img src="/shots/record.jpg" alt="Verglas Check — public agent record" loading="lazy" />
          </figure>
        </div>
      </section>

      {/* ─── who it's for ─── */}
      <section className="v3-who">
        <div className="v3-wrap">
          <p className="v3-kicker v3-reveal">{t("v3_who_kicker")}</p>
          <h2 className="v3-h2 v3-reveal">{t("v3_who_h")}</h2>
          <div className="v3-cards">
            {(["w1", "w2", "w3"] as const).map((k) => (
              <div className="v3-card v3-reveal" key={k}>
                <h3>{t(`v3_${k}_h` as "v3_w1_h")}</h3>
                <p>{t(`v3_${k}_p` as "v3_w1_p")}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── close ─── */}
      <section className="v3-end">
        <h2 className="v3-reveal">
          {t("v3_end_h")} <em>{t("v3_end_p")}</em>
        </h2>
        <div className="v3-ctas v3-reveal">
          <a className="v3-btn v3-btn-solid" href="/app/">
            {t("v3_cta_console")}
          </a>
          <a className="v3-btn v3-btn-ghost" href="https://github.com/Bekirerdem/verglas" target="_blank" rel="noreferrer">
            GitHub →
          </a>
        </div>
      </section>

      <footer className="v3-foot">
        <span>{t("v3_foot_open")}</span>
        <span>
          {t("v3_foot_docs")} <a href="/docs/">/docs</a>
        </span>
        <span className="mono">© VERGLAS 2026 · AVALANCHE</span>
      </footer>
    </div>
  );
}
