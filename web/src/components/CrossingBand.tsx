import { useEffect, useRef } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { DashboardData } from "../lib/data";
import { short } from "../lib/format";
import { useI18n } from "../lib/i18n";

/** First live crossing, kept as permanent evidence. */
const FIRST_CROSSING = {
  txHash: "0x2aeb3d600565d7ff6e811383476deba71b6e9228893cdb19d8ddebed1dd3191b",
  messageID: "0x5f4f7344087ba93a30969ee6f849df4fed3f11d6e1dfdd033fa21280ec21d225",
} as const;

/** S4 — THE CROSSING, scroll-driven: the section pins and YOUR scroll
    carries the amber attestation from C-Chain to the Dispatch gate.
    Arrival lights the gate. The product's aha-moment, played by the user. */
export function CrossingBand({ data }: { data: DashboardData }) {
  const { t } = useI18n();
  const secRef = useRef<HTMLElement>(null);
  const travRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!secRef.current || !travRef.current || !innerRef.current) return;
    if (reduced) {
      travRef.current.style.left = "100%";
      innerRef.current.classList.add("arrived");
      return;
    }
    const st = ScrollTrigger.create({
      trigger: secRef.current,
      start: "top top+=56",
      end: "+=160%",
      pin: true,
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        if (travRef.current) travRef.current.style.left = `${Math.min(100, p * 112)}%`;
        innerRef.current?.classList.toggle("arrived", p > 0.88);
      },
    });
    return () => st.kill();
  }, []);

  const latest = data.carried[0];
  const txHash = latest?.txHash ?? FIRST_CROSSING.txHash;
  const messageID = latest?.messageID ?? FIRST_CROSSING.messageID;

  return (
    <section className="crossing-band" id="crossing" ref={secRef}>
      <div className="crossing-inner" ref={innerRef}>
        <div className="chead">
          <span>
            {t("cross_head")} <b>{t("cross_head_tag")}</b>
          </span>
          <span>{t("cross_right")}</span>
        </div>

        <div className="route">
          <div className="terminus">
            <div className="glyph">C</div>
            <div className="tname">Fuji C-Chain</div>
            <div className="trole">{t("cross_hub_role")}</div>
          </div>
          <div className="path" aria-hidden="true">
            <span className="plabel">{t("cross_icm")}</span>
            <div className="traveller" ref={travRef} data-ice-glow>
              <span className="tscore">100</span>
            </div>
          </div>
          <div className="terminus gate-side">
            <div className="glyph">D</div>
            <div className="tname">Dispatch L1</div>
            <div className="trole">{t("cross_gate_role")}</div>
            <div className="arrived-chip">✓ {t("hero_cleared")}</div>
          </div>
        </div>

        <div className="evidence">
          <div className="ecard">
            <div className="elabel">{t("ev1_label")}</div>
            <div className="evalue">
              <a href={`https://testnet.snowtrace.io/tx/${txHash}`} target="_blank" rel="noreferrer">
                {short(txHash, 12, 8)}
              </a>
            </div>
            <div className="esub">{t("ev1_sub")}</div>
          </div>
          <div className="ecard">
            <div className="elabel">{t("ev2_label")}</div>
            <div className="evalue">{short(messageID, 12, 8)}</div>
            <div className="esub">{t("ev2_sub")}</div>
          </div>
          <div className="ecard">
            <div className="elabel">{t("ev3_label")}</div>
            <div className="evalue">{t("ev3_v")}</div>
            <div className="esub">{t("ev3_sub")}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
