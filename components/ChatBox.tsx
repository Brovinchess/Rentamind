"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { fingerprint?: string; text: string; fromMind: boolean; pending?: boolean };

export default function ChatBox({ listingId, mindId }: { listingId?: string; mindId?: string }) {
  const targetQuery = listingId ? `listingId=${listingId}` : `mindId=${mindId}`;
  const targetBody = listingId ? { listingId } : { mindId };
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/chat?${targetQuery}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) setError(d.error);
        else setMessages(d.messages ?? []);
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, mindId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, waiting]);

  async function send() {
    const text = input.trim();
    if (!text || waiting) return;
    setInput("");
    setError("");
    setMessages((m) => [...m, { text, fromMind: false }]);
    setWaiting(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...targetBody, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "send failed");
      if (data.timedOut) {
        setError("The Mind is still thinking — its reply will appear in history shortly. Try refreshing in a minute.");
      } else if (data.reply) {
        setMessages((m) => [...m, { text: data.reply, fromMind: true }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWaiting(false);
    }
  }

  return (
    <div className="card chat-box" style={{ marginTop: 14 }}>
      <div className="chat-scroll" ref={scrollRef}>
        {loading ? <div className="thinking">loading transcript</div> : null}
        {!loading && !messages.length ? (
          <div className="empty" style={{ padding: "24px 0" }}>
            Say hello — this is a live conversation with the rented Mind.
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={m.fingerprint ?? i} className={`bubble ${m.fromMind ? "mind" : "me"}`}>
            <span className="who">{m.fromMind ? "Mind" : "You"}</span>
            {m.text}
          </div>
        ))}
        {waiting ? <div className="thinking">the Mind is reasoning (burns real cognition)</div> : null}
      </div>
      {error ? <p style={{ color: "var(--danger)", fontSize: "0.82rem", margin: "8px 0 0" }}>{error}</p> : null}
      <div className="chat-input">
        <input
          placeholder="Ask the Mind anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={waiting}
        />
        <button className="btn btn-primary" onClick={send} disabled={waiting || !input.trim()}>
          {waiting ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
