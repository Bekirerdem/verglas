import { networkOf, type VerglasDeployment, type VerglasNetwork } from "@verglas/sdk";

/** The active network is chosen once per page load and every module reads it
 *  from here. Switching reloads the page on purpose: the log store, the vault
 *  caches and the wallet's chain are all network-scoped, and a reload is the
 *  only way to guarantee none of them survives the switch with stale data. */
const KEY = "verglas-network";

function initialKey(): string {
  try {
    const fromUrl = new URLSearchParams(location.search).get("net");
    if (fromUrl === "fuji" || fromUrl === "avalanche") {
      localStorage.setItem(KEY, fromUrl);
      return fromUrl;
    }
    return localStorage.getItem(KEY) ?? "fuji";
  } catch {
    return "fuji";
  }
}

export const NET: VerglasNetwork = networkOf(initialKey());

/** True when this network has contracts deployed. Mainnet flips to true the
 *  moment its addresses land in the SDK registry. */
export const isLive = NET.deployment !== null;

/** The active deployment. Reading this on a network that isn't deployed is a
 *  programming error — guard with `isLive` (the console renders a notice). */
const ZERO = "0x0000000000000000000000000000000000000000" as const;
export const DEPLOYMENT: VerglasDeployment = NET.deployment ?? {
  hub: ZERO,
  validationRegistry: ZERO,
  identityRegistry: ZERO,
  verifier: ZERO,
  usdc: ZERO,
  factory: ZERO,
  legacyFactories: [],
  deployBlock: 0n,
  account: ZERO,
};

/** The showcase vault this network puts in front of visitors (zero address on a
 *  network that has none — the console just shows no showcase row then). */
export const SHOWCASE_ACCOUNT = DEPLOYMENT.account ?? ZERO;
export const SHOWCASE_AGENT_ID = DEPLOYMENT.agentId ?? 0n;
/** The treasurer vertical, or null on networks where it isn't deployed. */
export const TREASURER = DEPLOYMENT.treasurer ?? null;

export function switchNetwork(key: VerglasNetwork["key"]): void {
  try {
    localStorage.setItem(KEY, key);
  } catch {
    // private mode: fall back to the query parameter
    location.search = `?net=${key}`;
    return;
  }
  location.reload();
}

export const txUrl = (hash: string) => `${NET.explorer}/tx/${hash}`;
/** The gate's explorer page, when this network has a gate at all. */
export const gateUrl = () => {
  const gate = DEPLOYMENT.gate;
  if (!gate) return NET.explorer;
  return NET.key === "fuji"
    ? `https://subnets-test.avax.network/dispatch/address/${gate.address}`
    : `${NET.explorer}/address/${gate.address}`;
};
export const addressUrl = (address: string) => `${NET.explorer}/address/${address}`;
