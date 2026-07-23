import { useState } from "react";
import { concat, keccak256, toHex, type Address, type Hex } from "viem";
import type { VaultView } from "../../lib/data";
import { activateStampLine } from "./activate";
import { sendValidationRequest } from "./wallet";

/** The two audit actions, shared by the overview card and the audit page:
    open the stamp line (identity mint → bind → first request) and renew
    the validation window with a single signature. */
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

  const renew = () => {
    if (!wallet || !isOwner || view.agentId === null) return;
    const rand = new Uint8Array(32);
    crypto.getRandomValues(rand);
    const requestHash = keccak256(concat([view.account, toHex(rand)]));
    void run("renew", () => sendValidationRequest(wallet, view.agentId!, requestHash)).then((ok) => {
      if (ok) onRefresh();
    });
  };

  return { step, actErr, activate, renew };
}
