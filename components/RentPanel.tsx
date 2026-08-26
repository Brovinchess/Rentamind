"use client";

import { useState } from "react";
import Link from "next/link";

type Stage = "form" | "processing" | "done" | "error";

type RentResult = {
  rentalId: string;
  alreadyRenting?: boolean;
  walletBalance: number;
  pricePerMessage: number;
  points: { steward: number; renter: number };
};

export default function RentPanel({
  listingId,
  title,
  pricePerMessage,
  minDays,
  isLive,
}: {
  listingId: string;
  title: string;
  pricePerMessage: number;
  minDays: number;
  isLive: boolean;
}) {
  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState("");
  const [days, setDays] = useState(Math.max(7, minDays));
  const [error, setError] = useState("");
  const [result, setResult] = useState<RentResult | null>(null);

  async function rent() {
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
        <span className="pill pill-live" style={{ justifySelf: "start" }}>
          {result.alreadyRenting ? "Already renting" : "Rental started"}
        </span>
        <h3 style={{ margin: 0 }}>
          {result.alreadyRenting ? `You're already renting ${title}.` : `You're renting ${title}.`}
        </h3>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
          Your cognition balance: <b>{Math.floor(result.walletBalance).toLocaleString()}</b> · each
          message costs <b>{result.pricePerMessage}</b>. You earn points for every cognition you
          spend; the trainer earns points too.
        </p>
        {!result.alreadyRenting ? (
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            <b>+{result.points.renter} points</b> for you · +{result.points.steward} for the trainer.
          </p>
        ) : null}
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.8rem" }}>
          The chat button is your rental link — bookmark it, it works for the whole rental window.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn btn-primary btn-sm" href={`/chat/${listingId}?rental=${result.rentalId}`}>
            Start chatting
          </Link>
          <Link className="btn btn-ghost btn-sm" href="/rewards">View your rewards</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: "grid", gap: 4 }}>
      <h3 style={{ margin: "0 0 4px" }}>Rent this Mind</h3>
      <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: "0.88rem" }}>
        Free to start — you pay <b>{pricePerMessage} cognition per message</b> from your balance.
        New renters get <b>1,000 cognition free</b> (Season 0). Every cognition you spend earns you
        points toward the airdrop.
      </p>
      {stage === "error" ? (
        <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: "0 0 8px" }}>{error}</p>
      ) : null}
      <div className="field">
        <label htmlFor="renter-email">Your email</label>
        <input
          id="renter-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="rent-days">Access period</label>
        <select id="rent-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[3, 7, 14, 30].filter((d) => d >= minDays).map((d) => (
            <option key={d} value={d}>{d} days</option>
          ))}
        </select>
      </div>
      {!isLive ? (
        <p style={{ color: "var(--warn)", fontSize: "0.8rem", margin: "0 0 10px" }}>
          This listing has no live Mind attached.
        </p>
      ) : null}
      <button
        className="btn btn-primary"
        disabled={!/.+@.+\..+/.test(email) || stage === "processing" || !isLive}
        onClick={rent}
      >
        {stage === "processing" ? "Opening your session…" : "Start renting — free"}
      </button>
    </div>
  );
}
