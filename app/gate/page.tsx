"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brain } from "lucide-react";

function GateForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Wrong code");
      }
      router.replace(params.get("next") || "/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 380, width: "100%", display: "grid", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div className="avatar" style={{ width: 40, height: 40 }}>
          <Brain size={22} aria-hidden />
        </div>
        <div>
          <b>Private demo</b>
          <div className="mono" style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
            Rent a Mind · access code required
          </div>
        </div>
      </div>
      {error ? (
        <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: "0 0 6px" }}>{error}</p>
      ) : null}
      <div className="field">
        <label htmlFor="gate-code">Access code</label>
        <input
          id="gate-code"
          type="password"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && code && submit()}
        />
      </div>
      <button className="btn btn-primary" onClick={submit} disabled={busy || !code}>
        {busy ? "Checking…" : "Enter"}
      </button>
    </div>
  );
}

export default function GatePage() {
  return (
    <main
      className="container"
      style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <Suspense>
        <GateForm />
      </Suspense>
    </main>
  );
}
