import type { DashboardData } from "../lib/data";
import { short } from "../lib/format";

/** The first live crossing, kept as permanent evidence even after the
    recent-log scan window slides past it. */
const FIRST_CROSSING = {
  txHash: "0x2aeb3d600565d7ff6e811383476deba71b6e9228893cdb19d8ddebed1dd3191b",
  messageID: "0x5f4f7344087ba93a30969ee6f849df4fed3f11d6e1dfdd033fa21280ec21d225",
} as const;

/** S4 — THE CROSSING. A night-textured band inside the daylight body:
    the route itself, with on-chain evidence. */
export function CrossingBand({ data }: { data: DashboardData }) {
  const latest = data.carried[0];
  const txHash = latest?.txHash ?? FIRST_CROSSING.txHash;
  const messageID = latest?.messageID ?? FIRST_CROSSING.messageID;

  return (
    <section className="crossing-band" id="crossing">
      <div className="crossing-inner will-reveal">
        <div className="chead">
          <span>
            03 · THE CROSSING <b>[ LIVE ROUTE ]</b>
          </span>
          <span>ONE PROOF → EVERY L1</span>
        </div>

        <div className="route">
          <div className="terminus">
            <div className="glyph">C</div>
            <div className="tname">Fuji C-Chain</div>
            <div className="trole">HUB · PROOF VERIFIED HERE</div>
          </div>
          <div className="path" aria-hidden="true">
            <span className="plabel">INTERCHAIN MESSAGING</span>
            <span className="flow" />
            <span className="flow" />
          </div>
          <div className="terminus">
            <div className="glyph">D</div>
            <div className="tname">Dispatch L1</div>
            <div className="trole">GATE · CLEARANCE CHECKED HERE</div>
          </div>
        </div>

        <div className="evidence">
          <div className="ecard">
            <div className="elabel">CARRY TX · C-CHAIN</div>
            <div className="evalue">
              <a href={`https://testnet.snowtrace.io/tx/${txHash}`} target="_blank" rel="noreferrer">
                {short(txHash, 12, 8)}
              </a>
            </div>
            <div className="esub">the attestation leaves the hub</div>
          </div>
          <div className="ecard">
            <div className="elabel">ICM MESSAGE</div>
            <div className="evalue">{short(messageID, 12, 8)}</div>
            <div className="esub">signed by the validator set — no bridge</div>
          </div>
          <div className="ecard">
            <div className="elabel">DELIVERY</div>
            <div className="evalue">seconds, by public relayer</div>
            <div className="esub">gate checked it live, top of this page</div>
          </div>
        </div>
      </div>
    </section>
  );
}
