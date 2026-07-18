import { createWalletClient, custom, type Address, type Hex } from "viem";
import { fujiC, verglasAccountAbi, verglasTreasurerAbi } from "@verglas/sdk";

type Provider = Parameters<typeof custom>[0];

function provider(): Provider {
  const eth = (window as { ethereum?: Provider }).ethereum;
  if (!eth) throw new Error("no-wallet");
  return eth;
}

function walletClient() {
  return createWalletClient({ chain: fujiC, transport: custom(provider()) });
}

/** Prompt the wallet; make sure it ends up on Fuji C-Chain. */
export async function connect(): Promise<Address> {
  const wc = walletClient();
  const [address] = await wc.requestAddresses();
  try {
    await wc.switchChain({ id: fujiC.id });
  } catch {
    await wc.addChain({ chain: fujiC });
    await wc.switchChain({ id: fujiC.id }).catch(() => {});
  }
  return address;
}

/** Silent reconnect on load — no prompt if the site was never approved. */
export async function getConnected(): Promise<Address | null> {
  try {
    const [address] = await walletClient().getAddresses();
    return address ?? null;
  } catch {
    return null;
  }
}

export type VaultAction = "freeze" | "unfreeze";
export type TreasurerAction = "pause" | "unpause";

export function sendVaultAction(account: Address, from: Address, fn: VaultAction): Promise<Hex> {
  return walletClient().writeContract({
    address: account,
    abi: verglasAccountAbi,
    functionName: fn,
    account: from,
    chain: fujiC,
  });
}

export function sendTreasurerAction(treasurer: Address, from: Address, fn: TreasurerAction): Promise<Hex> {
  return walletClient().writeContract({
    address: treasurer,
    abi: verglasTreasurerAbi,
    functionName: fn,
    account: from,
    chain: fujiC,
  });
}

export interface PolicyInput {
  dailyLimit: bigint;
  maxSlippageBps: number;
  referenceRateUsdTry: bigint;
}

export function sendSetPolicy(treasurer: Address, from: Address, p: PolicyInput): Promise<Hex> {
  return walletClient().writeContract({
    address: treasurer,
    abi: verglasTreasurerAbi,
    functionName: "setPolicy",
    args: [p],
    account: from,
    chain: fujiC,
  });
}
