"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Lands here from the sign-in email link. The Supabase browser client detects
 * the session in the URL (implicit flow), writes the auth cookies, then we
 * bounce to the destination.
 */
function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState("Signing you in…");

  useEffect(() => {
    const supa = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const finish = (ok: boolean) => {
      if (ok) {
        const next = params.get("next") || "/profile";
        window.location.replace(next.startsWith("/") ? next : "/profile");
      } else {
        setStatus("That sign-in link is invalid or expired — request a new one.");
      }
    };

    (async () => {
      // The email link lands with tokens in the URL fragment (implicit flow).
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supa.auth.setSession({ access_token, refresh_token });
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        finish(!error);
        return;
      }
      // Fallback: PKCE-style ?code= link.
      const code = params.get("code");
      if (code) {
        const { error } = await supa.auth.exchangeCodeForSession(code);
        finish(!error);
        return;
      }
      const { data } = await supa.auth.getSession();
      finish(!!data.session);
    })();
  }, [params, router]);

  return (
    <main
      className="container"
      style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div className="card" style={{ maxWidth: 380, textAlign: "center" }}>
        <p style={{ margin: 0 }}>{status}</p>
        {status.includes("invalid") ? (
          <a href="/login" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
            Back to sign in
          </a>
        ) : null}
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackInner />
    </Suspense>
  );
}
