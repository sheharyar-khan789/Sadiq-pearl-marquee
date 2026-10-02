#!/usr/bin/env node
// Security-rules tests for firestore.rules and storage.rules, run against the
// Firebase Emulator Suite (never a real project). Requires firebase-tools and Java 21+:
//
//   npm run test:rules
//   (= firebase emulators:exec --only auth,firestore,storage --project demo-sadiq-pearl "node scripts/test-security-rules.mjs")
//
// Uses throwaway emulator accounts that exist only inside the emulator run.
// Optional: `--only=firestore` or `--only=storage` runs one group (e.g. where only
// some emulators can start); the default runs both.
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage, ref, uploadBytes, getBytes } from "firebase/storage";

const projectId = "demo-sadiq-pearl";
if (!projectId.startsWith("demo-")) throw new Error("Refusing to run rules tests against a non-demo project.");
const host = process.env.FIREBASE_EMULATOR_HOST_IP || "127.0.0.1";
const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
const runFirestore = !only || only === "firestore";
const runStorage = !only || only === "storage";
const config = { apiKey: "demo-key", authDomain: `${projectId}.firebaseapp.com`, projectId, storageBucket: `${projectId}.appspot.com`, appId: "demo-app" };

let n = 0;
function client(signedIn) {
  const app = initializeApp(config, `rules-test-${n++}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, host, 8080);
  const storage = getStorage(app);
  connectStorageEmulator(storage, host, 9199);
  return { app, auth, db, storage, signedIn };
}

async function newUser(label) {
  const c = client(true);
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const { user } = await createUserWithEmailAndPassword(c.auth, email, "emulator-only-password");
  return { ...c, user, email };
}

const results = [];
async function expect(name, shouldSucceed, action) {
  let ok;
  let detail = "";
  try {
    await action();
    ok = shouldSucceed;
    if (!ok) detail = "was ALLOWED but should be denied";
  } catch (error) {
    const denied = error?.code === "permission-denied" || error?.code === "storage/unauthorized";
    ok = !shouldSucceed && denied;
    if (!ok) detail = `${shouldSucceed ? "was DENIED but should be allowed" : "failed for another reason"}: ${error?.code ?? error}`;
  }
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const profileFor = (u, extra = {}) => ({
  uid: u.user.uid,
  email: u.email,
  name: "Test Customer",
  authProvider: "password",
  emailVerified: false,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

const alice = await newUser("alice");
const bob = await newUser("bob");
const anon = client(false);
const aliceDoc = (c) => doc(c.db, "users", alice.user.uid);

// ---------- Firestore: users/{uid} ----------
if (runFirestore) {
await expect("Signed-out visitor cannot read a profile", false, () => getDoc(aliceDoc(anon)));
await expect("Signed-out visitor cannot create a profile", false, () => setDoc(aliceDoc(anon), profileFor(alice)));
await expect("User cannot create a profile with a role field", false, () =>
  setDoc(aliceDoc(alice), profileFor(alice, { role: "super_admin" }))
);
await expect("User cannot create a profile claiming a verified email", false, () =>
  setDoc(aliceDoc(alice), profileFor(alice, { emailVerified: true }))
);
await expect("User cannot create a profile with another email", false, () =>
  setDoc(aliceDoc(alice), profileFor(alice, { email: "someone-else@example.test" }))
);
await expect("User cannot create another user's profile", false, () =>
  setDoc(doc(bob.db, "users", alice.user.uid), profileFor(alice))
);
await expect("User can create their own profile", true, () => setDoc(aliceDoc(alice), profileFor(alice)));
await expect("User can read their own profile", true, () => getDoc(aliceDoc(alice)));
await expect("Another user cannot read that profile", false, () => getDoc(aliceDoc(bob)));
await expect("Signed-out visitor cannot read that profile", false, () => getDoc(aliceDoc(anon)));
await expect("User can update their own name", true, () =>
  updateDoc(aliceDoc(alice), { name: "Updated Name", updatedAt: serverTimestamp() })
);
await expect("User cannot store a non-https photo URL", false, () =>
  updateDoc(aliceDoc(alice), { photoURL: "javascript:alert(1)", updatedAt: serverTimestamp() })
);
await expect("User cannot add a role to their profile", false, () =>
  updateDoc(aliceDoc(alice), { role: "super_admin", updatedAt: serverTimestamp() })
);
await expect("User cannot change their stored email", false, () =>
  updateDoc(aliceDoc(alice), { email: "new@example.test", updatedAt: serverTimestamp() })
);
await expect("User cannot mark their email verified", false, () =>
  updateDoc(aliceDoc(alice), { emailVerified: true, updatedAt: serverTimestamp() })
);
await expect("Another user cannot update that profile", false, () =>
  updateDoc(aliceDoc(bob), { name: "Hacked", updatedAt: serverTimestamp() })
);
await expect("User cannot delete their profile from the browser", false, () => deleteDoc(aliceDoc(alice)));
await expect("User cannot list all profiles", false, () => getDocs(collection(alice.db, "users")));
await expect("Collections without rules are closed (write)", false, () =>
  setDoc(doc(alice.db, "bookings", "test"), { anything: true })
);
await expect("Collections without rules are closed (read)", false, () => getDoc(doc(alice.db, "settings", "business")));

// ---------- Firestore: bookings & slotLocks (server-only) ----------
// Seed one booking owned by alice, bypassing rules with the emulator's
// "owner" token (emulator only), then check the browser can do nothing with it.
const seedUrl = (path) => `http://${host}:8080/v1/projects/${projectId}/databases/(default)/documents/${path}`;
const seed = await fetch(seedUrl("bookings/rules-test-booking"), {
  method: "PATCH",
  headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
  body: JSON.stringify({
    fields: { customerId: { stringValue: alice.user.uid }, status: { stringValue: "pending" }, eventDate: { stringValue: "2030-01-01" } },
  }),
});
if (!seed.ok) throw new Error(`Could not seed the emulator (${seed.status})`);
const booking = (c) => doc(c.db, "bookings", "rules-test-booking");
await expect("Owner cannot read their booking directly (server API only)", false, () => getDoc(booking(alice)));
await expect("Owner cannot mark their booking confirmed", false, () => updateDoc(booking(alice), { status: "confirmed" }));
await expect("Owner cannot change amounts received", false, () =>
  updateDoc(booking(alice), { "payment.advanceReceived": 500000 })
);
await expect("Owner cannot write admin notes", false, () => updateDoc(booking(alice), { adminNotes: "approved" }));
await expect("Owner cannot transfer ownership", false, () => updateDoc(booking(alice), { customerId: bob.user.uid }));
await expect("Another customer cannot change the booking", false, () => updateDoc(booking(bob), { status: "cancelled" }));
await expect("Another customer cannot read the booking", false, () => getDoc(booking(bob)));
await expect("Customer cannot delete a booking", false, () => deleteDoc(booking(alice)));
await expect("Customer cannot create a booking directly (bypassing availability)", false, () =>
  setDoc(doc(alice.db, "bookings", "direct"), { customerId: alice.user.uid, status: "confirmed", eventDate: "2030-01-02" })
);
await expect("Customer cannot list bookings", false, () => getDocs(collection(alice.db, "bookings")));
await expect("Customer cannot create a slot lock", false, () =>
  setDoc(doc(alice.db, "slotLocks", "2030-01-02__main-hall__day"), { bookingId: "direct", status: "confirmed" })
);
await expect("Customer cannot read slot locks", false, () => getDoc(doc(alice.db, "slotLocks", "2030-01-02__main-hall__day")));
await expect("Signed-out visitor cannot read bookings", false, () => getDoc(booking(anon)));

// ---------- Firestore: bookingRequests & profile phone (Phase 4, server-only) ----------
await expect("Customer cannot create a change request directly", false, () =>
  setDoc(doc(alice.db, "bookingRequests", "direct"), { bookingId: "rules-test-booking", customerId: alice.user.uid, type: "cancellation", status: "open" })
);
await expect("Customer cannot file a request as someone else", false, () =>
  setDoc(doc(bob.db, "bookingRequests", "spoof"), { bookingId: "rules-test-booking", customerId: alice.user.uid, type: "cancellation", status: "open" })
);
await expect("Customer cannot read change requests", false, () => getDocs(collection(alice.db, "bookingRequests")));
await expect("Customer cannot approve a request", false, () => updateDoc(doc(alice.db, "bookingRequests", "direct"), { status: "accepted" }));
await expect("User cannot write phone directly (server profile API only)", false, () =>
  updateDoc(aliceDoc(alice), { phone: "03001234567", updatedAt: serverTimestamp() })
);
await expect("User cannot give themselves a role via the profile", false, () =>
  updateDoc(aliceDoc(alice), { role: "super_admin", admin: true, updatedAt: serverTimestamp() })
);

// ---------- Firestore: adminAudit (Phase 5, server-only) ----------
await expect("Customer cannot read the admin audit trail", false, () => getDocs(collection(alice.db, "adminAudit")));
await expect("Customer cannot write an audit record", false, () =>
  setDoc(doc(alice.db, "adminAudit", "fake"), { action: "booking_confirmed", bookingId: "rules-test-booking" })
);
await expect("Customer cannot confirm a booking by writing it directly (admin actions are server-only)", false, () =>
  updateDoc(booking(alice), { status: "confirmed", adminNotes: "self-approved" })
);

// ---------- Firestore: businessConfig (Phase 6, server-only) ----------
await expect("Customer cannot read the business configuration directly", false, () => getDoc(doc(alice.db, "businessConfig", "main")));
await expect("Customer cannot change prices", false, () =>
  setDoc(doc(alice.db, "businessConfig", "main"), { pricing: { perGuestRate: 1 } })
);
await expect("Signed-out visitor cannot read the business configuration", false, () => getDoc(doc(anon.db, "businessConfig", "main")));

// ---------- Firestore: payments / quotations / counters (Phase 7, server-only) ----------
await expect("Customer cannot record a payment directly", false, () =>
  setDoc(doc(alice.db, "payments", "pay_fake"), { bookingId: "rules-test-booking", customerId: alice.user.uid, amount: 1, status: "recorded" })
);
await expect("Customer cannot read payments directly", false, () => getDoc(doc(alice.db, "payments", "pay_fake")));
await expect("Customer cannot list payments", false, () => getDocs(collection(alice.db, "payments")));
await expect("Customer cannot void or edit a payment", false, () => updateDoc(doc(alice.db, "payments", "pay_fake"), { status: "voided" }));
await expect("Customer cannot delete a payment", false, () => deleteDoc(doc(alice.db, "payments", "pay_fake")));
await expect("Customer cannot create a quotation", false, () =>
  setDoc(doc(alice.db, "quotations", "qt_fake"), { bookingId: "rules-test-booking", status: "issued", snapshot: { pricing: { total: 1 } } })
);
await expect("Customer cannot read or list quotations directly", false, () => getDocs(collection(alice.db, "quotations")));
await expect("Customer cannot change a document-number counter", false, () => setDoc(doc(alice.db, "counters", "receipt-2026"), { value: 0 }));
await expect("Signed-out visitor cannot read payments", false, () => getDocs(collection(anon.db, "payments")));
await expect("Customer cannot mark their booking paid directly", false, () =>
  updateDoc(booking(alice), { "payment.advanceReceived": 999999, "payment.balanceDue": 0 })
);

// ---------- Firestore: event operations / vendors (Phase 8, server-only) ----------
await expect("Customer cannot read event operations (internal notes, checklist)", false, () =>
  getDoc(doc(alice.db, "eventOperations", "rules-test-booking"))
);
await expect("Customer cannot list event operations", false, () => getDocs(collection(alice.db, "eventOperations")));
await expect("Customer cannot create or change event operations", false, () =>
  setDoc(doc(alice.db, "eventOperations", "rules-test-booking"), { status: "completed", checklist: [] })
);
await expect("Customer cannot read vendors (contact details)", false, () => getDocs(collection(alice.db, "vendors")));
await expect("Customer cannot add a vendor", false, () =>
  setDoc(doc(alice.db, "vendors", "vd_fake"), { name: "Fake", category: "other", phone: "0300 0000000", active: true })
);
await expect("Customer cannot read vendor assignments", false, () => getDocs(collection(alice.db, "vendorAssignments")));
await expect("Customer cannot assign a vendor", false, () =>
  setDoc(doc(alice.db, "vendorAssignments", "va_fake"), { bookingId: "rules-test-booking", vendorId: "vd_fake", status: "assigned" })
);
await expect("Signed-out visitor cannot read vendors", false, () => getDocs(collection(anon.db, "vendors")));
await expect("Signed-out visitor cannot read event operations", false, () => getDocs(collection(anon.db, "eventOperations")));

// ---------- Firestore: notifications / communications (Phase 9) ----------
// Seeded with the emulator's "owner" token (rules bypass, emulator only), as server code would write them.
for (const [path, fields] of [
  ["notifications/nt_alice", { notificationId: { stringValue: "nt_alice" }, customerId: { stringValue: alice.user.uid }, type: { stringValue: "BOOKING_CONFIRMED" }, readAt: { nullValue: null } }],
  ["notifications/nt_bob", { notificationId: { stringValue: "nt_bob" }, customerId: { stringValue: bob.user.uid }, type: { stringValue: "BOOKING_CONFIRMED" }, readAt: { nullValue: null } }],
  ["communications/cm_1", { communicationId: { stringValue: "cm_1" }, bookingId: { stringValue: "rules-test-booking" }, status: { stringValue: "initiated" } }],
]) {
  const r = await fetch(seedUrl(path), { method: "PATCH", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`Could not seed ${path} (${r.status})`);
}
await expect("Customer can read their own notification", true, () => getDoc(doc(alice.db, "notifications", "nt_alice")));
await expect("Customer can list their own notifications", true, () =>
  getDocs(query(collection(alice.db, "notifications"), where("customerId", "==", alice.user.uid)))
);
await expect("Customer cannot read another customer's notification", false, () => getDoc(doc(alice.db, "notifications", "nt_bob")));
await expect("Customer cannot list all notifications", false, () => getDocs(collection(alice.db, "notifications")));
await expect("Customer cannot create a notification", false, () =>
  setDoc(doc(alice.db, "notifications", "nt_fake"), { customerId: alice.user.uid, type: "PAYMENT_RECEIVED", title: "Paid", message: "Rs 1" })
);
await expect("Customer cannot mark read directly or change ownership", false, () =>
  updateDoc(doc(alice.db, "notifications", "nt_alice"), { readAt: serverTimestamp(), customerId: bob.user.uid })
);
await expect("Customer cannot delete a notification", false, () => deleteDoc(doc(alice.db, "notifications", "nt_alice")));
await expect("Customer cannot read communication history", false, () => getDoc(doc(alice.db, "communications", "cm_1")));
await expect("Customer cannot write a communication record", false, () =>
  setDoc(doc(alice.db, "communications", "cm_fake"), { status: "delivered" })
);
await expect("Signed-out visitor cannot read notifications", false, () => getDoc(doc(anon.db, "notifications", "nt_alice")));

// ---------- Firestore: reviews (Phase 10, server-only) ----------
{
  const r = await fetch(seedUrl("reviews/rv_alice"), {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { customerId: { stringValue: alice.user.uid }, status: { stringValue: "pending" }, rating: { integerValue: "5" } } }),
  });
  if (!r.ok) throw new Error(`Could not seed reviews/rv_alice (${r.status})`);
}
await expect("Customer cannot approve their own review", false, () => updateDoc(doc(alice.db, "reviews", "rv_alice"), { status: "approved" }));
await expect("Customer cannot write a review directly (server API only)", false, () =>
  setDoc(doc(alice.db, "reviews", "rv_fake"), { customerId: alice.user.uid, rating: 5, text: "Fake five stars", status: "approved" })
);
await expect("Customer cannot edit another customer's review", false, () => updateDoc(doc(bob.db, "reviews", "rv_alice"), { rating: 1 }));
await expect("Customer cannot delete a review", false, () => deleteDoc(doc(alice.db, "reviews", "rv_alice")));
await expect("Reviews are not readable from the browser (approved ones are served by the server)", false, () => getDocs(collection(anon.db, "reviews")));
}

// ---------- Storage ----------
if (runStorage) {
const bytes = new Uint8Array([137, 80, 78, 71]);
await expect("Signed-out visitor cannot upload", false, () =>
  uploadBytes(ref(anon.storage, "uploads/test.png"), bytes, { contentType: "image/png" })
);
await expect("Signed-in user cannot upload (no upload feature yet)", false, () =>
  uploadBytes(ref(alice.storage, `users/${alice.user.uid}/avatar.png`), bytes, { contentType: "image/png" })
);
await expect("Signed-out visitor cannot read files", false, () => getBytes(ref(anon.storage, "anything.png")));
}

for (const c of [alice, bob, anon]) await deleteApp(c.app);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} rules tests passed.`);
process.exit(failed ? 1 : 0);
