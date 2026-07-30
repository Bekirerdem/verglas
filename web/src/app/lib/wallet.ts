import { createWalletClient, custom, erc20Abi, type Address, type Hex } from "viem";
import {
  FUJI_DEPLOYMENT,
  fujiC,
  IDENTITY_REGISTRY_ADDRESS,
  identityRegistryAbi,
  validationRegistryAbi,
  verglasAccountAbi,
  verglasDispenserAbi,
  verglasFactoryAbi,
  verglasHubAbi,
  verglasTreasurerAbi,
} from "@verglas/sdk";

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

/** The agent's door: pay a whitelisted destination within the vault's rules. */
export function sendSpend(account: Address, from: Address, to: Address, amount: bigint): Promise<Hex> {
  return walletClient().writeContract({
    address: account,
    abi: verglasAccountAbi,
    functionName: "spend",
    args: [to, amount],
    account: from,
    chain: fujiC,
  });
}
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

/** Refuel: raise the vault's lifetime allowance (current-factory vaults only). */
export function sendIncreaseBudget(account: Address, from: Address, amount: bigint): Promise<Hex> {
  return walletClient().writeContract({
    address: account,
    abi: verglasAccountAbi,
    functionName: "increaseBudget",
    args: [amount],
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

export function sendSetOperator(treasurer: Address, from: Address, operator: Address): Promise<Hex> {
  return walletClient().writeContract({
    address: treasurer,
    abi: verglasTreasurerAbi,
    functionName: "setOperator",
    args: [operator],
    account: from,
    chain: fujiC,
  });
}

export function sendWithdraw(account: Address, from: Address, to: Address, amount: bigint): Promise<Hex> {
  return walletClient().writeContract({
    address: account,
    abi: verglasAccountAbi,
    functionName: "withdraw",
    args: [to, amount],
    account: from,
    chain: fujiC,
  });
}

export interface CreateVaultInput {
  agent: Address;
  perTxLimit: bigint;
  totalBudget: bigint;
  whitelist: Address[];
}

export function sendCreateVault(from: Address, input: CreateVaultInput): Promise<Hex> {
  return walletClient().writeContract({
    address: FUJI_DEPLOYMENT.factory,
    abi: verglasFactoryAbi,
    functionName: "createVault",
    args: [input.agent, FUJI_DEPLOYMENT.usdc, input.perTxLimit, input.totalBudget, input.whitelist],
    account: from,
    chain: fujiC,
  });
}

/** Workshop tap: 2 test-USDC into the connected wallet, once per 24h. */
export function sendClaimUsdc(from: Address): Promise<Hex> {
  return walletClient().writeContract({
    address: FUJI_DEPLOYMENT.dispenser,
    abi: verglasDispenserAbi,
    functionName: "claim",
    account: from,
    chain: fujiC,
  });
}

/** Stamp-line activation, tx 1/3: mint a fresh ERC-8004 agentId (ERC-721). */
export function sendRegisterIdentity(from: Address): Promise<Hex> {
  return walletClient().writeContract({
    address: IDENTITY_REGISTRY_ADDRESS,
    abi: identityRegistryAbi,
    functionName: "register",
    account: from,
    chain: fujiC,
  });
}

/** Stamp-line activation, tx 2/3: link the identity to the vault on the Hub. */
export function sendBindAccount(from: Address, agentId: bigint, account: Address): Promise<Hex> {
  return walletClient().writeContract({
    address: FUJI_DEPLOYMENT.hub,
    abi: verglasHubAbi,
    functionName: "bindAccount",
    args: [agentId, account],
    account: from,
    chain: fujiC,
  });
}

/** Stamp-line activation, tx 3/3: open the validation window the keeper will prove. */
export function sendValidationRequest(from: Address, agentId: bigint, requestHash: Hex): Promise<Hex> {
  return walletClient().writeContract({
    address: FUJI_DEPLOYMENT.validationRegistry,
    abi: validationRegistryAbi,
    functionName: "validationRequest",
    args: [FUJI_DEPLOYMENT.hub, agentId, "verglas:policy-compliance:window", requestHash],
    account: from,
    chain: fujiC,
  });
}

export function sendUsdc(from: Address, to: Address, amount: bigint): Promise<Hex> {
  return walletClient().writeContract({
    address: FUJI_DEPLOYMENT.usdc,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
    account: from,
    chain: fujiC,
  });
}
