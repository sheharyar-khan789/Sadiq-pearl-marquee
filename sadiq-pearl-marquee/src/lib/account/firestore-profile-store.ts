// Firestore implementation of ProfileStore — SERVER ONLY (Admin SDK).
// Imported only by src/lib/booking/server.ts (which carries "server-only").
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import type { CustomerProfile, ProfileStore } from "./profile.ts";

const USERS = "users";

function toProfile(uid: string, d: FirebaseFirestore.DocumentData): CustomerProfile {
  return {
    uid,
    email: typeof d.email === "string" ? d.email : null,
    name: typeof d.name === "string" ? d.name : null,
    phone: typeof d.phone === "string" ? d.phone : null,
    authProvider: typeof d.authProvider === "string" ? d.authProvider : null,
    emailVerified: d.emailVerified === true,
    updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toDate().toISOString() : null,
  };
}

export function firestoreProfileStore(db: Firestore): ProfileStore {
  const users = db.collection(USERS);
  return {
    async get(uid) {
      const snap = await users.doc(uid).get();
      return snap.exists ? toProfile(uid, snap.data()!) : null;
    },
    async list(limit) {
      const snap = await users.limit(limit).get();
      return snap.docs
        .map((d) => toProfile(d.id, d.data()))
        .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    },
    async update(identity, update) {
      const ref = users.doc(identity.uid);
      await db.runTransaction(async (t) => {
        const snap = await t.get(ref);
        const base = { name: update.name, emailVerified: identity.emailVerified, updatedAt: FieldValue.serverTimestamp() };
        if (snap.exists) t.update(ref, { ...base, phone: update.phone ?? FieldValue.delete() });
        else {
          // Same shape the browser would have created (see firestore.rules).
          t.set(ref, {
            uid: identity.uid,
            email: identity.email,
            authProvider: identity.signInProvider === "google.com" ? "google.com" : "password",
            createdAt: FieldValue.serverTimestamp(),
            ...base,
            ...(update.phone ? { phone: update.phone } : {}),
          });
        }
      });
      const saved = await ref.get();
      return toProfile(identity.uid, saved.data()!);
    },
    async syncEmail(uid, email) {
      const ref = users.doc(uid);
      const snap = await ref.get();
      if (snap.exists && snap.data()!.email !== email) {
        await ref.update({ email, updatedAt: FieldValue.serverTimestamp() });
      }
    },
  };
}
