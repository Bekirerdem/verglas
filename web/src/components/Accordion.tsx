import { useEffect, useRef, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useI18n, type TKey } from "../lib/i18n";

const KEYS = ["acc1", "acc2", "acc3", "acc4"] as const;
const NUMS = ["01", "02", "03", "04"];

/** avax signature module, scroll-driven like film: the section pins and
    scrubbing advances the panels 01 -> 04. Strips stay clickable. */
export function Accordion() {
  const { t } = useI18n();
  const [open, setOpen] = useState(0);
  const secRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !secRef.current) return;
    const st = ScrollTrigger.create({
      trigger: secRef.current,
      start: "top top+=56",
      end: "+=220%",
      pin: true,
      scrub: true,
      onUpdate: (self) => {
        setOpen(Math.min(3, Math.floor(self.progress * 4.4)));
      },
    });
    return () => st.kill();
  }, []);

  const k = KEYS[open];

  return (
    <section className="acc" id="why" ref={secRef}>
      <div className="acc-head">
        <h2>
          {t("acc_head_1")}
          <span className="dim">{t("acc_head_2")}</span>
          <em>{t("acc_head_3")}</em>
        </h2>
      </div>

      <div className="acc-row">
        <div className="acc-open" key={k}>
          <div className="acc-num">{NUMS[open]}</div>
          <div className="acc-body">
            <h3>
              {t(`${k}_t1` as TKey)}
              <br />
              <span className="hl">{t(`${k}_t2` as TKey)}</span>
            </h3>
            <div className="acc-side">
              <p>{t(`${k}_body` as TKey)}</p>
              <div className="acc-foot">{t(`${k}_foot` as TKey)}</div>
            </div>
          </div>
          <div className="acc-progress" aria-hidden="true">
            {KEYS.map((_, i) => (
              <i key={i} className={i <= open ? "on" : ""} />
            ))}
          </div>
        </div>
        {KEYS.map((key, i) =>
          i === open ? null : (
            <button key={key} className="acc-strip" onClick={() => setOpen(i)} aria-label={`Panel ${NUMS[i]}`}>
              <span className="snum">{NUMS[i]}</span>
              <span className="stag">{t(`${key}_tag` as TKey)}</span>
            </button>
          ),
        )}
      </div>
    </section>
  );
}
