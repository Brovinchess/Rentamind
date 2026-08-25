"use client";

import { useState } from "react";
import Link from "next/link";

type Stage = "form" | "checkout" | "processing" | "done" | "error";

type RentResult = {
  rentalId: string;
  circleAdded: boolean;
  circleDetail?: string;
  mindEmail?: string | null;
  points: { steward: number; renter: number };
};

export default function RentPanel({
  listingId,
  title,
  ratePerDay,
  minDays,
  isLive,
}: {
  listingId: string;
  title: string;
  ratePerDay: number;
  minDays: number;
  isLive: boolean;
}) {
  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState("");
  const [days, setDays] = useState(minDays);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RentResult | null>(null);

  const cognition = ratePerDay * days;
  const platformFee = Math.round(cognition * 0.15);
  const usd = ((cognition + platformFee) / 100).toFixed(2); // demo rate: 100 Cognition ≈ $1

  async function confirm() {
    setStage("processing");
    setError("");
    try {
      const res = await fetch("/api/rent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, renterEmail: email, days }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Rental failed");
      setResult(data);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  }

  if (stage === "done" && result) {
    return (
      <div className="card" style={{ borderColor: "var(--good)", display: "grid", gap: 10 }}>
        <span className="pill pill-live" style={{ justifySelf: "start" }}>Rental active</span>
        <h3 style={{ margin: 0 }}>You&apos;ve rented {title} for {days} day{days > 1 ? "s" : ""}.</h3>
        {result.circleAdded ? (
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
            <b>{email}</b> was really added to this Mind&apos;s Circle on HelloMinds
            {result.mindEmail ? (
              <> — you can now email it directly at <b>{result.mindEmail}</b></>
            ) : null}
            . It will hear you until the rental expires.
          </p>
        ) : (
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
            This is a seeded demo Mind, so no real Circle change was made — on a live listing your
            email joins the Mind&apos;s Circle for the rental window.
          </p>
        )}
        <p style={{ margin: 0, fontSize: "0.9rem" }}>
          <b>+{result.points.renter} Synapses</b> for you · +{result.points.steward} for the steward.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {result.circleAdded ? (
            <Link className="btn btn-primary btn-sm" href={`/chat/${listingId}?renter=${encodeURIComponent(email)}`}>
              Chat with it now
            </Link>
          ) : null}
          <Link className="btn btn-ghost btn-sm" href="/points">View your Synapses</Link>
        </div>
      </div>
    );
  }

  if (stage === "checkout" || stage === "processing") {
    return (
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <span className="eyebrow section-eyebrow">Cognition checkout · demo</span>
        <h3 style={{ margin: 0 }}>Fuel this rental</h3>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
          Rentals are settled in Cognition — your payment tops up <b>{title}</b>&apos;s own cognition
          balance, which fuels every answer it gives you.
        </p>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr><td>Rental — {days} day{days > 1 ? "s" : ""} × {ratePerDay} Cognition</td><td style={{ textAlign: "right" }}>{cognition.toLocaleString()}</td></tr>
              <tr><td>Platform margin (15%)</td><td style={{ textAlign: "right" }}>{platformFee.toLocaleString()}</td></tr>
              <tr><td><b>Total</b></td><td style={{ textAlign: "right" }}><b>{(cognition + platformFee).toLocaleString()} Cognition ≈ ${usd}</b></td></tr>
            </tbody>
          </table>
        </div>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.78rem" }}>
          In production this is a Stripe Checkout via HelloMinds&apos; native per-Mind top-up
          endpoint. The demo simulates the payment and performs the real Circle grant.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={confirm} disabled={stage === "processing"}>
            {stage === "processing" ? "Adding you to the Circle…" : `Pay ${(cognition + platformFee).toLocaleString()} Cognition`}
          </button>
          <button className="btn btn-ghost" onClick={() => setStage("form")} disabled={stage === "processing"}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: "grid", gap: 4 }}>
      <h3 style={{ margin: "0 0 8px" }}>Rent this Mind</h3>
      {stage === "error" ? (
        <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: "0 0 8px" }}>{error}</p>
      ) : null}
      <div className="field">
        <label htmlFor="renter-email">Your email (joins the Mind&apos;s Circle)</label>
        <input
          id="renter-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="rent-days">Duration</label>
        <select id="rent-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[1, 3, 7, 14].filter((d) => d >= minDays).map((d) => (
            <option key={d} value={d}>{d} day{d > 1 ? "s" : ""} — {(ratePerDay * d).toLocaleString()} Cognition</option>
          ))}
        </select>
      </div>
      {!isLive ? (
        <p style={{ color: "var(--warn)", fontSize: "0.8rem", margin: "0 0 10px" }}>
          Seeded demo Mind — checkout is simulated end-to-end, no real Circle change.
        </p>
      ) : null}
      <button
        className="btn btn-primary"
        disabled={!/.+@.+\..+/.test(email)}
        onClick={() => setStage("checkout")}
      >
        Continue to checkout
      </button>
    </div>
  );
}
