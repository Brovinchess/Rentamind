"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ICON_CHOICES } from "@/components/MindIcon";

const CATEGORIES = ["Personas", "Experts", "Trading", "Sports", "Culture"];

export type ManagedListing = {
  id: string;
  title: string;
  mind_name: string;
  tagline: string;
  description: string;
  category: string;
  emoji: string;
  label: string;
  rate_cognition_per_day: number;
  min_days: number;
  max_concurrent: number;
  is_active: boolean;
  activeRentals: number;
};

export default function ManageListings({ listings }: { listings: ManagedListing[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Partial<ManagedListing>>({});

  if (!listings.length) return null;

  async function call(method: "PATCH" | "DELETE" | "POST", body: Record<string, unknown>, id: string) {
    setBusy(id);
    setError("");
    try {
      const res = await fetch("/api/listings", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "request failed");
      setEditing(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {error ? <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0 }}>{error}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Listing</th><th>Status</th><th>Rate / day</th><th>Min days</th>
              <th>Slots</th><th>Active rentals</th><th style={{ textAlign: "right" }}>Manage</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link href={`/mind/${l.id}`} style={{ fontWeight: 700, color: "var(--brand)" }}>
                    {l.title}
                  </Link>{" "}
                  <span className="mono" style={{ fontSize: "0.7rem", color: "var(--muted)" }}>@{l.mind_name}</span>
                </td>
                <td>
                  {l.is_active
                    ? <span className="pill pill-live">listed</span>
                    : <span className="pill pill-demo">delisted</span>}
                </td>
                <td>{Number(l.rate_cognition_per_day).toLocaleString()}</td>
                <td>{l.min_days}</td>
                <td>{l.max_concurrent}</td>
                <td>{l.activeRentals}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditing(editing === l.id ? null : l.id);
                      setForm(l);
                    }}
                    disabled={busy === l.id}
                  >
                    {editing === l.id ? "Close" : "Edit"}
                  </button>{" "}
                  {l.is_active ? (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => call("DELETE", { listingId: l.id }, l.id)}
                      disabled={busy === l.id}
                    >
                      {busy === l.id ? "…" : "Delist"}
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => call("PATCH", { listingId: l.id, relist: true }, l.id)}
                      disabled={busy === l.id}
                    >
                      {busy === l.id ? "…" : "Relist"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="card" style={{ display: "grid", gap: 2, maxWidth: 620 }}>
          <h3 style={{ margin: "0 0 10px" }}>Edit listing</h3>
          <div className="field">
            <label htmlFor="el-title">Title</label>
            <input id="el-title" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="el-tagline">Tagline</label>
            <input id="el-tagline" value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="el-desc">Description</label>
            <textarea id="el-desc" rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            <div className="field">
              <label htmlFor="el-cat">Category</label>
              <select id="el-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="el-icon">Icon</label>
              <select id="el-icon" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })}>
                {ICON_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="el-rate">Cognition / day</label>
              <input id="el-rate" type="number" min={10} value={form.rate_cognition_per_day ?? 100}
                onChange={(e) => setForm({ ...form, rate_cognition_per_day: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label htmlFor="el-min">Min days</label>
              <input id="el-min" type="number" min={1} max={30} value={form.min_days ?? 1}
                onChange={(e) => setForm({ ...form, min_days: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label htmlFor="el-max">Max renters</label>
              <input id="el-max" type="number" min={1} max={20} value={form.max_concurrent ?? 3}
                onChange={(e) => setForm({ ...form, max_concurrent: Number(e.target.value) })} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn btn-primary"
              disabled={busy === editing || !form.title}
              onClick={() =>
                call(
                  "PATCH",
                  {
                    listingId: editing,
                    title: form.title,
                    tagline: form.tagline,
                    description: form.description,
                    category: form.category,
                    emoji: form.emoji,
                    rate_cognition_per_day: form.rate_cognition_per_day,
                    min_days: form.min_days,
                    max_concurrent: form.max_concurrent,
                  },
                  editing,
                )
              }
            >
              {busy === editing ? "Saving…" : "Save changes"}
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy === editing}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>
        Delisting hides the Mind from the marketplace immediately; renters mid-window keep access
        until their rental expires. Re-list a delisted Mind anytime with &quot;List a Mind&quot; — its
        rental history is kept.
      </p>
    </div>
  );
}
