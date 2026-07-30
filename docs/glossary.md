# Naming & Glossary

Every name in Verglas belongs to one physical metaphor: money crossing a border. The owner locks funds in a **vault**, each spend prints a **receipt**, the week's receipts fold into a **passport**, and any chain's **gate** reads that passport at the border. This page defines every contract, circuit and role behind those four words.

> **Verglas** — a thin, clear, hard glaze of ice on rock. *Clear as glass, hard as ice.* The rules are visible through the layer; the layer does not crack.

## The three layers at a glance

<div class="vg-layers">
  <div class="vg-layer"><b>1 · The Vault</b><span>Holds the money and enforces the owner's rules on every spend. <code>VerglasAccount</code>, <code>VerglasFactory</code>, <code>VerglasTreasurer</code>.</span></div>
  <div class="vg-layer"><b>2 · The Proof</b><span>Turns a window of spends into one zero-knowledge receipt. The Poseidon commitment, circuit #1, <code>Groth16Verifier</code>.</span></div>
  <div class="vg-layer"><b>3 · The Trust Rail</b><span>Carries the receipt as a passport other chains accept. <code>VerglasHub</code>, <code>ValidationRegistry</code>, the attestation, <code>VerglasGate</code>.</span></div>
</div>

## Layer 1 — The Vault

Where the money sits and where the owner's rules are law.

| Name | Type | What it is |
| --- | --- | --- |
| `VerglasAccount` | contract | The vault itself. |
| `VerglasFactory` | contract | The "create a vault" door. |
| `VerglasTreasurer` | contract | A treasury brain that runs *on top of* a vault. |
| `VerglasDispenser` | contract | A testnet-only USDC tap for workshops. |

### VerglasAccount — *the vault*

A bounded spend account for one AI agent. The **owner** sets the rules in the constructor and they are welded shut: a payee **whitelist** (≤ 8 addresses), a **per-transaction limit**, a **total budget**, and an unconditional **freeze**. The agent's only door to the funds is `spend(to, amount)`, and every rule is checked there before a single token moves. The owner can `freeze()` at any moment and `withdraw()` even while frozen — funds are never locked away from their owner.

*In the metaphor:* the safe with the rules engraved on the inside of the door.

### VerglasFactory — *the vault maker*

One call, `createVault(...)`, deploys a fresh `VerglasAccount` whose owner is the caller. The factory holds no funds, has no owner, and can never touch a vault after birth — it only remembers who created what, so the console can list "my vaults."

### VerglasTreasurer — *the treasury brain*

The first real resident of a vault. The treasurer *is* an account's `agent`, so it adds two treasury-grade rules the vault itself does not know about — a **per-calendar-day cap** and an **FX circuit-breaker** checked against a live USD/TRY price (read through the `IPyth` interface, served by the VerglasOracle shim since the July 2026 Pyth cutover) — then delegates to `account.spend()`, where the whitelist, limit, budget and freeze still apply. Composition, not modification: `VerglasAccount` stays untouched, so the treasurer's vault inherits the weekly proof machinery unchanged. If the owner freezes the vault directly, the treasurer's payments stop no matter what — the vault's brake always wins.

### VerglasDispenser — *the tap*

A small testnet convenience: anyone can claim a fixed USDC drip once per cooldown for the live workshop. Not a product surface; it exists so demo attendees can fund a vault in seconds.

## Layer 2 — The Proof

How a week of private spends becomes one public receipt that reveals nothing.

| Name | Type | What it is |
| --- | --- | --- |
| Commitment | on-chain state | A Poseidon hash chain over every spend. |
| Circuit #1 (`policy_compliance`) | ZK circuit | The statement being proven. |
| `Groth16Verifier` | contract | The on-chain proof checker. |

### The commitment — *the sealed ledger*

Every `spend` folds into a running **Poseidon hash chain**: `leaf = Poseidon(to, amount)`, then `commitment = Poseidon(previous, leaf)`. The chain is a tamper-evident seal over the exact sequence of spends — you cannot cherry-pick, reorder, or drop one without changing the final value. Public counters (`txCount`, `totalSpent`) sit alongside it so budget and count rules are enforced instantly on-chain, outside the circuit.

### Circuit #1 — *policy_compliance*

The zero-knowledge circuit (Circom, N = 64 window, WL = 8) that proves the sentence **"every destination in this window was on the whitelist, and every amount was under the per-transaction limit"** — without revealing a single individual transaction. Only the privacy-sensitive checks live in the circuit; budget and tx-count are cheaper to enforce with the public counters above.

### Groth16Verifier — *the proof checker*

The generated on-chain verifier for circuit #1. `submitProof` hands it the proof and public signals; it returns true only for a mathematically valid proof (~287K gas). No trust, no oracle — the math either holds or it doesn't.

