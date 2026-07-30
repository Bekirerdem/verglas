<div align="center">

<img src="assets/verglas-mark.png" alt="Verglas" width="112" />

# Verglas

### Agent trust that travels.

*Prove once. Pass every gate.*

[![CI](https://github.com/Bekirerdem/verglas/actions/workflows/test.yml/badge.svg)](https://github.com/Bekirerdem/verglas/actions/workflows/test.yml)
![Avalanche mainnet](https://img.shields.io/badge/Avalanche-C--Chain_mainnet-8B0D1A?style=flat-square)
![ERC-8004](https://img.shields.io/badge/ERC--8004-Validation_Registry-8B0D1A?style=flat-square)
![Groth16](https://img.shields.io/badge/ZK-Groth16_·_86k_constraints-8B0D1A?style=flat-square)
![Tests](https://img.shields.io/badge/tests-92_forge_·_11_sdk-8B0D1A?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-3a3a3a?style=flat-square)

**[verglas.xyz](https://verglas.xyz)** · **[Open the console →](https://verglas.xyz/app)** · **[Docs](https://verglas.xyz/docs)**

<img src="assets/hero.png" alt="Verglas — prove once, pass every gate" width="880" />

</div>

---

> *verglas (n.) — a thin, clear, hard coating of ice. Clear as glass, hard as ice.*

Avalanche is not one chain; it is a federation of sovereign L1s. An agent that earns trust on
one chain arrives as a stranger on every other. Verglas gives an AI agent a **rule-bound,
non-custodial vault**, proves its spending obeyed the owner's policy with a **zero-knowledge
proof**, records the result as an **ERC-8004 validation attestation**, and carries that
attestation across the federation over **ICM** — so trust earned once is honored everywhere.

*Kite walls trust in. Verglas lets it travel.*

## Live on Avalanche mainnet

Not a demo. Real Circle USDC, real agent identities on the canonical ERC-8004 registry, real
proofs verified on-chain.

| | |
|---|---|
| **Hub** | [`0x2b6466EC…169C`](https://snowtrace.io/address/0x2b6466EC93C064f67C260c30613593460252169C) |
| **Validation Registry** | [`0x332fc886…4a01`](https://snowtrace.io/address/0x332fc886dd6ab933c89a1149e7D938a6B4214a01) |
| **Groth16 verifier** | [`0xa2497287…a24C`](https://snowtrace.io/address/0xa24972871B987cC7feD401Ea8e46F6D85F88a24C) |
| **Oracle** | [`0x31900CA6…1239`](https://snowtrace.io/address/0x31900CA6bBd05ac2516feB6798f6aeB86FD41239) |
| **Factory** | [`0xc07ef259…8960`](https://snowtrace.io/address/0xc07ef259Eb88742e00113d9F460F5D2081078960) |
| **Identity** | canonical ERC-8004 [`0x8004A169…a432`](https://snowtrace.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) |

Two vaults, two agents, six real payments, two proofs — every one of them checkable:

- **Agent #1783** — 2 payments, proof verified in [tx `0x3419e9d3…`](https://snowtrace.io/tx/0x3419e9d3a8dda0ba3b83a59a9131bc50c17b798098516bc508611ccf2996528a) (621k gas), score 100.
- **Agent #1784** — a three-payee whitelist, **4 payments to two different people**, budget
  spent to exhaustion, the whole window proven in
  [tx `0x0f29a119…`](https://snowtrace.io/tx/0x0f29a119b285892afca74792e229c3dd4d5b6cbda555c0ad07342db871e2a1e6) (628k gas), score 100.

Full ledger — including the Fuji testnet deployment and its cross-chain gate — in
[`deployments/fuji-testnet.md`](deployments/fuji-testnet.md).

## How it works

```mermaid
flowchart LR
    A[Owner sets policy] --> B[VerglasAccount<br/>agent spends inside rules]
    B --> C[Poseidon hash chain<br/>every spend committed]
    C --> D[Groth16 proof<br/>policy compliance]
    D --> E[VerglasHub · C-Chain<br/>on-chain verify]
    E --> F[ValidationRegistry<br/>ERC-8004 attestation]
    F --> G[ICM carry]
    G --> H[VerglasGate · any L1<br/>isCleared]
```

1. **Vault** — the owner deploys a `VerglasAccount` with hard rules: per-payment limit,
   lifetime budget, payee whitelist, kill-switch. The agent spends inside them and cannot
   renegotiate. Structure (whitelist, per-payment limit) is welded shut at birth because
   every proof is bound to it; the budget is fuel and the owner can top it up.
2. **Receipt** — every spend is folded into an on-chain Poseidon hash chain,
   `c = P(c_prev, P(to, amount))`. A hash *chain*, not a Merkle tree: the claim is
   completeness ("all of these"), which a membership proof cannot make.
3. **Proof** — the keeper rebuilds the spend window and produces one Groth16 proof
   (~86k constraints) for up to 64 payments: *every spend went to an approved payee, under
   the limit.*
4. **Passport** — `VerglasHub` binds the proof's public inputs to live vault state, verifies
   on-chain, and writes an ERC-8004 validation response. It cannot vouch for anyone by
   choice: no valid proof, no attestation.
5. **Gate** — any Avalanche L1 runs a `VerglasGate` (ICM receiver) and answers
   `isCleared(agentId)` in one call — **prove once, pass every gate.**

## The console

<img src="assets/screenshots/console-overview.png" alt="Verglas console — balance, assurance and audit at a glance" width="900" />

Business language on the surface, contracts underneath: balance with a live FX reading, the
rules in plain words with a two-step brake, and the audit card that turns a ZK proof into
"weekly proof ready · independent verification passed".

<img src="assets/screenshots/audit-passport.png" alt="Audit page — the passport band from vault to ZK seal to border gate, and the seal shelf" width="900" />

The audit page tells the whole story: vault → ZK seal → border gate, with the shelf of
amber seals each attestation left behind.

## Contracts

| Contract | Chain | Role |
|---|---|---|
| `VerglasAccount` | any EVM L1 | Non-custodial rule-bound vault; immutable structure, refillable budget, kill-switch |
| `VerglasFactory` | C-Chain | One-transaction vault deployment |
| `VerglasHub` | C-Chain | Proof-gated attestation issuer; ICM carry origin |
| `Groth16Verifier` | C-Chain | On-chain proof verification (~290k gas) |
| `ValidationRegistry` | C-Chain | ERC-8004 Validation Registry (no chain has a canonical one yet) |
| `VerglasOracle` | C-Chain | Keeper-signed IPyth-compatible price feed |
| `VerglasTreasurer` | C-Chain | FX-aware treasury operator (daily cap + rate circuit breaker) |
| `VerglasGate` | any L1 | Three-check ICM receiver; `isCleared` / `isClearedFor` border control |
| `VerglasDispenser` | testnet | Rate-limited test-USDC tap for workshops |

## Repository layout

| Path | Contents |
|---|---|
| `src/` | Solidity contracts (Foundry) |
| `circuits/` | Circom circuit #1 — policy compliance, N=64 spend window |
| `keeper/` | Always-on service: oracle feed, proving, attestation, ICM carry |
| `agent/` | Treasurer strategy + independent FX sources |
| `sdk/` | `@verglas/sdk` — viem client, network registry, browser-safe proving |
| `web/` | Landing + console (Vite/React → verglas.xyz) |
| `docs/` | VitePress documentation |
| `test/` | Foundry test suite (92 tests) |

## Quickstart

```bash
npm ci                      # poseidon-solidity
forge test                  # 92 tests

cd web && npm ci && npm run dev        # console + landing at :5173

# keeper — one pass against a network, or a service loop
cd keeper
VERGLAS_NETWORK=avalanche npx tsx service.ts --once
```

Proving locally also needs `circom` 2.x and the pot17 ptau — see
[`docs/proofs.md`](https://verglas.xyz/docs/proofs).

## Security

- **Non-custodial by construction.** Only the owner withdraws. The agent can only spend
  inside the policy, and the owner's freeze outranks every automation above it.
- **`bindAccount` requires both** ERC-8004 identity ownership *and* vault ownership; binding
  an identity to a different vault deletes its attestation, and attestations name the vault
  they were proven for so a carried copy cannot be repurposed.
- **Honest limits.** The circuit keeps payments as private witnesses, but the vault emits a
  public `Spend` event — today the proof buys succinctness and portability, *not*
  confidentiality. The trusted setup currently has a **single phase-2 contribution**, which
  is a mainnet-scale blocker until a multi-party ceremony runs. Both are documented in
  [Proof System](https://verglas.xyz/docs/proofs).
- Mainnet is live but young and unaudited; the amounts on it are deliberately small.

## License

[MIT](LICENSE)
