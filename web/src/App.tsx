import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import "./reframe.css";
import {
  fetchDashboard,
  fetchFallbackClearance,
  fetchTreasurer,
  type DashboardData,
  type FreshClearance,
  type TreasurerData,
} from "./lib/data";
import { I18nProvider, useI18n } from "./lib/i18n";
import { Hero } from "./components/Hero";
import { Problem } from "./components/Problem";
import { TreasurerScene } from "./components/TreasurerScene";
import { Passport } from "./components/Passport";
import { LiveBand } from "./components/LiveBand";
import { SHOWCASE_AGENT_ID } from "./lib/network";
import { Closing } from "./components/Closing";
import { FooterWall } from "./components/FooterWall";
import { VerglasCanvas } from "./components/VerglasCanvas";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const REFRESH_MS = 45_000;

function Page() {
  const { lang } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [fresh, setFresh] = useState<FreshClearance | null>(null);
  const [treasurer, setTreasurer] = useState<TreasurerData | null>(null);
  const [theme, setTheme] = useState<string>(() => {
    const saved = localStorage.getItem("verglas-theme");
    if (saved === "light" || saved === "dark") return saved;
    // Night ice is the brand ground (avax/business surface); light stays a toggle away.
    return "dark";
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("verglas-theme", theme);
  }, [theme]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      // A failed read keeps the last good data on screen and stays silent —
      // the marketing page never surfaces an RPC error to a visitor.
      fetchDashboard().then(
        (d) => {
          if (!alive) return;
          setData(d);
          // Stale showcase stamp → read the keeper-fresh Fuji record so the
          // hero badge never opens the page on a red light.
          if (!d.cleared) {
            fetchFallbackClearance().then(
              (f) => {
                if (alive) setFresh(f);
              },
              () => {},
            );
          }
        },
        () => {},
      );
      // The treasurer panel degrades to a loading note on its own — a V2 read
      // failure must never take the V1 dashboard down with it.
      fetchTreasurer().then(
        (v) => {
          if (alive) setTreasurer(v);
        },
        () => {},
      );
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // entrance + scroll choreography — runs on mount; the page never waits
  // for chain data (a slow RPC must not black out the site).
  useEffect(() => {
    if (!rootRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const showAll = () =>
        gsap.set(".hero-anim, .will-reveal, .pp-reveal", { opacity: 1, filter: "blur(0px)", clearProps: "transform" });
      if (reduced) {
        showAll();
        return;
      }
      const play = () => {
        // Hero entrance — the glass-frost reveal: content settles out of a
        // frosted pane (opacity + y16 + blur10), decelerate (power3.out),
        // no overshoot (ice does not bounce). The canvas fires one glaze
        // sweep as the page freezes into place.
        gsap.fromTo(
          ".hero-anim",
          { opacity: 0, y: 16, filter: "blur(10px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.52, ease: "power3.out", stagger: 0.08, delay: 0.1 },
        );
        gsap.delayedCall(0.25, () => window.dispatchEvent(new Event("verglas-sweep")));
        // hero copy drifts up as you leave — counter-motion depth against the
        // fixed ice (ambient layer, ease:none for 1:1 scroll linkage)
        gsap.to(".hero-block", {
          yPercent: -18,
          opacity: 0.35,
          ease: "none",
          scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
        });
        gsap.to(".hero-passport", {
          yPercent: -34,
          ease: "none",
          scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
        });
        // Section reveals share the one signature token — same y16+blur6,
        // same easing, so the whole page reads as one motion voice.
        gsap.utils.toArray<HTMLElement>(".will-reveal").forEach((el) => {
          gsap.fromTo(
            el,
            { opacity: 0, y: 16, filter: "blur(6px)" },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.48,
              ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 84%" },
            },
          );
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
  }, []);

  // language switch re-renders text; make sure revealed items stay visible
  useEffect(() => {
    gsap.set(".will-reveal, .pp-reveal", { opacity: 1, filter: "blur(0px)", clearProps: "transform" });
  }, [lang]);

  // Anchor travel goes through GSAP: a native jump teleports past the
  // pinned scenes' spacers (blank screen), and CSS smooth-scrolling
  // fights ScrollTrigger's pins (the scroll jitter). Scrolling the whole
  // way keeps every pin consistent.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const target = document.querySelector(a.getAttribute("href") || "");
      if (!target) return;
      e.preventDefault();
      // Plain JS smooth scroll, no plugin: the GSAP scrollTo route died
      // silently on pinned targets. rect + scrollY is correct with pin
      // spacers in the layout, and a one-shot native smooth scroll doesn't
      // fight ScrollTrigger the way global CSS smooth-scrolling did.
      const y = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 76);
      window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div ref={rootRef}>
      <VerglasCanvas theme={theme} />
      <div className="grain" aria-hidden="true" />
      <div className="colgrid" aria-hidden="true" />
      {/* The landing is a marketing page: a chain read failure must never
          surface a raw RPC error to a visitor. The live cells simply stay
          in their neutral state until the data lands. */}

      <Hero data={data} fresh={fresh} theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} />
      <main>
        <div className="room room-raised">
          <Problem />
        </div>
        <TreasurerScene treasurer={treasurer} />
        <LiveBand data={data} fresh={fresh} treasurer={treasurer} />
        <Passport recordId={data?.cleared === false && fresh ? fresh.agentId : SHOWCASE_AGENT_ID} />
        <Closing />
      </main>
      <FooterWall />
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
