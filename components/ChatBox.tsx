"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Msg = { fingerprint?: string; text: string; fromMind: boolean; pending?: boolean };
type Session = {
  walletBalance: number;
  pricePerMessage: number;
  messagesUsed: number;
  cognitionSpent: number;
  endsAt: string;
};
type Task = "ask" | "draft" | "predict";

const POLL_MS = 8_000;
const TASKS: { value: Task; label: string; hint: string }[] = [
  { value: "ask", label: "Ask", hint: "Ask it anything in persona" },
  { value: "draft", label: "Draft", hint: "Have it write something in its voice" },
  { value: "predict", label: "Predict", hint: "What would the persona do or say?" },
];

export default function ChatBox({
  listingId,
  mindId,
  rentalId,
  starters,
}: {
  listingId?: string;
  mindId?: string;
  rentalId?: string;
  starters?: { label: string; text: string }[];
}) {
  const isRenter = !!listingId;
  const targetQuery = listingId
    ? `listingId=${listingId}${rentalId ? `&rentalId=${rentalId}` : ""}`
    : `mindId=${mindId}`;
  const targetBody = listingId ? { listingId, rentalId } : { mindId };
  const [messages, setMessages] = useState<Msg[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [task, setTask] = useState<Task>("ask");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const waitingRef = useRef(false);
  const stickToBottom = useRef(true);

  const loadHistory = useCallback(async () => {
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
      if (d.session) setSession(d.session);
      setError("");
    } catch {
      // transient poll failure — keep the current transcript
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetQuery]);

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
        body: JSON.stringify({ ...targetBody, text, task }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "send failed");
      if (typeof data.walletBalance === "number" && session) {
        setSession({
          ...session,
          walletBalance: data.walletBalance,
          messagesUsed: session.messagesUsed + 1,
          cognitionSpent: session.cognitionSpent + session.pricePerMessage,
        });
      }
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
      {isRenter && session ? (
        <div
          className="mono"
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            fontSize: "0.7rem",
            color: "var(--muted)",
            paddingBottom: 10,
            borderBottom: "1px solid var(--line)",
          }}
        >
          <span>Balance <b style={{ color: "var(--ink)" }}>{Math.floor(session.walletBalance).toLocaleString()}</b></span>
          <span>{session.pricePerMessage} cognition / message</span>
          <span>Spent <b style={{ color: "var(--ink)" }}>{Math.floor(session.cognitionSpent)}</b> · {session.messagesUsed} msgs</span>
          <span style={{ marginLeft: "auto" }}>ends {new Date(session.endsAt).toLocaleDateString()}</span>
        </div>
      ) : null}
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
        {waiting ? <div className="thinking">the Mind is reasoning</div> : null}
      </div>
      {error ? <p style={{ color: "var(--danger)", fontSize: "0.82rem", margin: "8px 0 0" }}>{error}</p> : null}
      {starters?.length && !messages.some((m) => !m.fromMind) ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 10 }}>
          {starters.map((s) => (
            <button key={s.label} className="btn btn-ghost btn-sm" onClick={() => setInput(s.text)} disabled={waiting}>
              {s.label}
            </button>
          ))}
        </div>
      ) : null}
      {isRenter ? (
        <div style={{ display: "flex", gap: 6, paddingTop: 10 }}>
          {TASKS.map((t) => (
            <button
              key={t.value}
              className={`btn btn-sm ${task === t.value ? "btn-primary" : "btn-ghost"}`}
              title={t.hint}
              onClick={() => setTask(t.value)}
              disabled={waiting}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="chat-input">
        <input
          placeholder={
            isRenter
              ? task === "draft"
                ? "Describe what it should write for you…"
                : task === "predict"
                  ? "Describe the scenario to predict…"
                  : "Ask the Mind anything…"
              : "Ask the Mind anything…"
          }
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
