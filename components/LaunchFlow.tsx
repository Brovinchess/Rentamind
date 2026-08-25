"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw, Sparkles } from "lucide-react";

type MindRow = { mindId: string; name: string; isEnabled: boolean; createdAt: string | null };

const POLL_MS = 12_000;

export default function LaunchFlow() {
  const [baseline, setBaseline] = useState<Set<string> | null>(null);
  const [newMinds, setNewMinds] = useState<MindRow[]>([]);
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState("");
  const baselineRef = useRef<Set<string> | null>(null);

  const fetchMinds = useCallback(async (): Promise<MindRow[]> => {
    const res = await fetch("/api/minds");
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    return d.minds as MindRow[];
  }, []);

  // Snapshot the account before the user goes off to awaken.
  useEffect(() => {
    fetchMinds()
      .then((m) => {
        const ids = new Set(m.map((x) => x.mindId));
        setBaseline(ids);
        baselineRef.current = ids;
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [fetchMinds]);

  // Poll for a newly awakened Mind while watching.
  useEffect(() => {
    if (!watching) return;
    const timer = setInterval(async () => {
      try {
        const current = await fetchMinds();
        const base = baselineRef.current;
        if (!base) return;
        const fresh = current.filter((m) => !base.has(m.mindId));
        if (fresh.length) setNewMinds(fresh);
      } catch {
        // transient; keep polling
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [watching, fetchMinds]);

  if (newMinds.length) {
    return (
      <div className="card" style={{ borderColor: "var(--good)", display: "grid", gap: 10 }}>
        <span className="pill pill-live" style={{ justifySelf: "start" }}>
          <Sparkles size={11} aria-hidden /> Mind detected
        </span>
        {newMinds.map((m) => (
          <div key={m.mindId} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <b style={{ fontSize: "1.1rem" }}>@{m.name}</b>
              <div className="mono" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                awakened just now · live on your account
              </div>
            </div>
            <Link href={`/talk/${m.mindId}`} className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }}>
              Start training it
            </Link>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      {error ? <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0 }}>{error}</p> : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a
          href="https://hellominds.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          onClick={() => setWatching(true)}
        >
          Awaken a Mind on HelloMinds <ExternalLink size={15} aria-hidden />
        </a>
        {!watching ? (
          <button className="btn btn-outline" onClick={() => setWatching(true)} disabled={!baseline}>
            <RefreshCw size={15} aria-hidden /> I already started — watch for it
          </button>
        ) : (
          <span className="thinking" style={{ alignSelf: "center" }}>
            watching your account for the new Mind
          </span>
        )}
      </div>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.82rem" }}>
        Awakening happens on HelloMinds (one-click templates or build your own). The moment your
        new Mind exists, it appears here automatically and you can start training.
      </p>
    </div>
  );
}
