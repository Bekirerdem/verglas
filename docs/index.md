# What is Verglas?

Verglas is the **trust layer for agent money on Avalanche**. It gives an AI agent a rule-bound vault, proves the agent's spending stayed inside the owner's rules with a zero-knowledge proof, and carries that attestation across Avalanche L1s over native Interchain Messaging — so trust earned on one chain clears gates on every other.

**The one-sentence version:** give your agent a vault instead of a wallet — the brake stays with you, the proof lives on-chain, and it travels.

## Why it exists

Agents have started moving real money. Today there are two ways to trust them: build a wall around a closed platform, or believe a whitepaper. Neither survives contact with a second chain, a second team, or an auditor.

Verglas replaces both with **papers every border accepts**:

1. **The vault** (`VerglasAccount`) — the owner sets the rules in the contract: payee whitelist, per-transaction limit, total budget, an unconditional freeze. The agent's only door to the funds is `spend()`, and every rule is checked there.
2. **The receipt** — every spend folds into a Poseidon hash chain. Once a week (or whenever), a Groth16 proof opens the whole window: *every destination was whitelisted, every amount was under the limit* — without revealing a single transaction.
3. **The passport** — the proof is verified on-chain and stamped into the **canonical ERC-8004 Validation Registry**. From there the attestation crosses to any Avalanche L1 over ICM, and a `VerglasGate` on the far side answers one view call: `isCleared(agentId)`.

## What's live today

The core pipeline runs on **Avalanche C-Chain mainnet**; the cross-L1 crossing runs end to end on testnet (Fuji → Echo). No mocks anywhere:

| Piece | Status |
| --- | --- |
| Agent identity | Real ERC-721 ids on the canonical ERC-8004 Identity Registry — agent #1783 on mainnet, #219/#220/#222 on Fuji |
| Vault + spends | Circle USDC, real transfers on both networks |
| Proof | Groth16 verified on-chain (~287K gas), stamped into the ERC-8004 Validation Registry on mainnet and Fuji |
| Border crossing | ICM carry from Fuji C-Chain to the Echo L1, `isCleared` returns `true` — the keeper aggregates the Warp signature and delivers the message itself, no relayer needed |
| Treasurer (V2) | Live FX-timed supplier payment inside an on-chain USD/TRY circuit breaker, fed by the keeper-signed `VerglasOracle` shim |

Want your own vault instead of reading about ours? [Quickstart — ten minutes on Fuji](/quickstart). To reproduce the whole pipeline from a terminal, see [Run the Live Demo](/demo).

## The two product surfaces

- **The trust machine** — for L1 operators and agent developers: register, bind a vault, prove windows, and let any chain check clearance with one call. See [Architecture](/architecture).
- **Verglas Treasurer** — the first resident of the vault: an autonomous corporate treasurer paying FX-timed supplier invoices inside owner-set daily caps and an oracle-checked FX circuit breaker. See [Verglas Treasurer](/treasurer).
