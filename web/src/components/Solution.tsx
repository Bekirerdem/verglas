import { useEffect, useRef, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useI18n } from "../lib/i18n";

/** S3 — THE ANSWER, the page's hero scene: one pinned scroll drives three
    moves (vault → receipt → passport). The finale reuses the border-crossing
    mechanic — the user's scroll carries the amber stamp to the gate. */
export function Solution() {
  const { t } = useI18n();
  const secRef = useRef<HTMLElement>(null);
  const travRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState(1);
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!secRef.current) return;
    if (reduced) {
      // No pin: all three steps render stacked, stamp already arrived.
      setPhase(3);
      setArrived(true);
      if (travRef.current) travRef.current.style.left = "100%";
      return;
    }
    const st = ScrollTrigger.create({
      trigger: secRef.current,
      start: "top top+=56",
      end: "+=280%",
      pin: true,
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        setPhase(p < 0.3 ? 1 : p < 0.55 ? 2 : 3);
        // The stamp travels through the last phase of the scroll.
        const tp = Math.max(0, Math.min(1, (p - 0.6) / 0.32));
        if (travRef.current) travRef.current.style.left = `${tp * 100}%`;
        setArrived(p > 0.94);
      },
    });
    return () => st.kill();
  }, []);

  const steps = [
    { k: t("s3_s1_k"), title: t("s3_s1_t"), body: t("s3_s1_p") },
    { k: t("s3_s2_k"), title: t("s3_s2_t"), body: t("s3_s2_p") },
    { k: t("s3_s3_k"), title: t("s3_s3_t"), body: t("s3_s3_p") },
  ];

  return (
    <section className="solution" id="solution" ref={secRef} data-phase={phase}>
      <div className="sol-inner">
        <p className="ptag">{t("s3_tag")}</p>
        <h2>{t("s3_h")}</h2>

        <div className="sol-cols">
          <ol className="sol-steps">
            {steps.map((s, i) => (
              <li key={s.k} className={phase === i + 1 ? "on" : phase > i + 1 ? "done" : ""}>
                <span className="sk">{s.k}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>

          <div className="sol-stage" aria-hidden="true">
            {/* Phase 1 — the vault: rules behind glass */}
            <div className="vign vault">
              <div className="vault-box">
                <span className="vrule">WHITELIST</span>
                <span className="vrule">PER-TX LIMIT</span>
                <span className="vrule">BUDGET</span>
                <span className="vrule brake">FREEZE — OWNER ONLY</span>
              </div>
            </div>
            {/* Phase 2 — the receipt: the amber seal */}
            <div className="vign receipt">
              <div className="seal-big" data-ice-glow>
                <span className="score">100</span>
                <span className="of">SCORE</span>
              </div>
              <p className="vcap">ZK · GROTH16</p>
            </div>
            {/* Phase 3 — the passport: the crossing, driven by scroll */}
            <div className={`vign crossing ${arrived ? "arrived" : ""}`}>
              <div className="route">
                <div className="terminus">
                  <div className="glyph">C</div>
                  <div className="tname">Fuji C-Chain</div>
                </div>
                <div className="path">
                  <div className="traveller" ref={travRef} data-ice-glow>
                    <span className="tscore">100</span>
                  </div>
                </div>
                <div className="terminus gate-side">
                  <div className="glyph">D</div>
                  <div className="tname">Dispatch L1</div>
                  <div className="arrived-chip">✓ isCleared</div>
                </div>
              </div>
              <p className="vcap hint">{t("s3_hint")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
