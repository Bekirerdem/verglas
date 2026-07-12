// Verglas — circuit #1 witness builder + prover.
// Builds a sample spend window, folds the Poseidon chain exactly like
// VerglasAccount.spend() does on-chain, generates a Groth16 proof and
// verifies it. Usage: node scripts/prove.js
const path = require("path");
const fs = require("fs");
const { buildPoseidon } = require("circomlibjs");
const snarkjs = require("snarkjs");

const N = 64;
const WL = 8;
const BUILD = path.join(__dirname, "..", "build");

async function main() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const hash2 = (a, b) => F.toObject(poseidon([a, b]));

  // Sample window: mirrors the Foundry test scenario (fixed addresses).
  const dexA = BigInt("0x00000000000000000000000000000000000000A1");
  const dexB = BigInt("0x00000000000000000000000000000000000000B2");
  const whitelist = [dexA, dexB, 0n, 0n, 0n, 0n, 0n, 0n];
  const perTxLimit = 200_000_000n; // 200e6
  const spends = [
    { to: dexA, amount: 100_000_000n },
    { to: dexB, amount: 50_000_000n },
    { to: dexA, amount: 25_000_000n },
  ];

  // Fold the chain: leaf = Poseidon(to, amount); c = Poseidon(c_prev, leaf)
  let chain = 0n;
  for (const s of spends) {
    chain = hash2(chain, hash2(s.to, s.amount));
  }

  const input = {
    initialCommitment: 0n,
    finalCommitment: chain,
    txCount: BigInt(spends.length),
    whitelist,
    perTxLimit,
    to: pad(spends.map((s) => s.to)),
    amount: pad(spends.map((s) => s.amount)),
  };

  console.log("finalCommitment =", chain.toString());

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    stringify(input),
    path.join(BUILD, "policy_compliance_js", "policy_compliance.wasm"),
    path.join(BUILD, "policy_compliance.zkey")
  );

  const vkey = JSON.parse(fs.readFileSync(path.join(BUILD, "vkey.json")));
  const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  console.log("snarkjs verify:", ok ? "OK" : "FAILED");
  if (!ok) process.exit(1);

  // Emit Solidity calldata for the on-chain verifier test.
  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  fs.writeFileSync(path.join(BUILD, "proof_calldata.txt"), calldata);
  fs.writeFileSync(path.join(BUILD, "proof.json"), JSON.stringify(proof, null, 2));
  fs.writeFileSync(path.join(BUILD, "public.json"), JSON.stringify(publicSignals, null, 2));
  console.log("calldata written to build/proof_calldata.txt");
  process.exit(0);
}

function pad(arr) {
  const out = arr.slice();
  while (out.length < N) out.push(0n);
  return out;
}

function stringify(obj) {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
