"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-outline btn-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/signout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      {busy ? "…" : "Sign out"}
    </button>
  );
}
