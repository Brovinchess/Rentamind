"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";

const AMOUNTS = [200, 500, 1000, 2500];
const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/**
 * Fund a Mind's cognition with a card, via the Core API's public Stripe
 * checkout. When Ethoswarm rejects the checkout (which it does for every Mind
 * we've tested), we say so and point at the manual route instead of failing
 * silently.
 */
export default function TopUpPanel({ mindId, mindName }: { mindId: string; mindName: string }) {
  const [amount, setAmount] = useState(AMOUNTS[1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [upstream, setUpstream] = useState(false);

  async function topUp() {
    setBusy(true);
    setError("");
    setUpstream(false);
    try {
      const res = await fetch("/api/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mindId, amountCents: amount }),
      });
      const d = await res.json();
      if (d.url) {
        window.location.href = d.url;
        return;
      }
      setError(d.error ?? "Top-up unavailable.");
      setUpstream(!!d.upstream);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="topup-row">
        {AMOUNTS.map((a) => (
          <button
            key={a}
            className={`amount ${a === amount ? "active" : ""}`}
            onClick={() => setAmount(a)}
            disabled={busy}
          >
            {dollars(a)}
          </button>
        ))}
        <button className="btn btn-primary btn-sm" onClick={topUp} disabled={busy}>
          {busy ? <Loader2 size={13} className="spin" aria-hidden /> : <CreditCard size={13} aria-hidden />}
          {busy ? "Opening checkout…" : `Top up @${mindName}`}
        </button>
      </div>
      {error ? (
        <div style={{ fontSize: "0.82rem", color: upstream ? "var(--warn)" : "var(--danger)" }}>
          {upstream ? (
            <>
              HelloMinds declined the card top-up for this Mind ({error}). Its payment setup lives on
              their side — top it up directly at{" "}
              <a
                href="https://app.hellominds.ai"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--brand)", fontWeight: 700 }}
              >
                app.hellominds.ai <ExternalLink size={11} aria-hidden />
              </a>
              .
            </>
          ) : (
            error
          )}
        </div>
      ) : null}
    </div>
  );
}
