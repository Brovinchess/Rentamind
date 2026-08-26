"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SettleButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/settle", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "settle failed");
      setMsg(`Expired ${data.expired} rental${data.expired === 1 ? "" : "s"}`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {msg ? <span className="mono" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{msg}</span> : null}
      <button className="btn btn-outline btn-sm" onClick={run} disabled={busy}>
        {busy ? "Settling…" : "Settle rentals"}
      </button>
    </span>
  );
}
