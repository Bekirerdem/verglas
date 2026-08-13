# verglas-pay — The Vault in Your Agent's Hands

An MCP server that gives any LLM agent — Claude, GPT, anything that speaks the
Model Context Protocol — a spending envelope it cannot exceed. The agent asks;
the vault contract answers. Keys stay on your machine, rules live on-chain,
refusals come back by name.

## Install

Straight from npm ([`verglas-mcp`](https://www.npmjs.com/package/verglas-mcp)),
nothing to clone — the package is fully self-contained:

```sh
claude mcp add verglas --env PRIVATE_KEY=0x… -- npx verglas-mcp
```

Working from the repo instead: `claude mcp add verglas -- npx tsx <repo>/mcp/index.ts`.

## The four tools

| tool | what it does |
| --- | --- |
| `verglas_status` | the vault's rules (per-payment limit, rolling 24h cap, whitelist), budget spent/left, frozen state |
| `verglas_pay` | pay USDC from the vault — simulate first, then submit; anything outside the rules is refused by name and never leaves |
| `verglas_pay_x402` | buy from any x402-gated API — the payment float refills only through the vault, so the same rules govern x402 buying. See [x402](/x402) |
| `verglas_check` | any agent's public record before you trust it: cleared at the gate, seal score and age, stamp history |

```
> pay 6 USDC to 0x…A1
REFUSED by the vault: PerTxLimitExceeded(6000000, 5000000) — the payment
never left. Rules live in the contract, not in this tool.
```

The refusal is not the server being careful — it simulates and submits; the
*contract* refuses. Delete the server, write your own: the rules hold.

## The key story — never give this server your owner key

The vault knows two roles, and they should be two different keys:

- **Owner** — creates the vault, sets the rules, freezes, withdraws. Lives in
  your wallet, never touches this server.
- **Agent** — the only address allowed to call `spend()`, and only inside the
  rules. *This* is the key you hand to the MCP server.

Generate a fresh key (`cast wallet new`), fund it with a little gas, pass its
address as `agent` when creating the vault in the [console](https://verglas.xyz/app/),
and give its private key to the server via `PRIVATE_KEY`. If the agent key ever
leaks, the damage is capped by the vault's rules, and one `freeze()` from the
owner ends it entirely. For x402 buying the same logic stacks once more: the
agent wallet holds only a tiny float, refilled through the vault on demand.

## Environment

| variable | meaning |
| --- | --- |
| `PRIVATE_KEY` | the **agent key** — must be the vault's `agent` to pay; any key can read |
| `VERGLAS_NETWORK` | `fuji` (default) or `avalanche` |
| `VERGLAS_AGENT_ID` | default agent id for status/pay/check (default `219`) |
| `VERGLAS_X402_AGENT_ID` | the x402 float vault's agent id (default `223`) |
