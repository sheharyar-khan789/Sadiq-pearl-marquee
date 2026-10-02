// Customer profile editing (Phase 4): validation and storage contract.
//
// users/{uid} fields a customer can change through /api/account/profile:
//   name  (also copied to the Firebase Auth display name)
//   phone (optional; used to prefill booking requests)
// Everything else (uid, email, authProvider, emailVerified, timestamps) is
// owned by the server / Firebase Auth. Roles are never stored in Firestore.
// Address and CNIC are intentionally NOT collected: nothing needs them yet.

export interface CustomerProfile {
  uid: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  authProvider: string | null;
  emailVerified: boolean;
  updatedAt: string | null;
}

export interface ProfileUpdate {
  name: string;
  phone: string | null;
}

const ALLOWED = new Set(["name", "phone"]);
const CONTROL = /[\u0000-\u001F\u007F]/;

export function validateProfileUpdate(
  raw: unknown
): { ok: true; value: ProfileUpdate } | { ok: false; errors: Record<string, { code: string; message: string }> } {
  const errors: Record<string, { code: string; message: string }> = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: { body: { code: "invalid_body", message: "The request could not be read." } } };
  }
  const body = raw as Record<string, unknown>;
  const unexpected = Object.keys(body).filter((k) => !ALLOWED.has(k));
  if (unexpected.length) errors.body = { code: "unexpected_field", message: `Unexpected field(s): ${unexpected.join(", ")}.` };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 100 || CONTROL.test(name)) {
    errors.name = { code: "invalid_name", message: "Please enter your name (2–100 characters)." };
  }

  let phone: string | null = null;
  if (body.phone !== undefined && body.phone !== null && body.phone !== "") {
    const p = typeof body.phone === "string" ? body.phone.trim() : "";
    const digits = p.replace(/\D/g, "");
    if (!/^\+?[\d\s()-]+$/.test(p) || digits.length < 10 || digits.length > 15) {
      errors.phone = { code: "invalid_phone", message: "Please enter a valid phone number (at least 10 digits), or leave it empty." };
    } else phone = p;
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, phone } };
}

/** Identity facts that come from the verified session, never from the browser. */
export interface SessionIdentity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  signInProvider: string | null;
}

/** What a fresh sign-in tells us about the account (from the verified ID token). */
export interface SignInIdentity extends SessionIdentity {
  name: string | null;
  photoURL: string | null;
}

export interface ProfileStore {
  get(uid: string): Promise<CustomerProfile | null>;
  /**
   * Creates users/{uid} on first sign-in, or keeps emailVerified (and a
   * missing name) in step. Never overwrites a name or phone the customer set.
   */
  ensure(identity: SignInIdentity): Promise<void>;
  /** Admin only (Phase 5): customer profiles, most recently updated first. */
  list(limit: number): Promise<CustomerProfile[]>;
  /** Saves name/phone; creates the document from the session identity if missing. */
  update(identity: SessionIdentity, update: ProfileUpdate): Promise<CustomerProfile>;
  /** Keeps the stored email in step with Firebase Auth after an email change. */
  syncEmail(uid: string, email: string): Promise<void>;
}

/** TEST-ONLY in-memory profile store (unit tests and the local E2E mode). */
export class MemoryProfileStore implements ProfileStore {
  private docs = new Map<string, CustomerProfile>();
  async get(uid: string) {
    const d = this.docs.get(uid);
    return d ? { ...d } : null;
  }
  async list(limit: number) {
    return [...this.docs.values()].slice(0, limit).map((d) => ({ ...d }));
  }
  async ensure(identity: SignInIdentity) {
    const current = this.docs.get(identity.uid);
    this.docs.set(identity.uid, {
      uid: identity.uid,
      email: current?.email ?? identity.email,
      authProvider: current?.authProvider ?? (identity.signInProvider === "google.com" ? "google.com" : "password"),
      emailVerified: identity.emailVerified,
      name: current?.name ?? identity.name,
      phone: current?.phone ?? null,
      updatedAt: new Date().toISOString(),
    });
  }
  /** TEST-ONLY seeding. */
  seed(profiles: CustomerProfile[]) {
    for (const p of profiles) this.docs.set(p.uid, { ...p });
  }
  async update(identity: SessionIdentity, update: ProfileUpdate) {
    const current = this.docs.get(identity.uid);
    const next: CustomerProfile = {
      uid: identity.uid,
      email: current?.email ?? identity.email,
      authProvider: current?.authProvider ?? identity.signInProvider,
      emailVerified: identity.emailVerified,
      name: update.name,
      phone: update.phone,
      updatedAt: new Date().toISOString(),
    };
    this.docs.set(identity.uid, next);
    return { ...next };
  }
  async syncEmail(uid: string, email: string) {
    const d = this.docs.get(uid);
    if (d) this.docs.set(uid, { ...d, email });
  }
}
