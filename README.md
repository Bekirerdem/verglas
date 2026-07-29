# Verglas

**The trust fabric between Avalanche L1s — agents change chains, their trust travels with them.**

> *verglas (n.) — a thin, clear, hard coating of ice. Clear as glass, hard as ice.*

Avalanche is not one chain; it is a federation of sovereign L1s. An agent that earns trust
on one chain is a stranger on every other. Verglas fixes that:

- **VerglasAccount** — a bounded spend account: the owner sets the rules *in the contract*
  (per-tx limit, whitelist, total budget, kill-switch), the agent spends inside them, and
  every spend is folded into a Poseidon hash chain.
- **Verglas Hub** *(C-Chain)* — verifies a weekly ZK proof ("every spend obeyed the policy —
  without revealing a single transaction") and writes the attestation to the ERC-8004
  Validation Registry.
- **Verglas Gate** *(any L1)* — an ICM receiver: admits external agents only with a valid
  Verglas attestation. Prove once on C-Chain, pass every gate in the federation.

*Kite walls trust in. Verglas lets it travel.*

## Status

**M1 complete — live on Fuji.** Full pipeline verified end-to-end on testnet: vault → real
spends → ZK proof (Groth16, ~86k constraints) → attestation in the Validation Registry →
ICM carry → gate clearance on a second L1 (Dispatch).

- Console: https://verglas.xyz/app · Landing: https://verglas.xyz · Docs: https://verglas.xyz/docs
- Live Fuji addresses: [`deployments/fuji-testnet.md`](deployments/fuji-testnet.md)

## Development

```bash
npm ci          # poseidon-solidity
forge test
```
