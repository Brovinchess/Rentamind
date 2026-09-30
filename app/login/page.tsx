"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Brain, LogIn } from "lucide-react";
import { safeNext, startConnect } from "@/lib/oauth-browser";

function LoginCard() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reason = params.get("reason");

  async function connect() {
    setBusy(true);
    setError("");
    try {
      await startConnect(safeNext(params.get("next")));
      // navigates away on success
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 440, width: "100%", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="avatar" style={{ width: 40, height: 40 }}>
          <Brain size={22} aria-hidden />
        </div>
        <div>
          <b>Sign in to Rent a Mind</b>
          <div className="mono" style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
            with your HelloMinds account
          </div>
        </div>
      </div>

      {reason === "reconnect" ? (
        <p className="notice" style={{ margin: 0, fontSize: "0.84rem" }}>
          Your HelloMinds connection has expired or was revoked. Connect again to pick up where you
          left off — your Minds, listings and points are all still here.
        </p>
      ) : null}
      {error ? <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0 }}>{error}</p> : null}

      <button className="btn btn-primary" onClick={connect} disabled={busy}>
        <LogIn size={15} aria-hidden /> {busy ? "Opening HelloMinds…" : "Connect with HelloMinds"}
      </button>

      <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.8rem" }}>
        You&apos;ll sign in on HelloMinds and approve what Rent a Mind can do: see your Minds and
        their cognition, train them, equip skills, and carry on the conversations renters pay for.
        We never see your HelloMinds password.
      </p>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.8rem" }}>
        New to HelloMinds?{" "}
        <a
          href="https://hellominds.ai"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--brand)", fontWeight: 700 }}
        >
          Create an account
        </a>{" "}
        first, then come back here.
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
        <LoginCard />
      </Suspense>
    </main>
  );
}
