"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PillButton } from "@/components/ui/pill-button";

// "End session and start new": archives the session (POST
// /api/sessions/[id]/end) and lands the owner back on the sessions page,
// where both "Start a class session" and "Solo play" are offered again.
// Unlike Reset Simulation (which restarts the *same* session in place), this
// retires the session entirely: region logins stop working and a fresh
// session gets new logins and a new projector link.
export function EndSessionButton({
  sessionId,
  mode,
  tone = "ghost-dark",
  size = "sm",
}: {
  sessionId: string;
  mode: "instructor" | "demo";
  tone?: "ghost-dark" | "ghost";
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const { update } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnd() {
    const what = mode === "instructor" ? "class session" : "solo game";
    const consequence =
      mode === "instructor"
        ? " All six region logins will stop working and the projector link will close."
        : "";
    if (!window.confirm(`End this ${what} and go back to start a new one?${consequence} This cannot be undone.`)) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
    if (!res.ok) {
      setPending(false);
      setError("Couldn't end the session.");
      return;
    }
    // Re-resolve the JWT's role (see app/(public)/sessions/page.tsx
    // refreshRole for why the empty-object argument is load-bearing).
    await update({});
    router.push("/sessions");
    router.refresh();
  }

  return (
    <>
      <PillButton type="button" tone={tone} size={size} onClick={handleEnd} disabled={pending}>
        {pending ? "Ending…" : "End session & start new"}
      </PillButton>
      {error && <span className="text-xs text-accent-300">{error}</span>}
    </>
  );
}
