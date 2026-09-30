"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { finishConnect } from "@/lib/oauth-browser";

/**
 * HelloMinds sends the user back here after sign-in / consent. Must match the
 * redirect URI registered on the OAuth client exactly.
 */
export default function OAuthCallback() {
  const router = useRouter();
  const [error, setError] = useState("");
  // The PKCE verifier is single-use: handleRedirect clears it. React runs
  // effects twice in development, and a second exchange would fail with a
  // state mismatch — so run exactly once.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    finishConnect()
      .then(({ next }) => {
        router.replace(next);
        router.refresh();
      })
      .catch((e: unknown) => {
        const err = e as { error?: string; errorDescription?: string; message?: string };
        // The user pressing "deny" on the consent screen isn't a failure worth alarming about.
        if (err?.error === "access_denied") {
          setError("You didn't grant access, so you're not signed in. You can try again any time.");
        } else {
          setError(err?.errorDescription || err?.message || "Sign-in failed.");
        }
      });
  }, [router]);

  return (
    <main
      className="container"
      style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div className="card" style={{ maxWidth: 440, width: "100%", display: "grid", gap: 12 }}>
        {error ? (
          <>
            <b>Couldn&apos;t finish signing in</b>
            <p style={{ margin: 0, color: "var(--danger)", fontSize: "0.88rem" }}>{error}</p>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.8rem" }}>
              Sign-in has to finish in the same browser tab it started in.
            </p>
            <Link href="/login" className="btn btn-primary">
              Try again
            </Link>
          </>
        ) : (
          <span className="thinking" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2 size={14} className="spin" aria-hidden /> Connecting your HelloMinds account
          </span>
        )}
      </div>
    </main>
  );
}
