"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import MindAvatar from "@/components/MindAvatar";

type MindOpt = { mindId: string; name: string };
type LogRow = { id: string; topic: string; reply: string | null; sent_at: string };
type PlanRow = {
  id: string;
  mindId: string;
  mindName: string;
  personaName: string;
  archetype: string;
  frequencyHours: number;
  cycles: number;
  isStudying: boolean;
  nextStudyAt: string | null;
  log: LogRow[];
};

const ARCHETYPES = [
  { key: "public-figure", label: "Public Figure", note: "parody-labeled" },
  { key: "fictional", label: "Fictional Character", note: "e.g. The Incredible Hulk" },
  { key: "expert", label: "Domain Expert", note: "knowledge-first" },
  { key: "original", label: "Original Character", note: "your invention" },
];

const FREQUENCIES = [
  { hours: 1, label: "Every hour — fast, burns the most" },
  { hours: 3, label: "Every 3 hours" },
  { hours: 6, label: "Every 6 hours" },
  { hours: 12, label: "Twice a day" },
  { hours: 24, label: "Once a day — steady" },
];

export default function StudioWizard({ minds, plans }: { minds: MindOpt[]; plans: PlanRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const plannedMindIds = new Set(plans.map((p) => p.mindId));
  const available = minds.filter((m) => !plannedMindIds.has(m.mindId));

  const [form, setForm] = useState({
    mindId: available[0]?.mindId ?? "",
    archetype: "fictional",
    personaName: "",
    who: "",
    tone: "",
    sources: "",
    frequencyHours: 24,
  });

  async function start() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "could not start");
      setNotice(
        `${form.personaName} is now in training. Identity sent${d.equippedTool ? `, research tool equipped (${d.equippedTool})` : ""} — the first study cycle fires within minutes.`,
      );
      setForm({ ...form, personaName: "", who: "", tone: "", sources: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function patchPlan(planId: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch("/api/studio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, ...patch }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20, marginTop: 20 }}>
      {/* active personas */}
      {plans.map((p) => (
        <div className="card" key={p.id} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <MindAvatar seed={p.personaName} size={40} radius={10} />
            <b style={{ fontSize: "1.05rem" }}>{p.personaName}</b>
            <span className="mono" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>@{p.mindName}</span>
            <span className="pill pill-cat">{p.archetype}</span>
            {p.isStudying ? (
              <span className="pill pill-live">studying</span>
            ) : (
              <span className="pill pill-demo">paused</span>
            )}
            <span className="score" style={{ marginLeft: "auto" }}>{p.cycles} study cycles</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label htmlFor={`freq-${p.id}`} className="mono" style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
              STUDY EVERY
            </label>
            <select
              id={`freq-${p.id}`}
              value={p.frequencyHours}
              disabled={busy}
              onChange={(e) => patchPlan(p.id, { frequencyHours: Number(e.target.value) })}
              style={{ border: "1.5px solid var(--line)", borderRadius: 8, padding: "5px 8px", fontSize: "0.85rem" }}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.hours} value={f.hours}>{f.hours}h</option>
              ))}
            </select>
            <button
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={() => patchPlan(p.id, { isStudying: !p.isStudying })}
            >
              {p.isStudying ? <><Pause size={13} aria-hidden /> Pause</> : <><Play size={13} aria-hidden /> Resume</>}
            </button>
            <Link href={`/talk/${p.mindId}`} className="btn btn-ghost btn-sm">Open training room</Link>
            {p.nextStudyAt && p.isStudying ? (
              <span className="mono" style={{ fontSize: "0.7rem", color: "var(--muted)", marginLeft: "auto" }}>
                next: {new Date(p.nextStudyAt).toLocaleTimeString()}
              </span>
            ) : null}
          </div>
          {p.log.length ? (
            <div style={{ display: "grid", gap: 6 }}>
              <b style={{ fontSize: "0.85rem" }}>Study feed</b>
              {p.log.map((l) => (
                <details key={l.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 6 }}>
                  <summary style={{ cursor: "pointer", fontSize: "0.85rem" }}>
                    <span className="mono" style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                      {new Date(l.sent_at).toLocaleString()} ·
                    </span>{" "}
                    {l.topic}
                    {!l.reply ? <span className="thinking" style={{ marginLeft: 8 }}>studying</span> : null}
                  </summary>
                  {l.reply ? (
                    <p style={{ whiteSpace: "pre-wrap", color: "var(--muted)", fontSize: "0.85rem", margin: "6px 0 0" }}>
                      {l.reply}
                    </p>
                  ) : null}
                </details>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
              First study cycle is queued — it fires on the next scheduler pass (within ~15 minutes).
            </p>
          )}
        </div>
      ))}

      {/* new persona form */}
      <div className="card" style={{ display: "grid", gap: 4 }}>
        <h3 style={{ margin: "0 0 8px" }}>Start a new persona</h3>
        {error ? <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: "0 0 6px" }}>{error}</p> : null}
        {notice ? <p style={{ color: "var(--good)", fontSize: "0.85rem", margin: "0 0 6px" }}>{notice}</p> : null}
        {!available.length ? (
          <p style={{ color: "var(--warn)", fontSize: "0.85rem" }}>
            All your online Minds already have persona plans — launch a new Mind to train another persona.
          </p>
        ) : null}
        <div className="field">
          <label htmlFor="sw-mind">Mind to train</label>
          <select id="sw-mind" value={form.mindId} onChange={(e) => setForm({ ...form, mindId: e.target.value })}>
            {available.map((m) => <option key={m.mindId} value={m.mindId}>@{m.name}</option>)}
          </select>
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
          <input id="sw-name" placeholder="e.g. The Incredible Hulk" value={form.personaName}
            onChange={(e) => setForm({ ...form, personaName: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="sw-who">Who is this persona? (plain words)</label>
          <textarea id="sw-who" rows={3}
            placeholder="e.g. The Incredible Hulk from Marvel. Talks in short third-person smashes: HULK SMASH! Knows all his comics and movie history, hates being told to calm down…"
            value={form.who} onChange={(e) => setForm({ ...form, who: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="sw-tone">Tone notes (optional)</label>
          <input id="sw-tone" placeholder="e.g. ALL CAPS when angry, calls people 'puny'"
            value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="sw-src">Starter material (optional — paste quotes, bios, articles)</label>
          <textarea id="sw-src" rows={4} placeholder="Anything you paste is studied immediately. The auto-study loop researches the rest."
            value={form.sources} onChange={(e) => setForm({ ...form, sources: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="sw-freq">How often should it study?</label>
          <select id="sw-freq" value={form.frequencyHours} onChange={(e) => setForm({ ...form, frequencyHours: Number(e.target.value) })}>
            {FREQUENCIES.map((f) => <option key={f.hours} value={f.hours}>{f.label}</option>)}
          </select>
        </div>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 10px" }}>
          More frequent study = the Mind learns the persona faster and you earn training points faster —
          and it burns more of the Mind&apos;s cognition. Adjustable or pausable anytime.
        </p>
        <button
          className="btn btn-primary"
          disabled={busy || !form.mindId || !form.personaName.trim() || !form.who.trim() || !available.length}
          onClick={start}
        >
          {busy ? "Starting…" : "Start training"}
        </button>
      </div>
    </div>
  );
}
