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
const state = await client.getAccountState();   // owner, agent, limits, commitment, frozen, whitelist
const att   = await client.getAttestation(219n); // latest hub attestation (requestHash, commitment, txCount, score, issuedAt)
const val   = await client.getValidationStatus(requestHash); // canonical 8004 registry stamp
```

## Writes (need a wallet client)

```ts
await client.spend(to, amount);                       // as the vault's agent
await client.submitProof(agentId, requestHash, ...);  // prove a window
await client.carryAttestation(agentId, destBlockchainId, gate); // ICM carry to a gate
```

## Proving (Node only)

Deliberately split so browser bundles stay clean:

```ts
import { proveWindow, toCalldata } from "@verglas/sdk/prove";

const { proof, publicSignals } = await proveWindow({ spends, whitelist, perTxLimit, initialCommitment });
const calldata = toCalldata(proof, publicSignals); // ready for submitProof
```

Requires the `build/` circuit artifacts (wasm + zkey). Window shape: `N=64` spends, `WL=8` whitelist slots — mirrors the circuit 1:1.

## Constants

`FUJI_DEPLOYMENT` (hub, verifier, account, usdc, agentId, deployBlock), `TREASURER_DEPLOYMENT` (treasurer, account, agentId, pyth, usdTryPriceId), `NETWORKS` (per-network deployments; the gate entry carries its own chain + explorer), `BLOCKCHAIN_IDS` (fujiC, dispatch, echo), `TELEPORTER_ADDRESS`, `IDENTITY_REGISTRY_ADDRESS` — all checksummed, all covered by tests (`npm test`; add `VERGLAS_LIVE=1` for a live smoke against Fuji).