## Layer 3 — The Trust Rail

How the receipt becomes a passport that a *different* chain accepts at its border.

| Name | Type | What it is |
| --- | --- | --- |
| `VerglasHub` | contract | The trustless validator on C-Chain. |
| `ValidationRegistry` | contract | The ERC-8004 registry the attestation is stamped into. |
| Attestation | on-chain record | The signed "this window passed" result. |
| `AttestationPacket` | struct | The attestation packaged for cross-chain travel. |
| `VerglasGate` | contract | The border checkpoint an L1 installs. |
| Checkpoint | on-chain state | The proven window boundary. |

### VerglasHub — *the border authority*

The validator that cannot vouch for anyone by choice. A validation response is written **only** after (1) the proof's public inputs are bound to the *live* vault state — the window must start at the last checkpoint and end exactly at the current chain head, over the account's real whitelist and limit — and (2) the Groth16 proof verifies on-chain. Anyone may submit a proof; the attestation is objective. The Hub also `bindAccount`s an ERC-8004 identity to its vault and `carryAttestation`s the result to gates over ICM. Rebinding an identity to a *different* vault deletes its attestation, because the claim named the old vault. (Trusted-setup caveat: see [Proof System](/proofs).)

### ValidationRegistry — *the stamp book*

Verglas's deployment of the **ERC-8004 Validation Registry**. Avalanche has canonical Identity and Reputation registries but no canonical Validation registry — Verglas deploys one, event-compatible with the reference implementation so ERC-8004 explorers index it as-is. The agent's owner requests validation from a chosen validator (the Hub); only that validator can respond. The Hub's score-100 response lands here.

### Attestation — *the passport itself*

The record the Hub writes for an agent: `{ finalCommitment, txCount, score, issuedAt }`. It says "as of this timestamp, this agent's window passed policy at score 100." It is public and objective — which is why anyone is allowed to pay to carry it.

### AttestationPacket — *the passport in an envelope*

The compact struct the attestation is encoded into for its ICM journey. The Hub encodes it, the gate on the far side decodes it — one shared shape so the two sides never disagree on the wire format.

### VerglasGate — *the border checkpoint*

What an Avalanche L1 operator installs to accept Verglas trust. It receives carried attestations over ICM and answers local contracts one view call: `isCleared(agentId)` — does this agent hold a fresh, sufficient passport? All trust parameters (`minScore`, `maxAge`, which Hub to trust) are fixed at deployment; the gate has no owner and no setters. Authenticity rests on three checks: the caller is the canonical Teleporter, the message came from the Hub's chain, and the original sender was the Hub contract.

### Checkpoint — *the last stamped page*

The Hub's memory of how far an account has already been proven: `{ commitment, txCount }`. The next proof must start exactly where the last one ended, so windows tile perfectly with no gap and no overlap — you cannot re-prove old spends or skip new ones.

## Identity & actors

Who holds what, across the whole system.

| Term | What it means |
| --- | --- |
| **agentId** | An ERC-8004 identity — a real ERC-721 token on Avalanche's canonical Identity Registry. Verglas runs agents **#219** (demo) and **#220** (treasurer). |
| **owner** | The human. Sets the vault's rules, holds the freeze and the exit. |
| **agent** | The address allowed to spend — a bot, or the `VerglasTreasurer`. |
| **operator** (keeper) | The rotatable key the treasurer allows to trigger FX payments. Rotating it never touches funds. |
| **ERC-8004** | The open, chain-agnostic agent-trust standard (Identity + Reputation + Validation). Verglas fills the Validation gap on Avalanche. |

## Supporting infrastructure

Canonical contracts and interfaces Verglas builds on rather than owns.

| Name | Role |
| --- | --- |
| **ICM / Teleporter** | Avalanche's native Interchain Messaging — how a passport crosses from C-Chain to another L1. |
| `ITeleporterMessenger` | Interface for *sending* an ICM message (used by the Hub's `carryAttestation`). |
| `ITeleporterReceiver` | Interface for *receiving* one (implemented by `VerglasGate`). |
| `IPyth` | The Pyth-compatible oracle interface the treasurer reads its live USD/TRY price through. Since the July 2026 Pyth cutover it is implemented by **VerglasOracle**, a keeper-signed shim fed from independent FX references. |
| **Poseidon / BN254** | The ZK-friendly hash and elliptic-curve field the commitment and circuit are built on. |

Every contract lives in [`src/`](https://github.com/Bekirerdem/verglas) — Solidity 0.8.25, no proxies, no upgradability, custom errors, Foundry-tested. See [Contracts & Addresses](/contracts) for the live Fuji deployment.
