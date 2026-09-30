"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";

type MindRow = { mindId: string; name: string; isEnabled: boolean; createdAt: string | null };
type Role = { category: string; title: string; description: string; hasChildren: boolean };

const POLL_MS = 12_000;
const NAME_DEBOUNCE_MS = 450;
/** HelloMinds names are lowercase, no spaces — mirror that before we check. */
const normalizeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]/g, "");

export default function LaunchFlow() {
  /* ── step 1: role ── */
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [parent, setParent] = useState<Role | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  /* ── step 2: name ── */
  const [name, setName] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  /* ── step 3: awaken + detect ── */
  const [baseline, setBaseline] = useState<Set<string> | null>(null);
  const [newMinds, setNewMinds] = useState<MindRow[]>([]);
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState("");
  const baselineRef = useRef<Set<string> | null>(null);

  const loadRoles = useCallback(async (parentCategory?: string) => {
    setRolesLoading(true);
    try {
      const res = await fetch(`/api/launch${parentCategory ? `?parentCategory=${encodeURIComponent(parentCategory)}` : ""}`);
      const d = await res.json();
      setRoles(d.roles ?? []);
    } catch {
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

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

  // Live name-availability check against the HelloMinds Core API.
  useEffect(() => {
    const clean = normalizeName(name);
    if (clean.length < 3) {
      setAvailable(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/launch?name=${encodeURIComponent(clean)}`);
        const d = await res.json();
        setAvailable(typeof d.available === "boolean" ? d.available : null);
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, NAME_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [name]);

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

  /* ── done ── */
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
            <Link href="/studio" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }}>
              Give it a persona
            </Link>
            <Link href={`/talk/${m.mindId}`} className="btn btn-outline btn-sm">
              Say hello
            </Link>
          </div>
        ))}
      </div>
    );
  }

  const cleanName = normalizeName(name);
  const nameReady = cleanName.length >= 3 && available === true;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error ? <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0 }}>{error}</p> : null}

      {/* ── step 1: what should it be? ── */}
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="step-num mono">01</span>
          <b>What should it be good at?</b>
          {role ? (
            <span className="pill pill-label">
              {parent ? `${parent.title} · ` : ""}
              {role.title}
            </span>
          ) : null}
          {parent && !role ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setParent(null);
                loadRoles();
              }}
            >
              <ArrowLeft size={13} aria-hidden /> All roles
            </button>
          ) : null}
          {role ? (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: "auto" }}
              onClick={() => {
                setRole(null);
                setParent(null);
                loadRoles();
              }}
            >
              Change
            </button>
          ) : null}
        </div>

        {role ? (
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>{role.description}</p>
        ) : rolesLoading ? (
          <span className="thinking">loading roles from HelloMinds</span>
        ) : !roles.length ? (
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
            Couldn&apos;t reach the HelloMinds role catalog — you can still name your Mind and awaken it below.
          </p>
        ) : (
          <div className="role-grid">
            {roles.map((r) => (
              <button
                key={r.category}
                className="role-card"
                onClick={() => {
                  if (r.hasChildren && !parent) {
                    setParent(r);
                    loadRoles(r.category);
                  } else {
                    setRole(r);
                  }
                }}
              >
                <b>{r.title}</b>
                <span>{r.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── step 2: name it ── */}
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="step-num mono">02</span>
          <b>Give it a name</b>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="lf-name">Mind name — lowercase, no spaces</label>
          <input
            id="lf-name"
            placeholder="e.g. sunwukong"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="mono" style={{ fontSize: "0.72rem", minHeight: 18 }}>
          {cleanName.length < 3 ? (
            <span style={{ color: "var(--muted)" }}>at least 3 characters</span>
          ) : checking ? (
            <span style={{ color: "var(--muted)" }}>
              <Loader2 size={11} className="spin" aria-hidden /> checking @{cleanName} on HelloMinds…
            </span>
          ) : available === true ? (
            <span style={{ color: "var(--good)" }}>
              <Check size={11} aria-hidden /> @{cleanName} is available
            </span>
          ) : available === false ? (
            <span style={{ color: "var(--danger)" }}>
              <X size={11} aria-hidden /> @{cleanName} is already taken
            </span>
          ) : (
            <span style={{ color: "var(--muted)" }}>couldn&apos;t check that name right now</span>
          )}
        </div>
      </div>

      {/* ── step 3: awaken ── */}
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="step-num mono">03</span>
          <b>Awaken it</b>
        </div>
        {nameReady ? (
          <p style={{ margin: 0, fontSize: "0.88rem" }}>
            Create it as <b>@{cleanName}</b>
            {role ? (
              <>
                {" "}
                for <b>{role.title}</b>
              </>
            ) : null}
            . HelloMinds opens in a new tab; come back here and this page picks it up automatically.
          </p>
        ) : (
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
            Pick an available name above and we&apos;ll carry it over.
          </p>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href="https://app.hellominds.ai/onboarding"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            onClick={() => setWatching(true)}
          >
            Awaken on HelloMinds <ExternalLink size={15} aria-hidden />
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
      </div>
    </div>
  );
}
