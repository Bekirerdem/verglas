# TypeScript SDK

`@verglas/sdk` (in-repo package, `sdk/`) — viem-based reads and writes for every Verglas surface, plus Node-only proving helpers.

## Install & wire

```ts
import { VerglasClient, FUJI_DEPLOYMENT, TREASURER_DEPLOYMENT } from "@verglas/sdk";

const client = VerglasClient.fuji(); // read-only against the live deployment
```

## The one call that matters

```ts
// On any L1 with a VerglasGate — is this agent's trust fresh and sufficient?
const ok = await client.isCleared(FUJI_DEPLOYMENT.agentId); // → true
```

## Reads

```ts
const state = await client.getAccountState();
// owner, agent, token, perTxLimit, dailyLimit, dailySpentNow, totalBudget,
// totalSpent, txCount, commitment, frozen, whitelist.
// dailyLimit/dailySpentNow read 0n on vaults born before the 2026-08-13
// factories — older vaults simply have no daily rule.
const att   = await client.getAttestation(219n); // latest hub attestation (requestHash, commitment, txCount, score, issuedAt)
const val   = await client.getValidationStatus(requestHash); // the 8004 Validation Registry stamp
```

## Writes (need a wallet client)

```ts
await client.spend(to, amount);                       // as the vault's agent
await client.submitProof(agentId, requestHash, ...);  // prove a window
await client.carryAttestation(agentId, destBlockchainId, gate); // ICM carry to a gate
```

## Creating a vault

The current factory (2026-08-13 generation) takes six arguments — the daily
cap slots in between the per-tx limit and the budget:

```ts
import { verglasFactoryAbi, FUJI_DEPLOYMENT } from "@verglas/sdk";

await wallet.writeContract({
  address: FUJI_DEPLOYMENT.factory,
  abi: verglasFactoryAbi,
  functionName: "createVault",
  // agent, token, perTxLimit, dailyLimit (0n = none), totalBudget, whitelist
  args: [agent, FUJI_DEPLOYMENT.usdc, 500_000n, 300_000n, 2_000_000n, [payee]],
});
```

Vaults from the older factories stay visible through `legacyFactories`
(`vaultsOf` is identical across generations; only `createVault` differs —
`verglasLegacyFactoryAbi` speaks the old five-argument shape).

## Proving (Node only)

Deliberately split so browser bundles stay clean:

```ts
import { proveWindow, toCalldata } from "@verglas/sdk/prove";

const { proof, publicSignals } = await proveWindow({ spends, whitelist, perTxLimit, initialCommitment });
const calldata = toCalldata(proof, publicSignals); // ready for submitProof
```

Requires the `build/` circuit artifacts (wasm + zkey). Window shape: `N=64` spends, `WL=8` whitelist slots — mirrors the circuit 1:1.

## Constants

`FUJI_DEPLOYMENT` (hub, validationRegistry, verifier, account, usdc, agentId, deployBlock, factory, legacyFactories, dispenser), `TREASURER_DEPLOYMENT` (treasurer, account, agentId, pyth, usdTryPriceId), `NETWORKS` (per-network deployments; the gate entry carries its own chain + explorer), `BLOCKCHAIN_IDS` (fujiC, dispatch, echo), `TELEPORTER_ADDRESS`, `IDENTITY_REGISTRY_ADDRESS` — all checksummed, all covered by tests (`npm test`; add `VERGLAS_LIVE=1` for a live smoke against Fuji).
