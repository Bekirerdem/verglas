import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { fetchDashboard, type DashboardData } from "./lib/data";
import { Hero } from "./components/Hero";
import { TwoWays } from "./components/TwoWays";
import { Papers } from "./components/Papers";
import { CrossingBand } from "./components/CrossingBand";
import { Ledger } from "./components/Ledger";
import { NextBand } from "./components/NextBand";
import { FooterWall } from "./components/FooterWall";

gsap.registerPlugin(ScrollTrigger);

const REFRESH_MS = 45_000;

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

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
      // Background tabs freeze rAF, which would leave the tweens stuck on
      // their invisible "from" state — wait for visibility instead.
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

  return (
    <div ref={rootRef}>
      <div className="rails" aria-hidden="true">
        <i /><i /><i /><i /><i />
      </div>
      <div className="grain" aria-hidden="true" />
      {error && !data && <div className="err">RPC error: {error} — retrying shortly.</div>}
      {!data && !error && <div className="loading">READING THE BORDER…</div>}

      {data && (
        <>
          <Hero data={data} />
          <main>
            <div className="rail">
              <span>
                C-CHAIN <b>· HUB</b>
              </span>
              <span>→</span>
              <span>
                ICM <b>· TRANSPORT</b>
              </span>
              <span>→</span>
              <span>
                DISPATCH <b>· GATE</b>
              </span>
            </div>
            <TwoWays />
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
