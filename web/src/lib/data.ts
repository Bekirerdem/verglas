import { erc20Abi, parseAbiItem, type Address, type Hex, type PublicClient } from "viem";
import {
  FUJI_DEPLOYMENT,
  validationRegistryAbi,
  verglasGateAbi,
  VerglasClient,
  type AccountState,
  type Attestation,
} from "@verglas/sdk";

const spendEvent = parseAbiItem(
  "event Spend(address indexed to, uint256 amount, uint256 indexed txIndex, uint256 newCommitment)",
);
const carriedEvent = parseAbiItem(
  "event AttestationCarried(uint256 indexed agentId, bytes32 indexed destinationBlockchainID, address gate, bytes32 messageID)",
);

export interface Stamp {
  requestHash: Hex;
  score: number;
  tag: string;
  lastUpdate: bigint;
}

export interface SpendEvent {
  to: Address;
  amount: bigint;
  txIndex: bigint;
  newCommitment: bigint;
  txHash: Hex;
  timestamp: bigint;
}

export interface CarriedEvent {
  destinationBlockchainID: Hex;
  gate: Address;
  messageID: Hex;
  txHash: Hex;
  timestamp: bigint;
}

export interface DashboardData {
  account: AccountState;
  balance: bigint;
  attestation: Attestation | null;
  stamps: Stamp[];
  spends: SpendEvent[];
  carried: CarriedEvent[];
  cleared: boolean;
  gateMaxAge: bigint;
  fetchedAt: number;
}

const client = VerglasClient.fuji();
const D = FUJI_DEPLOYMENT;

/** Recent-window scan: public RPCs cap eth_getLogs ranges, so chunk. */
const SCAN_WINDOW = 19_000n;
const CHUNK = 2_000n;

async function scanLogs<T>(
  chain: PublicClient,
  fetchChunk: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
): Promise<T[]> {
  const head = await chain.getBlockNumber();
  const from = D.deployBlock > head - SCAN_WINDOW ? D.deployBlock : head - SCAN_WINDOW;
  const jobs: Promise<T[]>[] = [];
  for (let b = from; b <= head; b += CHUNK) {
    const to = b + CHUNK - 1n < head ? b + CHUNK - 1n : head;
    jobs.push(fetchChunk(b, to));
  }
  return (await Promise.all(jobs)).flat();
}

const blockTimeCache = new Map<bigint, Promise<bigint>>();
function blockTime(chain: PublicClient, blockNumber: bigint): Promise<bigint> {
  let hit = blockTimeCache.get(blockNumber);
  if (!hit) {
    hit = chain.getBlock({ blockNumber }).then((b) => b.timestamp);
    blockTimeCache.set(blockNumber, hit);
  }
  return hit;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const chain = client.hubChain;

  const [account, attestation, cleared, balance, requestHashes, gateMaxAge] = await Promise.all([
    client.getAccountState(),
    client.getAttestation(D.agentId),
    client.isCleared(D.agentId).catch(() => false),
    chain.readContract({
      address: D.testUsd,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [D.account],
    }),
    chain.readContract({
      address: D.validationRegistry,
      abi: validationRegistryAbi,
      functionName: "getAgentValidations",
      args: [D.agentId],
    }),
    client
      .gateChain!.readContract({ address: D.gateOnDispatch, abi: verglasGateAbi, functionName: "maxAge" })
      .then((v) => BigInt(v))
      .catch(() => 0n),
  ]);

  // Stamp shelf comes from the registry (full history), not from log scans.
  const stamps = (
    await Promise.all(
      requestHashes.map(async (requestHash) => {
        const s = await client.getValidationStatus(requestHash);
        return { requestHash, score: s.response, tag: s.tag, lastUpdate: s.lastUpdate };
      }),
    )
  ).filter((s) => s.lastUpdate > 0n);

  const [spendLogs, carriedLogs] = await Promise.all([
    scanLogs(chain, (fromBlock, toBlock) =>
      chain.getLogs({ address: D.account, event: spendEvent, fromBlock, toBlock }),
    ),
    scanLogs(chain, (fromBlock, toBlock) =>
      chain.getLogs({ address: D.hub, event: carriedEvent, fromBlock, toBlock }),
    ),
  ]);

  const spends: SpendEvent[] = await Promise.all(
    spendLogs.map(async (log) => ({
      to: log.args.to!,
      amount: log.args.amount!,
      txIndex: log.args.txIndex!,
      newCommitment: log.args.newCommitment!,
      txHash: log.transactionHash,
      timestamp: await blockTime(chain, log.blockNumber),
    })),
  );
  spends.sort((a, b) => (a.txIndex < b.txIndex ? 1 : -1));

  const carried: CarriedEvent[] = await Promise.all(
    carriedLogs.map(async (log) => ({
      destinationBlockchainID: log.args.destinationBlockchainID!,
      gate: log.args.gate!,
      messageID: log.args.messageID!,
      txHash: log.transactionHash,
      timestamp: await blockTime(chain, log.blockNumber),
    })),
  );
  carried.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return {
    account,
    balance,
    attestation,
    stamps,
    spends,
    carried,
    cleared,
    gateMaxAge,
    fetchedAt: Date.now(),
  };
}
