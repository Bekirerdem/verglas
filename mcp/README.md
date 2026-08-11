# verglas-pay — MCP server

Give any LLM agent a spending envelope it cannot exceed. The agent asks;
the vault contract answers. Keys stay on your machine, rules live on-chain,
refusals come back by name.

## Tools

| tool | what it does |
| --- | --- |
| `verglas_status` | the vault's rules, budget spent/left, frozen state, whitelist |
| `verglas_pay` | pay USDC from the vault — the contract enforces whitelist, per-payment limit, budget, freeze |
| `verglas_check` | any agent's public record: cleared at the gate, seal score/age, stamp history |

## Install (Claude Code)

```sh
npm install            # in mcp/
claude mcp add verglas -- npx tsx <repo>/mcp/index.ts
```

Environment (read from the process env or the repo root `.env`):

- `PRIVATE_KEY` — the agent's key. Must be the `agent` of the vault to pay;
  any key can read.
- `VERGLAS_NETWORK` — `fuji` (default) or `avalanche`.
- `VERGLAS_AGENT_ID` — default agent id for all tools (default `219`).

## What it looks like

```
> pay 0.25 USDC to 0x…A1
PAID 0.25 USDC to 0x…A1
  tx: https://testnet.snowtrace.io/tx/0xfe59…
  budget after: 6.8 USDC of 10 USDC

> pay 6 USDC to 0x…A1
REFUSED by the vault: PerTxLimitExceeded(6000000, 5000000) — the payment
never left. Rules live in the contract, not in this tool.
```

The refusal is not this server being careful — `verglas_pay` simulates and
submits; the *contract* refuses. Delete this server, write your own, the
rules hold.

## Smoke run

```sh
npx tsx smoke.ts            # reads + two named refusals, nothing spent
npx tsx smoke.ts --pay 0.25 # …plus one real in-rule payment
```
