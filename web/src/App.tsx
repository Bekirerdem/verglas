import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { fetchDashboard, type DashboardData } from "./lib/data";
import { Hero } from "./components/Hero";
import { Problem } from "./components/Problem";
import { Papers } from "./components/Papers";
import { CrossingBand } from "./components/CrossingBand";
import { Ledger } from "./components/Ledger";
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

  // entrance + scroll choreography (runs once the page has data)
  useEffect(() => {
    if (!data || !rootRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set(".hero-anim, .will-reveal", { opacity: 1, y: 0, clearProps: "transform" });
        return;
      }
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
    }, rootRef);
    return () => ctx.revert();
  }, [data]);

  return (
    <div ref={rootRef}>
      <div className="grain" aria-hidden="true" />
      {error && !data && <div className="err">RPC error: {error} — retrying shortly.</div>}
      {!data && !error && <div className="loading">READING THE BORDER…</div>}

      {data && (
        <>
          <Hero data={data} />
          <main className="day-body">
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
            <Problem />
            <Papers data={data} />
            <CrossingBand data={data} />
            <Ledger data={data} />
          </main>
          <FooterWall />
        </>
      )}
    </div>
  );
}
