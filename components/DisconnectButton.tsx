"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Unplug } from "lucide-react";

/**
 * Revokes our HelloMinds access entirely. Unlike "Sign out", this stops the
 * user's Minds studying and being rented, so it asks first.
 */
export default function DisconnectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-ghost btn-sm"
      disabled={busy}
      onClick={async () => {
        const ok = window.confirm(
          "Disconnect Rent a Mind from HelloMinds?\n\n" +
            "Your Minds will stop studying, and renters won't be able to chat with them, " +
            "until you connect again. Your listings, plans and points are kept.",
        );
        if (!ok) return;
        setBusy(true);
        await fetch("/api/auth/oauth", { method: "DELETE" });
        router.push("/");
        router.refresh();
      }}
    >
      <Unplug size={13} aria-hidden /> {busy ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
