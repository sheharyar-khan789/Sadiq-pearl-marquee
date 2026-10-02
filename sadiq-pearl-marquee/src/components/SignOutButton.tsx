"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";

/**
 * Ends the server session (revoked everywhere) and the browser's Firebase
 * session, then goes to `redirectTo`. Used outside AuthProvider (navbar, admin).
 */
export async function endSession(): Promise<void> {
  try {
    await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" });
  } catch {
    // The cookie may already be gone; the browser session is still cleared below.
  }
  if (isFirebaseConfigured) {
    try {
      await signOut(getFirebase().auth);
    } catch {
      // Nothing else to clean up.
    }
  }
}

export default function SignOutButton({
  redirectTo,
  className,
  children = "Sign out",
}: {
  redirectTo: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={async () => {
        setBusy(true);
        await endSession();
        router.replace(redirectTo);
        router.refresh();
      }}
      className={className}
    >
      {busy ? "Signing out…" : children}
    </button>
  );
}
