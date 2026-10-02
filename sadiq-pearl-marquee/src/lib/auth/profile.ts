// Customer profile (users/{uid}) sync from the browser. The profile itself is
// written on the server with the Admin SDK (src/lib/account/ensure-profile.ts),
// from the verified session; the browser only asks for it to be synced.

/** Thrown when the server could not save the profile. */
export class ProfileSyncError extends Error {
  readonly code = "profile/failed";
}

/**
 * Asks the server to create/refresh the signed-in customer's profile.
 * Returns false when there is no server session yet (nothing to sync);
 * throws ProfileSyncError if the server couldn't save it.
 */
export async function syncProfileOnServer(): Promise<boolean> {
  const res = await fetch("/api/account/profile/sync", { method: "POST", credentials: "same-origin" });
  if (res.status === 401) return false;
  if (!res.ok) throw new ProfileSyncError(`Profile sync failed (${res.status})`);
  return true;
}
