import { useState } from "react";
import type { VaultView } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { short } from "../../lib/format";
import { contactName, initials, setContactName } from "../lib/contacts";

const COLORS = ["#4c3b2a", "#2a3a4c", "#3c2a4c", "#2a4c3b", "#4c463d", "#5c2a2a"];
const colorFor = (addr: string) => COLORS[parseInt(addr.slice(-2), 16) % COLORS.length];

/** People panel: local names for the vault's addresses. The chain keeps
    addresses; the owner keeps people — names never leave this device. */
export function ContactsPanel({ view, onChange }: { view: VaultView; onChange: () => void }) {
  const { t } = useI18n();
  const [, bump] = useState(0);

  const rows: { addr: string; role: string }[] = [
    { addr: view.state.owner, role: t("b_role_owner") },
    { addr: view.state.agent, role: t("b_role_agent") },
    ...view.state.whitelist
      .filter((w) => w.toLowerCase() !== view.state.agent.toLowerCase())
      .map((w) => ({ addr: w as string, role: t("b_role_wl") })),
  ];

  return (
    <div className="bpanel brise">
      <h4>{t("b_people")}</h4>
      <p className="bhint" style={{ marginTop: 0, marginBottom: 12 }}>{t("b_people_p")}</p>
      {rows.map(({ addr, role }) => {
        const name = contactName(addr);
        return (
          <div className="bcontact" key={addr + role}>
            <span className="bpfp" style={{ background: colorFor(addr) }}>
              {initials(name, addr)}
            </span>
            <div>
              <span className="addr">{short(addr, 8, 6)}</span>
              <span className="role">{role}</span>
            </div>
            <input
              defaultValue={name ?? ""}
              placeholder={t("b_name_ph")}
              onBlur={(e) => {
                setContactName(addr, e.target.value);
                bump((n) => n + 1);
                onChange();
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
