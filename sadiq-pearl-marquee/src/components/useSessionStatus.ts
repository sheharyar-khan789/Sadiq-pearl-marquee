"use client";

import { useCallback, useEffect, useState } from "react";

export type SessionStatus =
  | { state: "loading" }
  | { state: "signed-out" }
  | { state: "signed-in"; name: string | null; email: string | null };

/**
 * The visitor's customer session, read from the server (the session cookie is
 * httpOnly). Public pages stay static; only this small request is per-visitor.
 */
export function useSessionStatus(): { status: SessionStatus; markSignedOut: () => void } {
  const [status, setStatus] = useState<SessionStatus>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : { signedIn: false }))
      .then((data: { signedIn?: boolean; name?: string | null; email?: string | null }) => {
        if (cancelled) return;
        setStatus(data.signedIn ? { state: "signed-in", name: data.name ?? null, email: data.email ?? null } : { state: "signed-out" });
      })
      .catch(() => {
        if (!cancelled) setStatus({ state: "signed-out" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const markSignedOut = useCallback(() => setStatus({ state: "signed-out" }), []);
  return { status, markSignedOut };
}
