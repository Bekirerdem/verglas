# Proof System

One Groth16 proof covers an entire spending window without revealing a single transaction.

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

**Private inputs:** `to[64]`, `amount[64]` — the actual transactions stay private.

**What it proves:** starting from `initialCommitment`, folding `txCount` spends yields `finalCommitment`, AND every folded spend went to a whitelisted destination with `amount ≤ perTxLimit`. Amounts are range-checked to 128 bits.

## State binding on-chain

`VerglasHub._verifyWindow` refuses any proof that doesn't match live reality:

- `publicSignals[0]` must equal the stored checkpoint (no replay);
- `publicSignals[1]` must equal `account.commitment()` right now (no proving stale windows);
- `publicSignals[2]` must equal the live tx-count delta;
- `publicSignals[3..10]` and `[11]` must equal the account's actual whitelist and limit (no policy spoofing).

Only then does the Groth16 verifier run (~287K gas). On success the checkpoint advances and the canonical ERC-8004 Validation Registry receives the stamp.

## What is deliberately NOT in the circuit

Total budget, daily caps, freeze state, and the FX circuit breaker are enforced **on-chain at spend time** — they don't need privacy, so they don't pay constraints. The circuit only carries the privacy-sensitive checks: destination membership and per-tx amounts.

## Proving in practice

- Node: `@verglas/sdk/prove` (`proveWindow`, `toCalldata`) or the reference script `scripts/prove.js`.
- Artifacts: `build/policy_compliance_js/`, `build/policy_compliance.zkey`, `build/vkey.json` (ptau from the Polygon zkEVM mirror — the Hermez S3 is dead).
- Poseidon parity between circomlibjs (off-chain) and `poseidon-solidity` (on-chain) is bit-exact and covered by tests.
