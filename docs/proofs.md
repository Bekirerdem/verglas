# Proof System

One Groth16 proof compresses an entire spending window — up to 64 payments — into a single
~287K-gas verification that any chain can check without replaying the history.

::: warning What the proof does and does not hide (read this first)
The circuit keeps `to[]` and `amount[]` as **private witnesses**, but `VerglasAccount.spend()`
emits a public `Spend(to, amount, …)` event and moves real ERC-20 tokens, so on Fuji and
C-Chain today **every individual payment is already public on-chain** — the console's own
history view is built from those events.

So the proof's value today is **succinctness and portability**, not confidentiality: a gate on
another L1 accepts "this vault obeyed its whitelist and per-payment limit across N payments"
without importing N events, and an ERC-8004 validation response carries that claim to any
third party. Confidential amounts require the transfers themselves to be private
(encrypted-balance tokens); that is a roadmap item, not a property of this release.
:::

## The commitment chain

`VerglasAccount.spend()` folds every transfer into a Poseidon hash chain, on-chain, at spend time:

```
leaf = Poseidon(to, amount)
c    = Poseidon(c_prev, leaf)        // c starts at 0
```

History cannot be rewritten, reordered, or cherry-picked afterwards — the chain is the accumulator (an "all-of-many" structure; a Merkle tree would prove membership, not completeness).

## The circuit

`policy_compliance.circom` — `PolicyCompliance(N=64, WL=8)`, 86,037 constraints, compiled with circom 2.2.3.

**Public signals (12):**

| Index | Signal |
| --- | --- |
| 0 | `initialCommitment` — checkpoint before the window |
| 1 | `finalCommitment` — the account's live commitment |
| 2 | `txCount` — spends in this window |
| 3–10 | `whitelist[8]` — the account's payee slots |
| 11 | `perTxLimit` |

**Private inputs:** `to[64]`, `amount[64]` — private *to the circuit* (see the warning above:
the same payments are visible in the vault's own events).

**What it proves:** starting from `initialCommitment`, folding `txCount` spends yields `finalCommitment`, AND every folded spend went to a whitelisted destination with `amount ≤ perTxLimit`. Amounts are range-checked to 128 bits.

## State binding on-chain

`VerglasHub._verifyWindow` refuses any proof that doesn't match live reality:

- `publicSignals[0]` must equal the stored checkpoint (no replay);
- `publicSignals[1]` must equal `account.commitment()` right now (no proving stale windows);
- `publicSignals[2]` must equal the live tx-count delta;
- `publicSignals[3..10]` and `[11]` must equal the account's actual whitelist and limit (no policy spoofing).

Only then does the Groth16 verifier run (~287K gas). On success the checkpoint advances and the ERC-8004 Validation Registry receives the stamp (Fuji: the reference deployment; mainnet: the Verglas-run, reference-compatible one — see [Contracts](/contracts)).

## What is deliberately NOT in the circuit

Total budget, daily caps, freeze state, and the FX circuit breaker are enforced **on-chain at spend time** — they don't need privacy, so they don't pay constraints. The circuit only carries the privacy-sensitive checks: destination membership and per-tx amounts.

## Proving in practice

- Node: `@verglas/sdk/prove` (`proveWindow`, `toCalldata`) or the reference script `scripts/prove.js`.
- Artifacts: `build/policy_compliance_js/`, `build/policy_compliance.zkey`, `build/vkey.json` (ptau from the Polygon zkEVM mirror — the Hermez S3 is dead).
- Poseidon parity between circomlibjs (off-chain) and `poseidon-solidity` (on-chain) is bit-exact and covered by tests.

## Trusted setup status

::: danger Testnet setup — single contributor
The current `policy_compliance.zkey` has **one phase-2 contribution** (`verglas-m1`), made by
the project itself. Whoever holds that contribution's secret could forge a proof for arbitrary
public signals — i.e. mint a score-100 attestation for a vault that never complied. Soundness
therefore rests on trusting the project today, which is exactly the assumption the Hub is
meant to remove.

This is acceptable for a testnet milestone and is a **mainnet blocker**: a multi-party
ceremony (independent contributors + a public beacon) must run before real funds ride on the
attestations. Verify what you are trusting with
`snarkjs zkey verify build/policy_compliance.r1cs build/pot17.ptau build/policy_compliance.zkey`.
:::
