"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, GraduationCap, Loader2 } from "lucide-react";

type MindOpt = { mindId: string; name: string };
type PlanRow = {
  id: string;
  mindName: string;
  personaName: string;
  archetype: string;
  lastScore: number | null;
  sessionCount: number;
  latestSessionId: string | null;
  latestStatus: string | null;
};
type StepView = { kind: string; label: string; reply?: string; prompt?: string };
type Report = {
  overall: number | null;
  dimensions: { voice: number; decision: number; knowledge: number; consistency: number } | null;
  gaps: string[];
  advice: string;
  correction: string;
  raw?: string;
};

const ARCHETYPES = [
  { key: "public-figure", label: "Public Figure", note: "parody-labeled" },
  { key: "fictional", label: "Fictional Character", note: "canon-grounded" },
  { key: "expert", label: "Domain Expert", note: "knowledge-first" },
  { key: "original", label: "Original Character", note: "your invention" },
];

export default function StudioWizard({ minds, plans }: { minds: MindOpt[]; plans: PlanRow[] }) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepView[]>([]);
  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [form, setForm] = useState({
    mindId: minds[0]?.mindId ?? "",
    judgeMindId: minds[1]?.mindId ?? "",
    archetype: "public-figure",
    personaName: "",
    who: "",
    tone: "",
    sources: "",
  });

  const advance = useCallback(
    async (sid: string) => {
      try {
        const res = await fetch("/api/studio/advance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "advance failed");
        setSteps(d.steps ?? []);
        setCursor(d.cursor ?? 0);
        if (d.report) setReport(d.report);
        if (d.status === "done") {
          setStatus("done");
          if (timer.current) clearInterval(timer.current);
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [router],
  );

  useEffect(() => {
    if (!sessionId || status !== "running") return;
    advance(sessionId);
    timer.current = setInterval(() => advance(sessionId), 9000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [sessionId, status, advance]);

  async function start() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "could not start session");
      setSessionId(d.sessionId);
      setStatus("running");
      setReport(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function resumeSession(sid: string) {
    setSessionId(sid);
    setStatus("running");
    setReport(null);
    setError("");
  }

  /* ── running / finished view ── */
  if (sessionId && status !== "idle") {
    return (
      <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <GraduationCap size={18} aria-hidden style={{ color: "var(--brand)" }} />
            <b>{status === "done" ? "Session complete" : "Training session running"}</b>
            {status === "running" ? (
              <span className="thinking" style={{ marginLeft: "auto" }}>Minds are working — safe to leave this page open</span>
            ) : null}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {steps.filter((s) => s.kind !== "done").map((s, i) => {
              const isDone = i < cursor;
              const isCurrent = i === cursor && status !== "done";
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.9rem" }}>
                  {isDone ? (
                    <CheckCircle2 size={16} style={{ color: "var(--good)", marginTop: 3 }} aria-hidden />
                  ) : isCurrent ? (
                    <Loader2 size={16} className="spin" style={{ color: "var(--accent-deep)", marginTop: 3 }} aria-hidden />
                  ) : (
                    <Circle size={16} style={{ color: "var(--line)", marginTop: 3 }} aria-hidden />
                  )}
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: isCurrent ? 700 : 500 }}>{s.label}</span>
                    {isDone && s.reply ? (
                      <details style={{ marginTop: 2 }}>
                        <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: "0.78rem" }}>
                          view reply
                        </summary>
                        <p style={{ whiteSpace: "pre-wrap", color: "var(--muted)", fontSize: "0.82rem", margin: "6px 0 0" }}>
                          {s.reply.slice(0, 1200)}
                        </p>
                      </details>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {error ? <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0 }}>{error}</p> : null}
        </div>

        {report ? (
          <div className="card" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <b>Exam result</b>
              {report.overall != null ? (
                <span className="score" style={{ fontSize: "1.4rem" }}>{report.overall}/100</span>
              ) : (
                <span className="pill pill-demo">unscored — examiner replied in prose</span>
              )}
            </div>
            {report.dimensions ? (
              <div style={{ display: "grid", gap: 6 }}>
                {Object.entries(report.dimensions).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="mono" style={{ width: 100, fontSize: "0.7rem", textTransform: "uppercase", color: "var(--muted)" }}>{k}</span>
                    <div style={{ flex: 1, height: 8, background: "var(--brand-soft)", borderRadius: 4 }}>
                      <div style={{ width: `${v}%`, height: "100%", background: "var(--brand)", borderRadius: 4 }} />
                    </div>
                    <span className="mono" style={{ fontSize: "0.75rem", width: 30, textAlign: "right" }}>{v}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {report.gaps.length ? (
              <div>
                <b style={{ fontSize: "0.85rem" }}>Gaps to work on</b>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18, color: "var(--muted)", fontSize: "0.88rem" }}>
                  {report.gaps.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </div>
            ) : null}
            {report.advice ? (
              <p style={{ margin: 0, fontSize: "0.88rem" }}><b>Next session:</b> {report.advice}</p>
            ) : null}
            {report.raw ? (
              <details>
                <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: "0.8rem" }}>examiner&apos;s full notes</summary>
                <p style={{ whiteSpace: "pre-wrap", color: "var(--muted)", fontSize: "0.82rem" }}>{report.raw}</p>
              </details>
            ) : null}
          </div>
        ) : null}

        {status === "done" ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={() => { setSessionId(null); setStatus("idle"); setReport(null); setSteps([]); }}>
              Run another session
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  /* ── setup form ── */
  return (
    <div style={{ display: "grid", gap: 20, marginTop: 20 }}>
      {plans.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Persona</th><th>Mind</th><th>Type</th><th>Sessions</th><th>Score</th><th></th></tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.personaName}</b></td>
                  <td className="mono" style={{ fontSize: "0.78rem" }}>@{p.mindName}</td>
                  <td><span className="pill pill-cat">{p.archetype}</span></td>
                  <td>{p.sessionCount}</td>
                  <td className="mono">{p.lastScore != null ? `${p.lastScore}/100` : "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    {p.latestSessionId && p.latestStatus === "running" ? (
                      <button className="btn btn-outline btn-sm" onClick={() => resumeSession(p.latestSessionId!)}>
                        Resume
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="card" style={{ display: "grid", gap: 4 }}>
        <h3 style={{ margin: "0 0 8px" }}>New training session</h3>
        {error ? <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: "0 0 6px" }}>{error}</p> : null}
        {minds.length < 2 ? (
          <p style={{ color: "var(--warn)", fontSize: "0.85rem" }}>
            You need at least two online Minds — one to train, one to grade the exam.
          </p>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label htmlFor="sw-mind">Mind to train</label>
            <select id="sw-mind" value={form.mindId} onChange={(e) => setForm({ ...form, mindId: e.target.value })}>
              {minds.map((m) => <option key={m.mindId} value={m.mindId}>@{m.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sw-judge">Examiner Mind (grades the exam)</label>
            <select id="sw-judge" value={form.judgeMindId} onChange={(e) => setForm({ ...form, judgeMindId: e.target.value })}>
              {minds.filter((m) => m.mindId !== form.mindId).map((m) => <option key={m.mindId} value={m.mindId}>@{m.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Persona type</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ARCHETYPES.map((a) => (
              <button
                key={a.key}
                className={`btn btn-sm ${form.archetype === a.key ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setForm({ ...form, archetype: a.key })}
                title={a.note}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="sw-name">Persona name</label>
          <input id="sw-name" placeholder="e.g. POTUS45, Sun Tzu, Dr. Vega" value={form.personaName}
            onChange={(e) => setForm({ ...form, personaName: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="sw-who">Who is this persona? (plain words — the Studio does the prompting)</label>
          <textarea id="sw-who" rows={3}
            placeholder="e.g. The 45th US president as a parody: his speaking style on social media, how he reacts to critics, how he makes decisions…"
            value={form.who} onChange={(e) => setForm({ ...form, who: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="sw-tone">Tone notes (optional)</label>
          <input id="sw-tone" placeholder="e.g. short sentences, superlatives, never apologizes"
            value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="sw-src">Source material (paste tweets, quotes, bios, articles — up to ~6,000 characters)</label>
          <textarea id="sw-src" rows={6} placeholder="Paste real material here — the Mind studies it and stores what it learns."
            value={form.sources} onChange={(e) => setForm({ ...form, sources: e.target.value })} />
        </div>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 10px" }}>
          A session sends ~6–9 messages between your Minds (identity → knowledge → 3-question exam →
          grading → correction) and takes 10–30 minutes of Mind thinking time. It burns real
          cognition on both Minds and earns you training points.
        </p>
        <button
          className="btn btn-primary"
          disabled={busy || !form.mindId || !form.judgeMindId || !form.personaName.trim() || !form.who.trim() || minds.length < 2}
          onClick={start}
        >
          {busy ? "Starting…" : "Start training session"}
        </button>
      </div>
    </div>
  );
}
