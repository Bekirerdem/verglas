import { useState } from "react";
import { useI18n, type TKey } from "../lib/i18n";
import { TEXTURE_VIDEO, REDUCED } from "../lib/media";

const KEYS = ["acc1", "acc2", "acc3", "acc4"] as const;
const NUMS = ["01", "02", "03", "04"];

/** avax/business signature module: one wide open panel with a living ice
    texture flowing inside, the rest collapsed as vertical strips. */
export function Accordion() {
  const { t } = useI18n();
  const [open, setOpen] = useState(0);
  const k = KEYS[open];

  return (
    <section className="acc" id="why">
      <div className="acc-head will-reveal">
        <h2>
          {t("acc_head_1")}
          <span className="dim">{t("acc_head_2")}</span>
          <em>{t("acc_head_3")}</em>
        </h2>
      </div>

      <div className="acc-row will-reveal">
        <div className="acc-open" key={k}>
          {!REDUCED() && <video className="panel-video" src={TEXTURE_VIDEO} autoPlay muted loop playsInline />}
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
