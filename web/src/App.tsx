import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { fetchDashboard, type DashboardData } from "./lib/data";
import { I18nProvider, useI18n } from "./lib/i18n";
import { Hero } from "./components/Hero";
import { ProofStrip } from "./components/ProofStrip";
import { Accordion } from "./components/Accordion";
import { Papers } from "./components/Papers";
import { CrossingBand } from "./components/CrossingBand";
import { Ledger } from "./components/Ledger";
import { NextBand } from "./components/NextBand";
import { FooterWall } from "./components/FooterWall";

gsap.registerPlugin(ScrollTrigger);

const REFRESH_MS = 45_000;

function Page() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<string>(() => {
    const saved = localStorage.getItem("verglas-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("verglas-theme", theme);
  }, [theme]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchDashboard().then(
        (d) => {
          if (alive) {
            setData(d);
            setError(null);
          }
        },
        (e: unknown) => {
          if (alive) setError(e instanceof Error ? e.message : String(e));
        },
      );
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // entrance + scroll choreography (runs once the page first has data)
  const hasData = data !== null;
  useEffect(() => {
    if (!hasData || !rootRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const showAll = () => gsap.set(".hero-anim, .will-reveal", { opacity: 1, clearProps: "transform" });
      if (reduced) {
        showAll();
        return;
      }
      const play = () => {
        gsap.fromTo(
          ".hero-anim",
          { opacity: 0, y: 34 },
          { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.09, delay: 0.1 },
        );
        // hero copy drifts up as you leave — depth against the fixed ice
        gsap.to(".hero-block", {
          yPercent: -22,
          opacity: 0.4,
          ease: "none",
          scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
        });
        gsap.utils.toArray<HTMLElement>(".will-reveal").forEach((el) => {
          gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 82%" },
          });
        });
      };
      if (document.visibilityState === "visible") {
        play();
      } else {
        showAll();
        const once = () => {
          if (document.visibilityState === "visible") {
            document.removeEventListener("visibilitychange", once);
            ScrollTrigger.refresh();
          }
        };
        document.addEventListener("visibilitychange", once);
      }
    }, rootRef);
    return () => ctx.revert();
  }, [hasData]);

  // language switch re-renders text; make sure revealed items stay visible
  useEffect(() => {
    if (hasData) gsap.set(".will-reveal", { opacity: 1, clearProps: "transform" });
  }, [lang, hasData]);

  return (
    <div ref={rootRef}>
      <div className="grain" aria-hidden="true" />
      {error && !data && (
        <div className="err">
          RPC: {error} {t("err_retry")}
        </div>
      )}
      {!data && !error && <div className="loading">{t("loading")}</div>}

      {data && (
        <>
          <Hero data={data} theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} />
          <main>
            <ProofStrip />
            <Accordion />
            <div className="ice-band will-reveal">
              <span>{t("band_1")}</span>
              <span className="arrow">→</span>
              <span>{t("band_2")}</span>
            </div>
            <Papers data={data} />
            <CrossingBand data={data} />
            <Ledger data={data} />
            <NextBand />
          </main>
          <FooterWall />
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <Page />
    </I18nProvider>
  );
}
