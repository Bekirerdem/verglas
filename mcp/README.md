# verglas-pay — MCP server

Give any LLM agent a spending envelope it cannot exceed. The agent asks;
the vault contract answers. Keys stay on your machine, rules live on-chain,
refusals come back by name.

## Tools

| tool | what it does |
| --- | --- |
| `verglas_status` | the vault's rules, budget spent/left, frozen state, whitelist |
| `verglas_pay` | pay USDC from the vault — the contract enforces whitelist, per-payment limit, daily limit, budget, freeze |
| `verglas_pay_x402` | buy from any x402-gated API — the payment float refills only through the vault, so the same rules govern x402 buying |
| `verglas_check` | any agent's public record: cleared at the gate, seal score/age, stamp history |

## Install

From npm (once published):

```sh
claude mcp add verglas --env PRIVATE_KEY=0x… -- npx verglas-mcp
```

From the repo:

```sh
npm install            # in mcp/
claude mcp add verglas -- npx tsx <repo>/mcp/index.ts
```

Environment (process env; inside the repo, the root `.env` also works):

- `PRIVATE_KEY` — the **agent key** (see below). Must be the `agent` of the
  vault to pay; any key can read.
- `VERGLAS_NETWORK` — `fuji` (default) or `avalanche`.
- `VERGLAS_AGENT_ID` — default agent id for status/pay/check (default `219`).
- `VERGLAS_X402_AGENT_ID` — the x402 float vault's agent id (default `223`).

## The key story — never give this server your owner key

The vault knows two roles and they should be two different keys:

- **Owner** — creates the vault, sets the rules, freezes, withdraws. This key
  lives in your wallet and never touches this server.
- **Agent** — the only address allowed to call `spend()`, and only inside the
  rules. *This* is the key you hand to the MCP server.

Setup: generate a fresh key (`cast wallet new`), fund it with a little gas,
and pass its address as `agent` when you create the vault in the
[console](https://verglas.xyz/app/). Give the private key to this server via
`PRIVATE_KEY`. If the agent key ever leaks, the damage is capped by the
vault's rules — per-payment limit, daily limit, budget, whitelist — and one
`freeze()` from the owner ends it entirely. For x402 buying the same logic
stacks once more: the agent wallet holds only a tiny float, refilled through
the vault on demand.

## What it looks like

```
> pay 0.25 USDC to 0x…A1
PAID 0.25 USDC to 0x…A1
  tx: https://testnet.snowtrace.io/tx/0xfe59…
  budget after: 6.8 USDC of 10 USDC

> pay 6 USDC to 0x…A1
REFUSED by the vault: PerTxLimitExceeded(6000000, 5000000) — the payment
never left. Rules live in the contract, not in this tool.

> fetch https://verglas-x402-demo.l3ekirerdem.workers.dev/frost-report
float refill through vault (agent #223):
  PAID 0.01 USDC to 0xc092…2Ad6
PAID 0.01 USDC over x402 to 0x26e5…709B
  settlement tx: https://testnet.snowtrace.io/tx/0xb5f2…
```

The refusal is not this server being careful — `verglas_pay` simulates and
submits; the *contract* refuses. Delete this server, write your own, the
rules hold.

## Smoke run

```sh
npx tsx smoke.ts            # reads + two named refusals, nothing spent
npx tsx smoke.ts --pay 0.25 # …plus one real in-rule payment
npx tsx smoke.ts --x402 <url> # …plus a real paid fetch through the float vault
```

## Publishing

`npm run build` bundles the server (SDK inlined) into `dist/index.js`;
`npm publish` runs it automatically. The package ships as `verglas-mcp`
with a matching `npx` bin.
