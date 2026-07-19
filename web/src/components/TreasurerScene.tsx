import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { TreasurerData } from "../lib/data";
import { useI18n } from "../lib/i18n";
import { usd } from "../lib/format";

gsap.registerPlugin(ScrollTrigger);

const rate4 = (v: bigint) => (Number(v) / 1e8).toFixed(4);

/** S3 — THE TREASURER AT WORK: the page's hero scene. Pinned; scroll scrubs
    the console frame through a week: shock → trip → in-rule payment → seal.
    The frame is a stylized mock of the real console, fed live numbers. */
export function TreasurerScene({ treasurer }: { treasurer: TreasurerData | null }) {
  const { t } = useI18n();
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!root.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      root.current.querySelector(".ts-frame")?.setAttribute("data-stage", "4");
      gsap.set(root.current.querySelectorAll(".ts-step"), { opacity: 1, y: 0 });
      return;
    }
    const ctx = gsap.context(() => {
      const frame = root.current!.querySelector(".ts-frame")!;
      const steps = gsap.utils.toArray<HTMLElement>(".ts-step");
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=2400",
          scrub: 0.5,
          pin: true,
          anticipatePin: 1,
        },
      });
      steps.forEach((el, i) => {
        tl.set(frame, { attr: { "data-stage": i + 1 } }, i + 0.05);
        tl.to(el, { opacity: 1, y: 0, duration: 0.45 }, i);
        if (i < steps.length - 1) tl.to(el, { opacity: 0.35, duration: 0.3 }, i + 0.72);
      });
      tl.to({}, { duration: 0.4 }); // breathing room after the seal
    }, root);
    return () => ctx.revert();
  }, []);

  const live = treasurer ? rate4(treasurer.hermesRateUsdTry ?? treasurer.pythRateUsdTry) : "47.05";
  const ref = treasurer ? rate4(treasurer.referenceRateUsdTry) : "47.05";
  const cap = treasurer ? usd(treasurer.dailyLimit) : "10.00";

  const steps = [1, 2, 3, 4] as const;

  return (
    <section className="tscene" id="scene" ref={root}>
      <div className="ts-inner">
        <div className="ts-left">
          <p className="ptag">{t("r3_tag")}</p>
          <p className="ts-intro serif">
            {t("r3_intro_1")}
            <b>{t("r3_intro_b")}</b>
            {t("r3_intro_2")}
          </p>

          <div className="ts-frame glass" data-stage="0">
            <div className="tsf-head mono">
              <span>VAULT #220</span>
              <span className="tsf-chip ok">ACTIVE</span>
              <span className="tsf-chip trip">TRIPPED</span>
            </div>
            <div className="tsf-gauge">
              <div className="tsf-rates mono">
                <span>
                  USD/TRY <b className="tsf-live">{live}</b>
                </span>
                <span className="dim">
                  REF <b>{ref}</b>
                </span>
                <span className="dim">
                  CAP <b>{cap}</b>
                </span>
              </div>
              <div className="tsf-needle">
                <i />
              </div>
            </div>
            <div className="tsf-lever mono">
              <i className="tsf-track">
                <b className="tsf-knob" />
              </i>
              <span>FX CIRCUIT BREAKER</span>
            </div>
            <div className="tsf-receipt mono">
              <span>−1.00 USDC</span>
              <span className="dim">→ supplier · in-rule</span>
            </div>
            <div className="tsf-stamp" aria-hidden="true">
              <span>VG</span>
              <em>SEALED · 100</em>
            </div>
          </div>
        </div>

        <div className="ts-steps">
          {steps.map((n) => (
            <div className="ts-step" key={n}>
              <span className="mono ts-num">0{n}</span>
              <h3>{t(`r3_s${n}_t` as "r3_s1_t")}</h3>
              <p>{t(`r3_s${n}_p` as "r3_s1_p")}</p>
            </div>
          ))}
          <p className="ts-hint mono">{t("r3_hint")}</p>
        </div>
      </div>
    </section>
  );
}
