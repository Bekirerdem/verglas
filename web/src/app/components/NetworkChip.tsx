import { useEffect, useRef, useState } from "react";
import { NETWORKS, type VerglasNetwork } from "@verglas/sdk";
import { NET, switchNetwork } from "../../lib/network";
import { useI18n } from "../../lib/i18n";

/** The environment chip is also the network switch: testnet by default,
 *  mainnet once its addresses are deployed. Networks the code supports but
 *  that have no deployment are listed and disabled — honest about what exists
 *  instead of hiding the option. */
export function NetworkChip() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const list = Object.values(NETWORKS) as VerglasNetwork[];

  return (
    <div className="envwrap" ref={wrap}>
      <button
        className={`envchip envswitch${NET.kind === "mainnet" ? " is-main" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="envdot" />
        {t(NET.kind === "mainnet" ? "b_env_main" : "b_env")}
      </button>
      {open && (
        <div className="envmenu" role="menu">
          {list.map((n) => {
            const live = n.deployment !== null;
            const active = n.key === NET.key;
            return (
              <button
                key={n.key}
                role="menuitem"
                disabled={!live || active}
                onClick={() => {
                  if (live && !active) switchNetwork(n.key);
                }}
              >
                <span>
                  {active ? "● " : ""}
                  {n.label}
                </span>
                <span className="envtag">
                  {!live ? t("b_env_soon") : t(n.kind === "mainnet" ? "b_env_main" : "b_env")}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
