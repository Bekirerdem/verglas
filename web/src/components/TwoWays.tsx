/** S2 — TWO WAYS. The nameless comparison: walls vs papers.
    Four measurable differences, avax-grammar numbered cards. */
export function TwoWays() {
  return (
    <section className="twoways">
      <p className="tag">
        01 · TWO WAYS <i>[ WALLS · OR · PAPERS ]</i>
      </p>
      <h2 className="will-reveal">
        There are two ways to make an agent trusted:
        <span className="dim"> build a wall around it —</span>{" "}
        <em>or hand it papers every border accepts.</em>
      </h2>

      <div className="diff-grid">
        <div className="diff-card will-reveal">
          <div className="dnum">01 · STANDARD</div>
          <h4>Open, not owned</h4>
          <p>
            Identity and validation live on <b>ERC-8004</b> registries anyone can read and any
            explorer can index. No permission to integrate, no platform to marry.
          </p>
          <div className="foot">[ ERC-8004 · OPEN SOURCE ]</div>
        </div>
        <div className="diff-card will-reveal">
          <div className="dnum">02 · REPUTATION</div>
          <h4>Proof, not promise</h4>
          <p>
            A trust score here is a <b>Groth16 proof verified on-chain</b> — the contract refuses
            to stamp anything it can't verify. Not a roadmap slide.
          </p>
          <div className="foot">[ GROTH16 · VERIFIED ON-CHAIN ]</div>
        </div>
        <div className="diff-card will-reveal">
          <div className="dnum">03 · REACH</div>
          <h4>Travels, not walled</h4>
          <p>
            Attestations cross to <b>any Avalanche L1</b> over native Interchain Messaging. No
            bridge, no re-onboarding, no citizenship test per chain.
          </p>
          <div className="foot">[ ICM · EVERY L1 ]</div>
        </div>
        <div className="diff-card will-reveal">
          <div className="dnum">04 · USAGE</div>
          <h4>Real work, not farming</h4>
          <p>
            The first resident of the vault is a <b>corporate treasurer</b>: real money, owner-set
            rules, weekly proof receipts. Usage you can audit, not airdrop volume.
          </p>
          <div className="foot">[ VERGLAS TREASURER · NEXT ]</div>
        </div>
      </div>
    </section>
  );
}
