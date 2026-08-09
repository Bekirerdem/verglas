import { useEffect, useMemo, useState } from "react";
import { VerglasClient, type AgentCheck } from "@verglas/sdk";
import { useI18n } from "../lib/i18n";
import { short, utcDate } from "../lib/format";

/** /check/<id> resolves from the path; the preview server has no rewrite
    rule, so ?id=<id> works there and in copied links alike. */
function agentIdFromUrl(): bigint | null {
  const path = location.pathname.match(/\/check\/(\d+)/);
  if (path) return BigInt(path[1]);
  const q = new URLSearchParams(location.search).get("id");
  return q && /^\d+$/.test(q) ? BigInt(q) : null;
}

type Load = { state: "idle" } | { state: "loading" } | { state: "done"; check: AgentCheck } | { state: "error" };

/** The reputation curve: one series (score over stamp time), drawn as a
    2px accent line with 8px dots; the newest stamp wears the amber of the
    seal. The full history list below is the table view of the same data. */
function Curve({ rows }: { rows: AgentCheck["history"] }) {
  const { t } = useI18n();
  // Chronological left→right; history arrives newest-first.
  const pts = useMemo(() => [...rows].reverse(), [rows]);
  if (pts.length < 2) return null;

  const W = 560;
  const H = 120;
  const PAD = { l: 30, r: 16, t: 14, b: 22 };
  const t0 = pts[0].issuedAt;
  const t1 = pts[pts.length - 1].issuedAt;
  const x = (unix: number) => PAD.l + ((unix - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (score: number) => PAD.t + (1 - score / 100) * (H - PAD.t - PAD.b);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.issuedAt).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");

  return (
    <figure className="ck-curve" aria-label={t("check_curve")}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        {/* recessive grid: the 100 line and the floor */}
        <line x1={PAD.l} y1={y(100)} x2={W - PAD.r} y2={y(100)} className="ck-grid" />
        <line x1={PAD.l} y1={y(0)} x2={W - PAD.r} y2={y(0)} className="ck-grid" />
        <text x={PAD.l - 6} y={y(100) + 3} className="ck-axis" textAnchor="end">100</text>
        <text x={PAD.l - 6} y={y(0) + 3} className="ck-axis" textAnchor="end">0</text>
        <path d={d} className="ck-line" />
        {pts.map((p, i) => {
          const last = i === pts.length - 1;
          return (
            <g key={p.requestHash + i}>
              <circle cx={x(p.issuedAt)} cy={y(p.score)} r={last ? 5 : 4} className={last ? "ck-dot ck-dot-latest" : "ck-dot"}>
                <title>{`${utcDate(BigInt(p.issuedAt))} · ${p.score}`}</title>
              </circle>
              {last && (
                <text x={x(p.issuedAt)} y={y(p.score) - 10} className="ck-dot-label" textAnchor="middle">
                  {p.score}
                </text>
              )}
            </g>
          );
        })}
        <text x={x(t0)} y={H - 6} className="ck-axis" textAnchor="start">{utcDate(BigInt(t0))}</text>
        <text x={x(t1)} y={H - 6} className="ck-axis" textAnchor="end">{utcDate(BigInt(t1))}</text>
      </svg>
    </figure>
  );
}

function Lookup() {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const go = () => {
    if (/^\d+$/.test(value.trim())) location.href = `/check/${value.trim()}`;
  };
  return (
    <div className="ck-lookup">
      <h2>{t("check_lookup")}</h2>
      <div className="ck-lookup-row">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder={t("check_lookup_ph")}
          inputMode="numeric"
          aria-label={t("check_lookup")}
        />
        <button onClick={go}>{t("check_lookup_go")}</button>
      </div>
    </div>
  );
}

export function CheckPage() {
  const { t, lang, setLang } = useI18n();
  const agentId = useMemo(agentIdFromUrl, []);
  const [load, setLoad] = useState<Load>({ state: agentId === null ? "idle" : "loading" });

  useEffect(() => {
    if (agentId === null) return;
    VerglasClient.fuji()
      .checkAgent(agentId)
      .then((check) => setLoad({ state: "done", check }))
      .catch((e) => {
        console.error("[check]", e);
        setLoad({ state: "error" });
      });
  }, [agentId]);

  const check = load.state === "done" ? load.check : null;
  const att = check?.attestation ?? null;

  return (
    <div className="ck">
      <header className="ck-top">
        <a className="ck-brand" href="/">
          <img src="/mark.png" alt="" width="22" height="22" />
          <span>VERGLAS</span>
          <sup>CHECK</sup>
        </a>
        <div className="ck-top-right">
          <button className="ck-lang" onClick={() => setLang(lang === "en" ? "tr" : "en")}>
            {lang === "en" ? "TR" : "EN"}
          </button>
          <a className="ck-home" href="/">{t("check_back")} →</a>
        </div>
      </header>

      <main className="ck-main">
        <h1>{t("check_title")}</h1>
        <p className="ck-sub">{t("check_sub")}</p>

        {agentId === null && <Lookup />}

        {load.state === "loading" && <div className="ck-note">{t("check_loading")}</div>}
        {load.state === "error" && <div className="ck-note">{t("check_empty")}</div>}

        {check && (
          <>
            <section className={`ck-head ${check.cleared ? "is-cleared" : ""}`}>
              <div className="ck-agent mono">AGENT #{check.agentId.toString()}</div>
              <div className={`ck-badge ${check.cleared ? "ck-badge-ok" : "ck-badge-no"}`}>
                {check.cleared ? (
                  <><span className="ck-vg">VG</span> {t("check_cleared")}</>
                ) : (
                  t("check_not_cleared")
                )}
              </div>
            </section>

            {att ? (
              <>
                <section className="ck-facts">
                  <div className="ck-fact">
                    <span className="ck-k">{t("check_score")}</span>
                    <span className="ck-v mono">{att.score}</span>
                  </div>
                  <div className="ck-fact">
                    <span className="ck-k">{t("check_issued")}</span>
                    <span className="ck-v mono">{utcDate(att.issuedAt)}</span>
                  </div>
                  <div className="ck-fact">
                    <span className="ck-k">{t("check_txs")}</span>
                    <span className="ck-v mono">{att.txCount.toString()}</span>
                  </div>
                  {att.account && (
                    <div className="ck-fact">
                      <span className="ck-k">{t("check_vault")}</span>
                      <span className="ck-v mono">{short(att.account)}</span>
                    </div>
                  )}
                </section>

                {check.history.length >= 2 && (
                  <section className="ck-block">
                    <h2>{t("check_curve")}</h2>
                    <Curve rows={check.history} />
                  </section>
                )}

                <section className="ck-block">
                  <h2>{t("check_history")}</h2>
                  <div className="ck-rows">
                    {check.history.map((r, i) => (
                      <div className="ck-row" key={r.requestHash + i}>
                        <span className="mono">{utcDate(BigInt(r.issuedAt))}</span>
                        <span className={`mono ck-score ${i === 0 ? "is-latest" : ""}`}>{r.score}</span>
                        <span className="mono ck-hash">{short(r.requestHash, 10, 6)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <div className="ck-note">{t("check_empty")}</div>
            )}

            <p className="ck-netnote">{t("check_net_note")}</p>
          </>
        )}
      </main>
    </div>
  );
}
