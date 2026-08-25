"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Msg = { fingerprint?: string; text: string; fromMind: boolean; pending?: boolean };

const POLL_MS = 8_000;

export default function ChatBox({ listingId, mindId }: { listingId?: string; mindId?: string }) {
  const targetQuery = listingId ? `listingId=${listingId}` : `mindId=${mindId}`;
  const targetBody = listingId ? { listingId } : { mindId };
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const waitingRef = useRef(false);
  const stickToBottom = useRef(true);

  const loadHistory = useCallback(async () => {
    // Server history is the source of truth; skip while a send is in flight
    // so we don't clobber the optimistic message.
    if (waitingRef.current) return;
    try {
      const res = await fetch(`/api/chat?${targetQuery}`);
      const d = await res.json();
      if (d.error) {
        setError((prev) => prev || d.error);
        return;
      }
      if (waitingRef.current) return;
      setMessages(d.messages ?? []);
      setError("");
    } catch {
      // transient poll failure — keep the current transcript
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetQuery]);

  // Initial load + background sync while the box is open.
  useEffect(() => {
    let alive = true;
    loadHistory().finally(() => alive && setLoading(false));
    const timer = setInterval(loadHistory, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [loadHistory]);

  useEffect(() => {
    if (stickToBottom.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages, waiting]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  async function send() {
    const text = input.trim();
    if (!text || waiting) return;
    setInput("");
    setError("");
    setMessages((m) => [...m, { text, fromMind: false, pending: true }]);
    setWaiting(true);
    waitingRef.current = true;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...targetBody, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "send failed");
      if (data.timedOut) {
        setError("Still thinking — the reply will appear here automatically when it lands.");
      } else if (data.reply) {
        setMessages((m) => [...m, { text: data.reply, fromMind: true }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWaiting(false);
      waitingRef.current = false;
      loadHistory();
    }
  }

  return (
    <div className="card chat-box" style={{ marginTop: 14 }}>
      <div className="chat-scroll" ref={scrollRef} onScroll={onScroll}>
        {loading ? <div className="thinking">syncing transcript</div> : null}
        {!loading && !messages.length ? (
          <div className="empty" style={{ padding: "24px 0" }}>
            Say hello — this is a live conversation with the Mind.
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={m.fingerprint ?? `local-${i}`} className={`bubble ${m.fromMind ? "mind" : "me"}`}>
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
