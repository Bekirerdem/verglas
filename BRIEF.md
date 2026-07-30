# Verglas — project brief

*Agent trust that travels. Prove once, pass every gate.*

Live on Avalanche C-Chain mainnet since **30 July 2026**. Everything below is
checkable on Snowtrace — no claim here rests on a screenshot.

- Repo: <https://github.com/Bekirerdem/verglas> (public, MIT)
- Site: <https://verglas.xyz> · console <https://verglas.xyz/app> · docs <https://verglas.xyz/docs>
- Builder: Ebubekir Erdem (solo), Team1 Collaborator

---

## What it is, in one paragraph

Avalanche is not one chain; it is a federation of sovereign L1s. An AI agent that
earns trust on one chain arrives as a stranger on every other. Verglas gives an
agent a **rule-bound, non-custodial vault**, proves its spending obeyed the
owner's policy with a **zero-knowledge proof**, records the result as an
**ERC-8004 validation attestation**, and carries that attestation across the
federation over **ICM** — so trust earned once is honored everywhere.

The owner never gives up custody. The agent can spend, only inside rules welded
into the contract, and every proof is bound to those rules.

## Why it is Avalanche-shaped, not a port

The problem it solves — *the same agent has to re-earn trust on every L1* —
only exists on a network of sovereign L1s. On a single-chain network there is
nothing to carry. ICM is the transport, and the attestation is the payload.
There is no bridge, no custodian, no second trust assumption: an L1 answers
`isCleared(agentId)` in one view call.

## What is live on mainnet (43114)

| Contract | Address |
|---|---|
| VerglasHub | `0x2b6466EC93C064f67C260c30613593460252169C` |
| ValidationRegistry (ours) | `0x332fc886dd6ab933c89a1149e7D938a6B4214a01` |
| Groth16Verifier | `0xa24972871B987cC7feD401Ea8e46F6D85F88a24C` |
| VerglasOracle | `0x31900CA6bBd05ac2516feB6798f6aeB86FD41239` |
| VerglasFactory | `0xc07ef259Eb88742e00113d9F460F5D2081078960` |
| Identity Registry | canonical ERC-8004 `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| USDC | Circle official `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` |

Agent identities are real ERC-721s on the **canonical ERC-8004 Identity
Registry** that is already live on C-Chain. The Validation Registry is ours
because **no chain has a canonical one** — the reference repo lists none
anywhere, and that half of the spec is still being revised with the TEE
community. That gap is the opening Verglas sits in.

## Traction so far (all mainnet, all verifiable)

Two vaults, two agents, **six real USDC payments to three different recipients**,
two Groth16 proofs verified on-chain, two score-100 attestations.

- **Agent #1783** — vault `0x004cd1dA…C3c5`, 2 payments, proof verified in
  tx `0x3419e9d3…` (621,090 gas), score 100.
- **Agent #1784** — vault `0x0Fa45841…Ad68`, whitelist of three, **4 payments to
  two different people**, budget spent to exhaustion (1.2/1.2), the whole window
  proven in one shot: tx `0x0f29a119…` (627,905 gas), score 100.

The second one is the stronger artifact: money that actually left the owner's
control, to more than one recipient, under contract-enforced rules, with a
single zero-knowledge receipt covering the entire window.

Also live: **Fuji testnet + a VerglasGate on the Dispatch L1**, where the full
cross-chain leg has run end to end — prove on C-Chain → ICM carry → a second
chain answers `isCleared(agentId) = true`.

## Engineering facts

- **Circom/Groth16 policy-compliance circuit**, 86,037 constraints, up to 64
  payments per proof. It proves: *every spend went to an approved payee, under
  the per-payment limit.*
- On-chain verification ≈ **290k gas**; a full attestation transaction ≈ **625k gas**.
- Spends fold into an on-chain **Poseidon hash chain**, `c = P(c_prev, P(to, amount))`.
  A hash *chain*, not a Merkle tree, on purpose: the claim is completeness
  ("all of these"), which a membership proof cannot make.
- **92 Foundry tests + 11 SDK tests**, CI green, MIT licensed.
- Full mainnet deploy cost: **7,856,126 gas = 0.000429 AVAX (~$0.003)** at a
  0.052 gwei base fee. Rehearsed on an anvil mainnet fork before spending
  anything real.
- Structure (whitelist, per-payment limit) is immutable because every proof is
  bound to it; the budget is refillable, so a vault is not single-use.

## On AVAX burn

Every verified proof burns base fee permanently. At today's ~0.05 gwei that is
fractions of a cent per proof, so the one-off number is not the story. The
structural point is that the burn is **recurring and tied to real economic
activity** — one proof per agent per window, per chain that gates on it — rather
than to speculation. The quantity worth modelling is *proofs × chains × weeks*,
not a single transaction.

## Honest limits (please do not overclaim these)

- The circuit keeps payments as private witnesses, but the vault emits a public
  `Spend` event. Today the proof buys **succinctness and portability, not
  confidentiality**. Confidential mode is designed, not shipped.
- The trusted setup currently has a **single phase-2 contribution**. That is a
  real blocker at scale until a multi-party ceremony runs.
- Mainnet is live but young and **unaudited**; the amounts on it are
  deliberately small.

Both are documented publicly at <https://verglas.xyz/docs/proofs>.

## Where it sits next to Kite

Kite (~$33M raised, an Avalanche L1) is the closest category comparison. Kite is
the **spending** side with a closed identity stack; Verglas is the
**verification** side and is open. *Kite walls trust in. Verglas lets it travel.*
By definition a platform cannot be the neutral validator of its own agents,
which is the seat Verglas takes.

## Roadmap

- **M1 — done.** Contracts, circuit, SDK, first end-to-end validation, mainnet
  addresses public, two proof→attestation runs.
- **M2 — in progress.** Real usage: external agent operators running their own
  vaults, a hosted always-on keeper, onboarding a stranger can finish unaided,
  and a validation skill integrated into Ömer's `agentic-avax`.
- **M3.** Cross-L1 attestation carry as a product surface — a `VerglasGate`
  deployed per partner L1, `isCleared` as border control for the federation.

## What would help most

1. Introductions to **L1 operators** and agent teams who need to admit agents
   they did not issue.
2. A line into the ERC-8004 working group — we are running the Validation
   Registry half that has no canonical deployment yet.
3. Grant support for the multi-party trusted-setup ceremony and an audit; those
   are the two things that stand between this and real money.
