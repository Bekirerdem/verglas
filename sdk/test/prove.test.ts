import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { buildCircuitInput, foldChain, proveWindow, WHITELIST_SIZE, WINDOW_SIZE } from "../src/prove.js";

// The fixed window of scripts/prove.js and the Foundry tests — the chain is
// deterministic, so this commitment is a cross-stack test vector (it also
// matches the on-chain PoseidonT3 fold, proven by the contract tests).
const KNOWN_WINDOW = {
  spends: [
    { to: 0xa1n, amount: 100_000_000n },
    { to: 0xb2n, amount: 50_000_000n },
    { to: 0xa1n, amount: 25_000_000n },
  ],
  whitelist: [0xa1n, 0xb2n],
  perTxLimit: 200_000_000n,
};
const KNOWN_FINAL_COMMITMENT = 0x26c940775b3a475a598ceabb052a8fb0c9669be2ae1e5b182a51bc1900848e03n;

const wasmPath = fileURLToPath(new URL("../../build/policy_compliance_js/policy_compliance.wasm", import.meta.url));
const zkeyPath = fileURLToPath(new URL("../../build/policy_compliance.zkey", import.meta.url));
const hasArtifacts = existsSync(wasmPath) && existsSync(zkeyPath);

afterAll(async () => {
  // snarkjs/ffjavascript keep curve workers alive; terminate so vitest exits.
  const curve = (globalThis as Record<string, unknown>).curve_bn128 as
    | { terminate(): Promise<void> }
    | undefined;
  await curve?.terminate();
});

describe("foldChain", () => {
  it("reproduces the on-chain Poseidon chain for the known window", async () => {
    expect(await foldChain(KNOWN_WINDOW.spends)).toBe(KNOWN_FINAL_COMMITMENT);
  });

  it("chains from a non-zero checkpoint", async () => {
    const first = await foldChain(KNOWN_WINDOW.spends.slice(0, 1));
    const rest = await foldChain(KNOWN_WINDOW.spends.slice(1), first);
    expect(rest).toBe(KNOWN_FINAL_COMMITMENT);
  });
});

describe("buildCircuitInput", () => {
  it("lays out and pads the witness like scripts/prove.js", async () => {
    const { input, finalCommitment } = await buildCircuitInput(KNOWN_WINDOW);
    expect(finalCommitment).toBe(KNOWN_FINAL_COMMITMENT);
    expect(input.initialCommitment).toBe(0n);
    expect(input.txCount).toBe(3n);
    expect(input.whitelist).toHaveLength(WHITELIST_SIZE);
    expect(input.whitelist.slice(0, 3)).toEqual([0xa1n, 0xb2n, 0n]);
    expect(input.to).toHaveLength(WINDOW_SIZE);
    expect(input.amount).toHaveLength(WINDOW_SIZE);
    expect(input.to[3]).toBe(0n);
    expect(input.perTxLimit).toBe(200_000_000n);
  });

  it("rejects an empty or oversized window", async () => {
    await expect(buildCircuitInput({ ...KNOWN_WINDOW, spends: [] })).rejects.toThrow(/1\.\./);
    await expect(
      buildCircuitInput({ ...KNOWN_WINDOW, whitelist: Array(WHITELIST_SIZE + 1).fill(0xa1n) }),
    ).rejects.toThrow(/whitelist/);
  });
});

describe.skipIf(!hasArtifacts)("proveWindow (requires build/ artifacts)", () => {
  it("produces a proof whose public signals bind the window", { timeout: 120_000 }, async () => {
    const { calldata, publicSignals } = await proveWindow(KNOWN_WINDOW, { wasmPath, zkeyPath });
    expect(calldata.publicSignals).toHaveLength(12);
    expect(calldata.publicSignals[0]).toBe(0n); // initialCommitment
    expect(calldata.publicSignals[1]).toBe(KNOWN_FINAL_COMMITMENT);
    expect(calldata.publicSignals[2]).toBe(3n); // txCount
    expect(calldata.publicSignals[11]).toBe(200_000_000n); // perTxLimit
    expect(publicSignals).toHaveLength(12);
  });
});
