"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brain, KeyRound } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function login() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ builderKey: key }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Sign in failed");
      const next = params.get("next") || "/my-minds";
      router.replace(next.startsWith("/") ? next : "/my-minds");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 440, width: "100%", display: "grid", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div className="avatar" style={{ width: 40, height: 40 }}>
          <Brain size={22} aria-hidden />
        </div>
        <div>
          <b>Sign in with your Builder key</b>
          <div className="mono" style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
            your HelloMinds Builder API key is your account
          </div>
        </div>
      </div>
      {error ? <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: "0 0 6px" }}>{error}</p> : null}
      <div className="field">
        <label htmlFor="li-key">Builder API key</label>
        <textarea
          id="li-key"
          rows={4}
          autoFocus
          placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOi…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          style={{ fontFamily: "var(--font-space-mono), monospace", fontSize: "0.72rem", wordBreak: "break-all" }}
        />
      </div>
      <button className="btn btn-primary" onClick={login} disabled={busy || key.trim().length < 40}>
        <KeyRound size={15} aria-hidden /> {busy ? "Checking your key…" : "Sign in"}
      </button>
      <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: "0.8rem" }}>
        Don&apos;t have one? Create a Mind at{" "}
        <a href="https://hellominds.ai" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", fontWeight: 700 }}>
          hellominds.ai
        </a>{" "}
        then create a Builder API key in the{" "}
        <a href="https://build.hellominds.ai/en/docs/get-started/account-setup" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", fontWeight: 700 }}>
          Builder console
        </a>
        . Your key is stored encrypted and only used to talk to your own Minds.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main
      className="container"
      style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
