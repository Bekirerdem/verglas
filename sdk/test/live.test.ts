import { describe, expect, it } from "vitest";
import { FUJI_DEPLOYMENT } from "../src/chains.js";
import { VerglasClient } from "../src/client.js";

// Read-only smoke against the live Fuji/Dispatch deployment.
// Opt-in (network access): VERGLAS_LIVE=1 npm test
const live = process.env.VERGLAS_LIVE === "1";

describe.skipIf(!live)("live Fuji deployment", () => {
  const client = VerglasClient.fuji();

  it("reads the demo account state", { timeout: 30_000 }, async () => {
    const state = await client.getAccountState();
    expect(state.txCount).toBeGreaterThanOrEqual(3n);
    expect(state.whitelist.length).toBeGreaterThan(0);
    expect(state.perTxLimit).toBe(5_000_000n);
  });

  it("reads the live attestation", { timeout: 30_000 }, async () => {
    const att = await client.getAttestation(FUJI_DEPLOYMENT.agentId);
    expect(att).not.toBeNull();
    expect(att!.score).toBe(100);
    expect(att!.txCount).toBeGreaterThanOrEqual(3n);
  });

  it("the demo agent clears the Dispatch gate", { timeout: 30_000 }, async () => {
    expect(await client.isCleared(FUJI_DEPLOYMENT.agentId)).toBe(true);
  });
});
