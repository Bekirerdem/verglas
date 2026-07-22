import { concat, keccak256, parseEventLogs, toHex, type Address } from "viem";
import { identityRegistryAbi } from "@verglas/sdk";
import { agentHintKey, hubChain } from "../../lib/data";
import { sendBindAccount, sendRegisterIdentity, sendValidationRequest } from "./wallet";

/** The stamp-line activation: mint an ERC-8004 identity, bind it to the
    vault on the Hub, open the validation window the keeper will prove.
    Three owner signatures; returns the freshly minted agentId. */
export async function activateStampLine(
  wallet: Address,
  account: Address,
  onStep: (step: 1 | 2 | 3) => void,
): Promise<bigint> {
  onStep(1);
  const h1 = await sendRegisterIdentity(wallet);
  const rc = await hubChain.waitForTransactionReceipt({ hash: h1 });
  const minted = parseEventLogs({ abi: identityRegistryAbi, logs: rc.logs, eventName: "Transfer" });
  const agentId = minted[0]?.args.tokenId;
  if (agentId === undefined) throw new Error("no-agent-id");

  onStep(2);
  const h2 = await sendBindAccount(wallet, agentId, account);
  await hubChain.waitForTransactionReceipt({ hash: h2 });
  // This browser just learned the vault's agentId — spare it the log rediscovery.
  try {
    localStorage.setItem(agentHintKey(account), agentId.toString());
  } catch {
    // private mode: the incremental scan will rediscover it
  }

  onStep(3);
  const rand = new Uint8Array(32);
  crypto.getRandomValues(rand);
  const requestHash = keccak256(concat([account, toHex(rand)]));
  const h3 = await sendValidationRequest(wallet, agentId, requestHash);
  await hubChain.waitForTransactionReceipt({ hash: h3 });

  return agentId;
}

/** Local, per-browser vault labels (the chain has no name field on purpose). */
const NAMES_KEY = "verglas-vault-names";

export function vaultNames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NAMES_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function setVaultName(account: Address, name: string): void {
  const names = vaultNames();
  names[account.toLowerCase()] = name;
  localStorage.setItem(NAMES_KEY, JSON.stringify(names));
}
