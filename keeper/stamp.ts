// Verglas keeper — the stamp run. For a given agentId: read the open
// validation window, rebuild the spend window from chain events, generate
// the Groth16 policy-compliance proof and submit it through the Hub, which
// writes the score-100 response into the canonical ERC-8004 Validation
// Registry. Then carry the attestation to the Dispatch gate over ICM.
//
// Usage: npx tsx stamp.ts <agentId> [--no-carry]
// Reads PRIVATE_KEY from ../.env (any funded key — submitProof is permissionless).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createPublicClient, createWalletClient, http, keccak256, parseAbiItem, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  BLOCKCHAIN_IDS,
  FUJI_DEPLOYMENT,
  fujiC,
  validationRegistryAbi,
  verglasAccountAbi,
  verglasHubAbi,
} from "@verglas/sdk";
import { proveWindow } from "@verglas/sdk/prove";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const D = FUJI_DEPLOYMENT;
const CHUNK = 2000n;

const spendEvent = parseAbiItem(
  "event Spend(address indexed to, uint256 amount, uint256 indexed txIndex, uint256 newCommitment)",
);

function envKey(): `0x${string}` {
  const line = readFileSync(join(ROOT, ".env"), "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("PRIVATE_KEY="));
  if (!line) throw new Error("PRIVATE_KEY not found in .env");
  const raw = line.slice("PRIVATE_KEY=".length).trim();
  return (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
}

async function main() {
  const agentId = BigInt(process.argv[2] ?? "221");
  const carry = !process.argv.includes("--no-carry");

  const pub = createPublicClient({ chain: fujiC, transport: http() });
  const signer = privateKeyToAccount(envKey());
  const wallet = createWalletClient({ chain: fujiC, transport: http(), account: signer });

  // 1. Resolve the vault and its rules.
  const account = await pub.readContract({
    address: D.hub,
    abi: verglasHubAbi,
    functionName: "accountOf",
    args: [agentId],
  });
  if (account === "0x0000000000000000000000000000000000000000") {
    throw new Error(`agent ${agentId}: no bound account on the Hub`);
  }
  const acct = { address: account, abi: verglasAccountAbi } as const;
  const [perTxLimit, wlLen, cp] = await Promise.all([
    pub.readContract({ ...acct, functionName: "perTxLimit" }),
    pub.readContract({ ...acct, functionName: "whitelistLength" }),
    pub.readContract({ address: D.hub, abi: verglasHubAbi, functionName: "checkpoints", args: [account] }),
  ]);
  const whitelist = await Promise.all(
    Array.from({ length: Number(wlLen) }, (_, i) =>
      pub.readContract({ ...acct, functionName: "whitelist", args: [BigInt(i)] }),
    ),
  );
  const [cpCommitment, cpTxCount] = cp;
  console.log(`agent #${agentId} vault ${account}`);
  console.log(`checkpoint: commitment=${cpCommitment} txCount=${cpTxCount}`);

  // 2. Find the open validation request (response still 0).
  const hashes = await pub.readContract({
    address: D.validationRegistry,
    abi: validationRegistryAbi,
    functionName: "getAgentValidations",
    args: [agentId],
  });
  let requestHash: `0x${string}` | undefined;
  for (const h of hashes) {
    const s = await pub.readContract({
      address: D.validationRegistry,
      abi: validationRegistryAbi,
      functionName: "getValidationStatus",
      args: [h],
    });
    if (s[2] === 0) requestHash = h; // response==0 => still open
  }
  if (!requestHash) throw new Error("no open validation request — open the stamp line first");
  console.log(`open request: ${requestHash}`);

  // 3. Rebuild the spend window from events (txIndex >= checkpoint).
  const head = await pub.getBlockNumber();
  const logs = [];
  for (let from = D.deployBlock; from <= head; from += CHUNK) {
    const to = from + CHUNK - 1n < head ? from + CHUNK - 1n : head;
    logs.push(...(await pub.getLogs({ address: account, event: spendEvent, fromBlock: from, toBlock: to })));
  }
  const spends = logs
    .map((l) => ({ txIndex: l.args.txIndex!, to: l.args.to!, amount: l.args.amount! }))
    .sort((a, b) => (a.txIndex < b.txIndex ? -1 : 1))
    .filter((s) => s.txIndex >= cpTxCount)
    .map((s) => ({ to: s.to, amount: s.amount }));
  if (spends.length === 0) throw new Error("empty window — make at least one payment first");
  console.log(`window: ${spends.length} spend(s)`);

  // 4. Prove.
  console.log("proving (Groth16, ~86k constraints)…");
  const { calldata, publicSignals } = await proveWindow(
    { spends, whitelist, perTxLimit, initialCommitment: cpCommitment },
    {
      wasmPath: join(ROOT, "build", "policy_compliance_js", "policy_compliance.wasm"),
      zkeyPath: join(ROOT, "build", "policy_compliance.zkey"),
    },
  );
  console.log("proof ready; finalCommitment =", publicSignals[1]);

  // 5. Submit — the Hub verifies on-chain and stamps the canonical registry.
  const responseHash = keccak256(toHex(publicSignals.join(",")));
  const submitHash = await wallet.writeContract({
    address: D.hub,
    abi: verglasHubAbi,
    functionName: "submitProof",
    args: [
      agentId,
      requestHash,
      calldata.pA,
      calldata.pB,
      calldata.pC,
      calldata.publicSignals as unknown as readonly [
        bigint, bigint, bigint, bigint, bigint, bigint,
        bigint, bigint, bigint, bigint, bigint, bigint,
      ],
      "verglas:policy-compliance",
      responseHash,
    ],
  });
  console.log("submitProof tx:", submitHash);
  const rc = await pub.waitForTransactionReceipt({ hash: submitHash });
  console.log("submitProof status:", rc.status);
  if (rc.status !== "success") process.exit(1);

  // 6. Carry the stamp across the border.
  if (carry) {
    const carryHash = await wallet.writeContract({
      address: D.hub,
      abi: verglasHubAbi,
      functionName: "carryAttestation",
      args: [agentId, BLOCKCHAIN_IDS.dispatch, D.gateOnDispatch],
    });
    console.log("carryAttestation tx:", carryHash);
    const rc2 = await pub.waitForTransactionReceipt({ hash: carryHash });
    console.log("carry status:", rc2.status);
  }

  console.log("STAMPED ✓ — score 100 on the canonical registry");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
