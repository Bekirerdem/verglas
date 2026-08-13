# Architecture

Verglas is a hub-and-gate system: trust is **earned once** on the C-Chain and **checked anywhere** on Avalanche.

```
        Fuji C-Chain (hub side)                     Any Avalanche L1
┌────────────────────────────────────┐         ┌─────────────────────┐
│  VerglasAccount (vault)            │         │  VerglasGate        │
│    spend() → Poseidon chain        │         │    isCleared(id)?   │
│                                    │   ICM   │                     │
│  VerglasHub                        │ ══════> │  minScore, maxAge   │
│    submitProof (Groth16 verify)    │         │  trusts ONE hub     │
│    → canonical 8004 Validation ────┼──┐      └─────────────────────┘
│    carryAttestation → Teleporter   │  │
│                                    │  │  canonical ERC-8004 registries
│  VerglasTreasurer (V2, optional)   │  └─ Identity (ERC-721 agent ids)
│    payFX → oracle check → spend()  │     Validation (proof stamps)
│                                    │
│  verglas-pay (MCP) · x402 float    │
│    refills ride spend() too        │
└────────────────────────────────────┘
```

## The pieces

### VerglasAccount — the vault
Immutable owner, agent, token, per-tx limit, daily cap (rolling 24h, 0 = none), and total budget; a payee whitelist fixed at construction (max 8 — it fits the circuit's public inputs). `spend()` is the agent's only door: whitelist, limits, daily cap, and budget are enforced on-chain, and every spend folds into the commitment chain (`leaf = Poseidon(to, amount)`, `c = Poseidon(c_prev, leaf)`). The owner can `freeze()` at any moment and `withdraw()` at all times — frozen or not.

### VerglasHub — the prover's desk
`bindAccount(agentId, account)` ties a canonical ERC-8004 identity to a vault (only the vault owner may bind). `submitProof` binds the proof to live state — initial/final commitment, tx-count delta, and the account's actual policy (limit + whitelist) must all match the public signals — then verifies the Groth16 proof on-chain and writes a `validationResponse` (score 100, tag `verglas:policy-compliance`) into the **canonical** ERC-8004 Validation Registry. The hub also keeps `latestAttestation` per agent, which is what travels.

### VerglasGate — the border checkpoint
Deployed on any destination L1 with three immutables: the Teleporter address, the hub's blockchain ID, and the hub address. It accepts attestation packets only from that exact hub over ICM, rejects stale packets, and exposes one view: `isCleared(agentId)` — true while the freshest attestation meets `minScore` within `maxAge` (7 days on the live deployment). No owner, no setters.

### VerglasTreasurer — the treasury brain (V2)
A composition, not a modification: the treasurer **is** the vault's agent. It layers two treasury rules on top — a **calendar-day cap** (owner-adjustable; distinct from the vault's own immutable rolling 24h cap) and an FX circuit breaker checked against the live USD/TRY feed (the keeper-signed `VerglasOracle` shim, read through the IPyth ABI) — then delegates to `spend()`, where the vault's own rules still rule. If the owner freezes the vault, `payFX` stops no matter what state the treasurer is in. See [Verglas Treasurer](/treasurer).

## Trust properties

- **No upgradability anywhere.** Every address is immutable; nothing can be silently swapped. Redeploys are loud by design.
- **The registry speaks ERC-8004, per network.** On Fuji, stamps land in the reference Validation Registry deployment at the ERC-8004 vanity address (`0x8004Cb1B…`); mainnet has no reference Validation deployment yet, so there Verglas runs its own, event- and interface-compatible — either way indexable by any 8004 explorer. Verglas is the first ZK-verified validator writing real proofs into the Validation side of the standard.
- **The gate never trusts a relayer.** Packets arrive over Avalanche's native ICM with validator-set signatures; the gate additionally pins the source chain and hub address.
