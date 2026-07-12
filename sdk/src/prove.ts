import { buildPoseidon, type Poseidon } from "circomlibjs";
import { groth16, type Groth16Proof } from "snarkjs";
import type { Address } from "viem";
import type { Groth16Calldata } from "./client.js";

/** Circuit #1 (policy_compliance) window size and whitelist capacity. */
export const WINDOW_SIZE = 64;
export const WHITELIST_SIZE = 8;

export interface Spend {
  to: Address | bigint;
  amount: bigint;
}

export interface PolicyWindow {
  spends: Spend[];
  whitelist: (Address | bigint)[];
  perTxLimit: bigint;
  /** Commitment at the last proven checkpoint; 0n for a fresh account. */
  initialCommitment?: bigint;
}

let poseidonPromise: Promise<Poseidon> | undefined;
async function poseidon(): Promise<Poseidon> {
  poseidonPromise ??= buildPoseidon();
  return poseidonPromise;
}

const toField = (v: Address | bigint): bigint => (typeof v === "bigint" ? v : BigInt(v));

/**
 * Folds spends into the Poseidon hash chain exactly like
 * VerglasAccount.spend() does on-chain:
 *   leaf = Poseidon(to, amount); c = Poseidon(c_prev, leaf)
 */
export async function foldChain(spends: Spend[], initialCommitment = 0n): Promise<bigint> {
  const p = await poseidon();
  const hash2 = (a: bigint, b: bigint) => p.F.toObject(p([a, b]));
  let chain = initialCommitment;
  for (const s of spends) {
    chain = hash2(chain, hash2(toField(s.to), s.amount));
  }
  return chain;
}

/** Witness input for circuit #1, padded to the fixed window size. */
export async function buildCircuitInput(window: PolicyWindow) {
  const { spends, perTxLimit } = window;
  const initialCommitment = window.initialCommitment ?? 0n;
  if (spends.length === 0 || spends.length > WINDOW_SIZE) {
    throw new Error(`prove: spend count must be 1..${WINDOW_SIZE}`);
  }
  if (window.whitelist.length === 0 || window.whitelist.length > WHITELIST_SIZE) {
    throw new Error(`prove: whitelist length must be 1..${WHITELIST_SIZE}`);
  }

  const finalCommitment = await foldChain(spends, initialCommitment);
  const pad = (values: bigint[], length: number) =>
    values.concat(Array<bigint>(length - values.length).fill(0n));

  const input = {
    initialCommitment,
    finalCommitment,
    txCount: BigInt(spends.length),
    whitelist: pad(window.whitelist.map(toField), WHITELIST_SIZE),
    perTxLimit,
    to: pad(spends.map((s) => toField(s.to)), WINDOW_SIZE),
    amount: pad(spends.map((s) => s.amount), WINDOW_SIZE),
  };
  return { input, finalCommitment };
}

/**
 * Generates a Groth16 proof for the window and returns it in the exact
 * shape VerglasHub.submitProof expects. Node-only (loads wasm/zkey from
 * disk); the artifacts live in the repo's build/ directory.
 */
export async function proveWindow(
  window: PolicyWindow,
  artifacts: { wasmPath: string; zkeyPath: string },
): Promise<{ calldata: Groth16Calldata; proof: Groth16Proof; publicSignals: string[] }> {
  const { input } = await buildCircuitInput(window);
  const serialized = JSON.parse(
    JSON.stringify(input, (_, v: unknown) => (typeof v === "bigint" ? v.toString() : v)),
  ) as Record<string, unknown>;

  const { proof, publicSignals } = await groth16.fullProve(serialized, artifacts.wasmPath, artifacts.zkeyPath);
  return { calldata: toCalldata(proof, publicSignals), proof, publicSignals };
}

/**
 * snarkjs proof -> Solidity verifier calldata. G2 coordinates are swapped
 * per element, matching snarkjs' exportSolidityCallData.
 */
export function toCalldata(proof: Groth16Proof, publicSignals: string[]): Groth16Calldata {
  const b = (v: string | undefined): bigint => {
    if (v === undefined) throw new Error("prove: malformed proof");
    return BigInt(v);
  };
  return {
    pA: [b(proof.pi_a[0]), b(proof.pi_a[1])],
    pB: [
      [b(proof.pi_b[0]?.[1]), b(proof.pi_b[0]?.[0])],
      [b(proof.pi_b[1]?.[1]), b(proof.pi_b[1]?.[0])],
    ],
    pC: [b(proof.pi_c[0]), b(proof.pi_c[1])],
    publicSignals: publicSignals.map((s) => BigInt(s)),
  };
}
