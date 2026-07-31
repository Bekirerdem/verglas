# Run the Live Demo

Reproduce the full pipeline on Fuji: vault → real USDC spends → on-chain Groth16 proof → canonical 8004 stamp → ICM crossing → gate clearance.

## Prerequisites

- Foundry (v1.7.1 — same as CI) and Node 20+;
- a funded deployer key in `.env` (`PRIVATE_KEY=...`): AVAX from the [Builder Hub faucet](https://build.avax.network/tools/faucet), **USDC from [faucet.circle.com](https://faucet.circle.com)** (Avalanche Fuji, ~10–20 USDC/day), and a little ECH on Echo for the gate deploy;
- `npm ci` at the repo root (circuit tooling) and in `sdk/`, `agent/`, `web/` as needed.

## 1. Deploy the hub side

```bash
forge script script/DeployFuji.s.sol --rpc-url fuji-c --broadcast
```

Deploys the verifier + hub, creates the vault against real USDC, **registers a fresh agentId on the canonical ERC-8004 Identity Registry**, binds it, and opens the validation window. Note the printed `agentId` and addresses.

## 2. Prove a window

```bash
node scripts/prove.js   # regenerates proof calldata for the fixed demo window (3/2/1 USDC)
ACCOUNT_ADDRESS=<vault> HUB_ADDRESS=<hub> AGENT_ID=<id> \
  forge script script/E2EFuji.s.sol --tc E2EFuji --rpc-url fuji-c --broadcast
```

Three real USDC spends, then `submitProof` — Groth16 verified on-chain, response stamped into the canonical Validation Registry.

## 3. Cross the border

```bash
HUB_ADDRESS=<hub> forge script script/DeployGate.s.sol --rpc-url echo --broadcast
cast send <hub> "carryAttestation(uint256,bytes32,address)" <agentId> \
  0x1278d1be4b987e847be3465940eb5066c4604a7fbd6e086900823597d81af4c1 <gate> \
  --rpc-url fuji-c --private-key $PRIVATE_KEY
```

`carryAttestation` must be a raw `cast send` — Foundry's local EVM can't execute the Warp precompile. After the relayer delivers:

```bash
cast call <gate> "isCleared(uint256)(bool)" <agentId> --rpc-url echo   # → true
```

> Public testnet relayer delivery has been flaky historically. If nothing arrives in ~10 minutes, run your own `icm-relayer` (ava-labs/icm-services) against Fuji-C → Echo and re-send the carry.

## 4. The treasurer vertical

```bash
HUB_ADDRESS=<hub> forge script script/DeployTreasurerFuji.s.sol --rpc-url fuji-c --broadcast
cd agent && TREASURER_ADDRESS=<treasurer> DAYS_TO_DEADLINE=0 npm run tick
```

The keeper fetches Hermes USD/TRY, runs the strategy, and executes a live `payFX` — Pyth updated on-chain, circuit breaker checked, daily cap enforced, vault pays the supplier.

## 5. Watch it on the site

`web/` (`npm run dev`) renders everything live: hero clearance status, the crossing, and the treasurer panel — all straight from Fuji.

::: warning Attestations expire
The gate enforces `maxAge = 7 days`. For a stage demo, prove a fresh window + carry that morning.
:::
