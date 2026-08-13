// verglas-pay — an MCP server that gives an LLM agent a spending envelope
// it cannot exceed. The agent asks; the vault contract answers. Keys stay on
// this machine, rules live on-chain, refusals come back by name.
// Install:  claude mcp add verglas -- npx tsx <repo>/mcp/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkAgent, DEFAULT_AGENT_ID, pay, payX402, vaultStatus, X402_AGENT_ID } from "./core.js";

const server = new McpServer({ name: "verglas", version: "0.1.0" });

const agentIdArg = z
  .string()
  .regex(/^\d+$/)
  .optional()
  .describe(`ERC-8004 agent id; defaults to ${DEFAULT_AGENT_ID}`);
const asId = (s?: string) => (s ? BigInt(s) : DEFAULT_AGENT_ID);
const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (e: unknown) => ({
  content: [{ type: "text" as const, text: `error: ${e instanceof Error ? e.message : String(e)}` }],
  isError: true,
});

server.registerTool(
  "verglas_status",
  {
    description:
      "Read the agent's Verglas vault: rules (per-payment limit, whitelist), budget spent/left, frozen state, and whether this machine's key is the vault's agent.",
    inputSchema: { agentId: agentIdArg },
  },
  async ({ agentId }) => {
    try {
      return text(await vaultStatus(asId(agentId)));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "verglas_pay",
  {
    description:
      "Pay USDC from the agent's Verglas vault. The vault contract enforces the rules: whitelist-only recipients, per-payment limit, total budget, freeze. A payment outside the rules is refused by name and never leaves.",
    inputSchema: {
      to: z.string().describe("recipient address (must be on the vault's whitelist)"),
      usdc: z.string().describe('amount in USDC, e.g. "0.5"'),
      agentId: agentIdArg,
    },
  },
  async ({ to, usdc, agentId }) => {
    try {
      return text(await pay(asId(agentId), to, usdc));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "verglas_pay_x402",
  {
    description:
      "Pay a 402-gated (x402) API and return its response. The payment float lives in the agent's wallet and is refilled only through the Verglas vault, so the vault's rules — budget, per-payment limit, freeze — govern x402 spending too. A vault refusal comes back by name and stops the payment.",
    inputSchema: {
      url: z.string().url().describe("the paid endpoint to call"),
      maxUsdc: z
        .string()
        .regex(/^\d+(\.\d+)?$/)
        .optional()
        .describe('per-call price cap in USDC, e.g. "0.05" (default "0.10")'),
      agentId: z
        .string()
        .regex(/^\d+$/)
        .optional()
        .describe(`x402 float vault's agent id; defaults to ${X402_AGENT_ID}`),
    },
  },
  async ({ url, maxUsdc, agentId }) => {
    try {
      return text(await payX402(agentId ? BigInt(agentId) : X402_AGENT_ID, url, maxUsdc ?? "0.10"));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "verglas_check",
  {
    description:
      "Check any agent's public Verglas record before trusting it: cleared or not at the gate, latest seal score and age, full stamp history.",
    inputSchema: { agentId: agentIdArg },
  },
  async ({ agentId }) => {
    try {
      return text(await checkAgent(asId(agentId)));
    } catch (e) {
      return fail(e);
    }
  },
);

// stdout belongs to the protocol; anything human goes to stderr.
console.error(`verglas-pay up — network ${process.env.VERGLAS_NETWORK ?? "fuji"}, default agent #${DEFAULT_AGENT_ID}`);
await server.connect(new StdioServerTransport());
