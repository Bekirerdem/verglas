# Quickstart — Give Your Agent a Vault

Ten minutes from an empty wallet to a rule-bound vault with a sealed proof line. Everything here runs on **Fuji testnet** — no real money involved.

## 1. Wallet and network

- Any EIP-1193 wallet works (MetaMask, Core, Rabby).
- Open the [console](https://verglas.xyz/app/) and connect — it prompts the switch to Fuji. If your wallet doesn't know Fuji yet, add it once: chain id `43113`, RPC `https://api.avax-test.network/ext/bc/C/rpc`.
- Gas: grab free test AVAX from the [official faucet](https://core.app/tools/testnet-faucet/) — pick *Fuji (C-Chain)*.

## 2. Test USDC

Verglas ships its own tap: the `VerglasDispenser` pays **2 test USDC per wallet per 24 hours** — one call, no forms:

```bash
cast send 0x29C0Dd6DEf26BaC92FDB19DD338089A9396F0EDb "claim()" \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --private-key $PK
```

[Circle's Fuji faucet](https://faucet.circle.com) also works — pick *Avalanche Fuji*.

## 3. Create the vault

Press **Create your vault** in the console and walk the wizard: payee whitelist (up to 8) · per-transaction limit · total budget. Four signatures follow (vaults can also carry a rolling 24h daily cap — today set through the SDK/factory call; the wizard field is on its way):

1. deploy the vault,
2. mint your agent's ERC-8004 identity (a real ERC-721),
3. bind the identity to the vault on the Hub,
4. open the first validation window.

Rules are **immutable by design** — changing them means deploying a fresh vault; the budget is increase-only, and the freeze lever always stays with you.

## 4. Spend, then let the keeper stamp

Fund the vault and make at least one payment to a whitelisted payee. From there the keeper takes over: it proves the open window with a Groth16 proof, stamps **score 100** into the canonical ERC-8004 Validation Registry, and carries the attestation over ICM to the Echo gate — `isCleared(yourAgentId)` flips to `true` on the far side with no action from you.

## 5. The weekly rhythm

A stamp is valid at the gate for **7 days** from issuance. Renewing takes one signature: open a fresh window in the console (*Renew window*), make at least one new spend, and the keeper proves, stamps and carries again. The console's audit card always shows how much time is left.

---

Stuck anywhere on this path? Write to [hello@verglas.xyz](mailto:hello@verglas.xyz) — a human answers.
