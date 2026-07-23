import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useI18n } from "../lib/i18n";

gsap.registerPlugin(ScrollTrigger);

/** S3b — THE PASSPORT: the moat, full-bleed. Pinned; scroll carries the
    sealed stamp from the C-Chain hub across the rail to the Dispatch gate,
    which clears green on arrival. The one scene where "trust that travels"
    is something the visitor physically moves. */
export function Passport() {
  const { t } = useI18n();
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!root.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      root.current.querySelector(".pp-rail")?.setAttribute("data-arrived", "1");
      gsap.set(root.current.querySelectorAll(".pp-reveal"), { opacity: 1, y: 0, filter: "blur(0px)" });
      gsap.set(root.current.querySelector(".pp-stamp"), { left: "calc(100% - 46px)" });
      return;
    }
    const ctx = gsap.context(() => {
      const rail = root.current!.querySelector(".pp-rail")!;
      // Premium reveal (Krehel): opacity + y16 + blur6, decelerate — plays
      // once as the section settles, before the scrubbed crossing begins.
      gsap.fromTo(
        root.current!.querySelectorAll(".pp-reveal"),
        { opacity: 0, y: 16, filter: "blur(6px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.48,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: { trigger: root.current, start: "top 70%" },
        },
      );
      // The crossing itself — ScrollTrigger lives on the TIMELINE, never a
      // child tween. Scrub ties the stamp's travel to scroll position.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=1500",
          scrub: 0.5,
          pin: true,
          anticipatePin: 1,
        },
      });
      tl.fromTo(
        ".pp-stamp",
        { left: "0%" },
        { left: "calc(100% - 46px)", ease: "none" },
      );
      tl.fromTo(".pp-sweep", { scaleX: 0 }, { scaleX: 1, ease: "none" }, 0);
      tl.set(rail, { attr: { "data-arrived": "1" } }, 0.86);
      tl.to({}, { duration: 0.14 }); // hold on the cleared gate
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section className="passport" id="passport" ref={root}>
      <div className="pp-inner">
        <p className="ptag pp-reveal">{t("r3p_tag")}</p>
        <h2 className="pp-h pp-reveal">{t("r3p_h")}</h2>
        <p className="pp-p pp-reveal">{t("r3p_p")}</p>

        <div className="pp-stage pp-reveal">
          <div className="pp-rail" data-arrived="0">
            <span className="pp-sweep" aria-hidden="true" />
            <span className="pp-node src">
              <b>C-CHAIN</b>
              <em>hub</em>
            </span>
            <i className="pp-line" aria-hidden="true">
              <b className="pp-stamp" data-ice-glow>
                VG
              </b>
            </i>
            <span className="pp-node dst">
              <b>DISPATCH</b>
              <em className="pp-gate">isCleared → true</em>
            </span>
          </div>
        </div>

        <p className="pp-kite serif pp-reveal">{t("r3p_kite")}</p>
        <p className="pp-hint mono pp-reveal">{t("r3p_hint")}</p>
      </div>
    </section>
  );
}
