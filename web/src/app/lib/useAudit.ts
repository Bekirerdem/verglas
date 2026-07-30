import { useState } from "react";
import { concat, keccak256, toHex, type Address, type Hex } from "viem";
import { FUJI_DEPLOYMENT, verglasHubAbi } from "@verglas/sdk";
import { agentHintKey, hubChain, type VaultView } from "../../lib/data";
import { activateStampLine } from "./activate";
import { sendBindAccount, sendValidationRequest } from "./wallet";

/** The two audit actions, shared by the overview card and the audit page:
    open the stamp line (identity mint → bind → first request) and renew
    the validation window with a single signature — or two, when a Hub
    redeploy erased the binding (identities survive, bindings do not). */
export function useAudit(
  view: VaultView,
  wallet: Address | null,
  isOwner: boolean,
  run: (label: string, send: () => Promise<Hex>) => Promise<boolean>,
  onRefresh: () => void,
) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [actErr, setActErr] = useState(false);

  const activate = async () => {
    if (!wallet || !isOwner || step !== 0) return;
    setActErr(false);
    try {
      await activateStampLine(wallet, view.account, setStep);
      onRefresh();
    } catch {
      setActErr(true);
    }
    setStep(0);
  };

  const renew = async () => {
    if (!wallet || !isOwner || view.agentId === null) return;
    const agentId = view.agentId;

    // A Hub redeploy keeps the agent's identity but starts with no bindings;
    // restore the link first (one extra owner signature) or the keeper would
    // see "no bound account" and never stamp.
    const bound = await hubChain
      .readContract({ address: FUJI_DEPLOYMENT.hub, abi: verglasHubAbi, functionName: "accountOf", args: [agentId] })
      .catch(() => null);
    if (bound !== null && bound.toLowerCase() !== view.account.toLowerCase()) {
      const ok = await run("renew", () => sendBindAccount(wallet, agentId, view.account));
      if (!ok) return;
    }

    const rand = new Uint8Array(32);
    crypto.getRandomValues(rand);
    const requestHash = keccak256(concat([view.account, toHex(rand)]));
    void run("renew", () => sendValidationRequest(wallet, agentId, requestHash)).then((ok) => {
      if (ok) onRefresh();
    });
  };

  /** Move an existing identity onto this vault (bind + fresh window, two
      signatures) — the ERC-8004 identity is permanent, vaults come and go. */
  const migrate = async (agentId: bigint) => {
    if (!wallet || !isOwner) return;
    const okBind = await run("migrate", () => sendBindAccount(wallet, agentId, view.account));
    if (!okBind) return;
    try {
      localStorage.setItem(agentHintKey(view.account), agentId.toString());
    } catch {
      // private mode: the incremental scan will rediscover it
    }
    const rand = new Uint8Array(32);
    crypto.getRandomValues(rand);
    const requestHash = keccak256(concat([view.account, toHex(rand)]));
    void run("migrate", () => sendValidationRequest(wallet, agentId, requestHash)).then((ok) => {
      if (ok) onRefresh();
    });
  };

  return { step, actErr, activate, renew, migrate };
}
