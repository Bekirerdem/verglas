// Verglas keeper — one-shot stamp for a single agent.
// Usage: npx tsx stamp.ts <agentId> [--no-carry]
import { clients, stampAgent } from "./lib.js";

const agentId = BigInt(process.argv[2] ?? "221");
const carry = !process.argv.includes("--no-carry");
const { pub, wallet } = clients();

stampAgent(pub, wallet, agentId, { carry }).then(
  (result) => {
    console.log(result === "stamped" ? "STAMPED ✓ — score 100 on the canonical registry" : `nothing to do: ${result}`);
    process.exit(result === "stamped" ? 0 : 1);
  },
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
