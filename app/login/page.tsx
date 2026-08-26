"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brain } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [invite, setInvite] = useState("");
  const [needsInvite, setNeedsInvite] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestCode() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, inviteCode: invite || undefined, next: params.get("next") || "/profile" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not send code");
      if (d.needsInvite) {
        setNeedsInvite(true);
        if (d.error) setError(d.error);
        return;
      }
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: code }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Invalid code");
      router.replace(params.get("next") || "/profile");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 400, width: "100%", display: "grid", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div className="avatar" style={{ width: 40, height: 40 }}>
          <Brain size={22} aria-hidden />
        </div>
        <div>
          <b>Sign in to Rent a Mind</b>
          <div className="mono" style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
            email code · no password
          </div>
        </div>
      </div>
      {error ? <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: "0 0 6px" }}>{error}</p> : null}

      {step === "email" ? (
        <>
          <div className="field">
            <label htmlFor="li-email">Email</label>
            <input
              id="li-email"
              type="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && email && requestCode()}
            />
          </div>
          {needsInvite ? (
            <div className="field">
              <label htmlFor="li-invite">Invite code (new accounts, Season 0)</label>
              <input
                id="li-invite"
                autoFocus
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && invite && requestCode()}
              />
            </div>
          ) : null}
          <button className="btn btn-primary" onClick={requestCode} disabled={busy || !/.+@.+\..+/.test(email)}>
            {busy ? "Sending…" : needsInvite ? "Join with invite" : "Send sign-in code"}
          </button>
        </>
      ) : (
        <>
          <p style={{ margin: "0 0 6px", fontSize: "0.92rem" }}>
            Check your inbox — we sent a <b>sign-in link</b> to <b>{email}</b>. Click it and you&apos;re in.
          </p>
          <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: "0.8rem" }}>
            Got a 6-digit code instead? Enter it below.
          </p>
          <div className="field">
            <label htmlFor="li-code">Code (optional)</label>
            <input
              id="li-code"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && verify()}
            />
          </div>
          <button className="btn btn-primary" onClick={verify} disabled={busy || code.length !== 6}>
            {busy ? "Checking…" : "Sign in with code"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setStep("email")} disabled={busy}>
            Different email
          </button>
        </>
      )}
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
