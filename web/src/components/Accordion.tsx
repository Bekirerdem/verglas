import { useState } from "react";

const PANELS = [
  {
    num: "01",
    tag: "STANDARD",
    title: ["OPEN,", "NOT OWNED"],
    body:
      "Identity and validation live on ERC-8004 registries anyone can read and any explorer can index. No permission to integrate, no platform to marry.",
    foot: "[ ERC-8004 · OPEN SOURCE ]",
  },
  {
    num: "02",
    tag: "REPUTATION",
    title: ["PROOF,", "NOT PROMISE"],
    body:
      "A trust score here is a Groth16 proof verified on-chain — the contract refuses to stamp anything it can't verify. Not a roadmap slide.",
    foot: "[ GROTH16 · VERIFIED ON-CHAIN ]",
  },
  {
    num: "03",
    tag: "REACH",
    title: ["TRAVELS,", "NOT WALLED"],
    body:
      "Attestations cross to any Avalanche L1 over native Interchain Messaging. No bridge, no re-onboarding, no citizenship test per chain.",
    foot: "[ ICM · EVERY L1 ]",
  },
  {
    num: "04",
    tag: "USAGE",
    title: ["REAL WORK,", "NOT FARMING"],
    body:
      "The first resident of the vault is a corporate treasurer: real money, owner-set rules, weekly proof receipts. Usage you can audit, not airdrop volume.",
    foot: "[ VERGLAS TREASURER · NEXT ]",
  },
];

/** avax/business signature module: one wide open panel, the rest collapsed
    as vertical strips. Click to switch. */
export function Accordion() {
  const [open, setOpen] = useState(0);
  const p = PANELS[open];

  return (
    <section className="acc" id="why">
      <div className="acc-head will-reveal">
        <h2>
          There are two ways to make an agent trusted:
          <span className="dim"> build a wall around it — </span>
          <em>or hand it papers every border accepts.</em>
        </h2>
      </div>

      <div className="acc-row will-reveal">
        <div className="acc-open" key={p.num}>
          <div className="acc-num">{p.num}</div>
          <div className="acc-body">
            <h3>
              {p.title[0]}
              <br />
              <span className="hl">{p.title[1]}</span>
            </h3>
            <div className="acc-side">
              <p>{p.body}</p>
              <div className="acc-foot">{p.foot}</div>
            </div>
          </div>
        </div>
        {PANELS.map((panel, i) =>
          i === open ? null : (
            <button key={panel.num} className="acc-strip" onClick={() => setOpen(i)} aria-label={`Open panel ${panel.num}`}>
              <span className="snum">{panel.num}</span>
              <span className="stag">{panel.tag}</span>
            </button>
          ),
        )}
      </div>
    </section>
  );
}
