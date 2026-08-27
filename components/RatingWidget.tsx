"use client";

import { useState } from "react";
import { Star } from "lucide-react";

export default function RatingWidget({
  rentalId,
  initialStars,
  initialComment,
}: {
  rentalId: string;
  initialStars?: number | null;
  initialComment?: string | null;
}) {
  const [stars, setStars] = useState(initialStars ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initialComment ?? "");
  const [saved, setSaved] = useState(!!initialStars);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(n: number) {
    setStars(n);
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rentalId, stars: n, comment }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "rating failed");
      setSaved(true);
      setMsg(d.firstRating ? "Thanks — +5 points for rating!" : "Rating updated.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ display: "grid", gap: 8, marginTop: 14, padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <b style={{ fontSize: "0.9rem" }}>{saved ? "Your rating" : "Rate this Mind"}</b>
        <span style={{ display: "inline-flex", gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              disabled={busy}
              onClick={() => submit(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--accent-deep)" }}
            >
              <Star size={20} strokeWidth={1.8} fill={n <= (hover || stars) ? "currentColor" : "none"} />
            </button>
          ))}
        </span>
        {msg ? <span className="mono" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{msg}</span> : null}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="Optional: one line about your experience"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ flex: 1, border: "1.5px solid var(--line)", borderRadius: 8, padding: "7px 10px", fontSize: "0.85rem" }}
        />
        {stars > 0 ? (
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => submit(stars)}>
            Save
          </button>
        ) : null}
      </div>
    </div>
  );
}
