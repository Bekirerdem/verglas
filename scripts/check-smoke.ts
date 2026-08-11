// Smoke check for VerglasClient.checkAgent against the live Fuji/Echo pair.
// Usage: npx tsx scripts/check-smoke.ts [agentId]
import { VerglasClient } from "../sdk/src/index.js";

async function main() {
  const id = BigInt(process.argv[2] ?? "222");
  const c = VerglasClient.fuji();
  const r = await c.checkAgent(id);
  console.log(
    JSON.stringify(
      {
        ...r,
        agentId: r.agentId.toString(),
        attestation: r.attestation && {
          ...r.attestation,
          finalCommitment: r.attestation.finalCommitment.toString(),
          txCount: r.attestation.txCount.toString(),
          issuedAt: r.attestation.issuedAt.toString(),
        },
      },
      null,
      2,
    ),
  );
  if (!r.attestation) {
    console.error(`agent #${id}: no attestation on the hub`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("[check-smoke]", e);
  process.exit(1);
});
