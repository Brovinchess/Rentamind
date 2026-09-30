"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Plus, Search, Users } from "lucide-react";

type Skill = {
  skillId: string;
  name: string;
  description: string | null;
  equippedCount: number;
};
type MindOpt = { mindId: string; name: string };

const PAGE_SIZE = 12;

/**
 * Browse the public HelloMinds Bazaar and equip skills onto one of your Minds.
 * The catalog is anonymous (Core API); equipping uses your HelloMinds connection.
 */
export default function SkillBrowser({ minds }: { minds: MindOpt[] }) {
  const [mindId, setMindId] = useState(minds[0]?.mindId ?? "");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Skill[]>([]);
  const [total, setTotal] = useState(0);
  const [equipped, setEquipped] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(page) });
      if (search) qs.set("q", search);
      if (mindId) qs.set("mindId", mindId);
      const res = await fetch(`/api/skills?${qs}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setItems(d.items ?? []);
      setTotal(d.totalCount ?? 0);
      setEquipped(new Set((d.equippedIds ?? []) as string[]));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, mindId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(skill: Skill) {
    if (!mindId) return;
    const key = skill.skillId.toLowerCase();
    const isOn = equipped.has(key);
    setPending(key);
    setError("");
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mindId, skillId: skill.skillId, equip: !isOn }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setEquipped((prev) => {
        const next = new Set(prev);
        if (isOn) next.delete(key);
        else next.add(key);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="sb-mind">Equip onto</label>
          <select id="sb-mind" value={mindId} onChange={(e) => setMindId(e.target.value)}>
            {minds.map((m) => (
              <option key={m.mindId} value={m.mindId}>
                @{m.name}
              </option>
            ))}
          </select>
        </div>
        <form
          className="field"
          style={{ margin: 0 }}
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(query.trim());
          }}
        >
          <label htmlFor="sb-q">Search {total ? `${total.toLocaleString()} skills` : "the Bazaar"}</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="sb-q"
              placeholder="e.g. trading, research, calendar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn btn-outline btn-sm" type="submit">
              <Search size={14} aria-hidden /> Search
            </button>
          </div>
        </form>
      </div>

      {error ? <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0 }}>{error}</p> : null}

      {loading ? (
        <span className="thinking">loading the Bazaar</span>
      ) : !items.length ? (
        <div className="empty">No skills matched that search.</div>
      ) : (
        <div className="grid">
          {items.map((s) => {
            const key = s.skillId.toLowerCase();
            const on = equipped.has(key);
            return (
              <div className="card" key={s.skillId} style={{ display: "grid", gap: 8, alignContent: "start" }}>
                <b style={{ fontSize: "0.95rem" }}>{s.name}</b>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.82rem" }}>
                  {(s.description ?? "").slice(0, 180)}
                  {(s.description ?? "").length > 180 ? "…" : ""}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto" }}>
                  <span className="mono" style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
                    <Users size={10} aria-hidden /> {s.equippedCount.toLocaleString()} Minds
                  </span>
                  <button
                    className={`btn btn-sm ${on ? "btn-ghost" : "btn-outline"}`}
                    style={{ marginLeft: "auto" }}
                    disabled={!mindId || pending === key}
                    onClick={() => toggle(s)}
                  >
                    {pending === key ? (
                      <Loader2 size={13} className="spin" aria-hidden />
                    ) : on ? (
                      <Check size={13} aria-hidden />
                    ) : (
                      <Plus size={13} aria-hidden />
                    )}
                    {on ? "Equipped" : "Equip"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center" }}>
        <button className="btn btn-ghost btn-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
          <ChevronLeft size={14} aria-hidden /> Back
        </button>
        <span className="mono" style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          page {page} of {lastPage.toLocaleString()}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          disabled={page >= lastPage || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next <ChevronRight size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}
