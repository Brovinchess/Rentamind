"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ICON_CHOICES } from "@/components/MindIcon";

const CATEGORIES = ["Personas", "Experts", "Trading", "Sports", "Culture"];

export default function ListMindForm({
  minds,
}: {
  minds: { mindId: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    mindId: minds[0]?.mindId ?? "",
    title: "",
    tagline: "",
    description: "",
    category: "Personas",
    ratePerDay: 100,
    emoji: "brain",
  });

  if (!minds.length) return null;
  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + List a Mind for rent
      </button>
    );
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create listing");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ display: "grid", gap: 2, maxWidth: 560 }}>
      <h3 style={{ margin: "0 0 10px" }}>List a Mind for rent</h3>
      {error ? <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: "0 0 8px" }}>{error}</p> : null}
      <div className="field">
        <label htmlFor="lm-mind">Mind</label>
        <select id="lm-mind" value={form.mindId} onChange={(e) => setForm({ ...form, mindId: e.target.value })}>
          {minds.map((m) => (
            <option key={m.mindId} value={m.mindId}>@{m.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="lm-title">Listing title</label>
        <input id="lm-title" placeholder="e.g. Slim Shady Mind" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="lm-tagline">Tagline</label>
        <input id="lm-tagline" placeholder="One line renters see on the card" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="lm-desc">What did you train it on?</label>
        <textarea id="lm-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 10 }}>
        <div className="field">
          <label htmlFor="lm-cat">Category</label>
          <select id="lm-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lm-rate">Cognition / day</label>
          <input id="lm-rate" type="number" min={10} value={form.ratePerDay} onChange={(e) => setForm({ ...form, ratePerDay: Number(e.target.value) })} />
        </div>
        <div className="field">
          <label htmlFor="lm-icon">Icon</label>
          <select id="lm-icon" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })}>
            {ICON_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" onClick={submit} disabled={busy || !form.title}>
          {busy ? "Listing…" : "Publish listing"}
        </button>
        <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}
