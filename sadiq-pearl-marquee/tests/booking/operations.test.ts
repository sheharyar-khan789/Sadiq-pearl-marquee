// Event operations (Phase 8): operational record, status, checklist, notes,
// vendors, assignments, conflicts, booking changes, cancellation, financial
// read-only, list filtering and audit. IN-MEMORY transactional store (the
// same scenario runs on the Firestore emulator in tests/firestore/).
// Run: npm run test:booking
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { adminSetStatus } from "../../src/lib/booking/admin.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { generateQuotation, issueQuotation, recordPayment } from "../../src/lib/booking/finance.ts";
import {
  addChecklistItem,
  addOpsNote,
  assignVendor,
  createVendor,
  editOpsNote,
  setAssignmentStatus,
  setOpsStatus,
  syncChecklistWithBooking,
  updateChecklistItem,
  updateVendor,
  validateVendorInput,
} from "../../src/lib/booking/operations.ts";
import { bookingChecklist, opsTransitionError, syncChecklist } from "../../src/lib/booking/operations-model.ts";
import { applyEventsQuery, parseEventsQuery } from "../../src/lib/booking/operations-view.ts";
import { toCustomerView } from "../../src/lib/booking/portal.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { input, NOW } from "./engine-scenarios.ts";
import { ADMIN, confirmedBooking, LABELS, operationsScenario, testVendor, twoHallConfig } from "./operations-scenario.ts";
import { testService } from "./test-config.ts";

const TODAY = "2026-10-01";
const opts = { now: NOW, labels: LABELS };

describe("event operations: full scenario (in-memory)", () => {
  it("status, checklist, notes, vendor clash, booking move, cancellation, unassign — financial data untouched", async () => {
    await operationsScenario(new MemoryBookingStore());
  });
});

describe("operational record and status", () => {
  it("is created safely on the first change, once, even when two admins act at the same moment", async () => {
    const s = new MemoryBookingStore();
    const id = await confirmedBooking(s, twoHallConfig(), "c1", {});
    const [x, y] = await Promise.all([
      addOpsNote(s, ADMIN, id, "first", opts),
      addOpsNote(s, { uid: "admin-2", email: "a2@example.test" }, id, "second", opts),
    ]);
    assert.ok(x.ok && y.ok);
    const ops = (await s.getOperations(id))!;
    assert.deepEqual(ops.notes.map((n) => n.text).sort(), ["first", "second"], "both notes kept, one record");
  });

  it("only confirmed / completed bookings have operations (pending, cancelled, rejected do not)", async () => {
    const s = new MemoryBookingStore();
    const r = await createCustomerBookingRequest(s, { uid: "c1", email: null }, input(), { now: NOW, config: twoHallConfig() });
    assert.ok(r.ok);
    assert.deepEqual(await setOpsStatus(s, ADMIN, r.booking.bookingId, "preparing", opts), { ok: false, code: "not_operational" });
    assert.ok((await adminSetStatus(s, ADMIN, r.booking.bookingId, "rejected", { now: NOW })).ok);
    assert.deepEqual(await addOpsNote(s, ADMIN, r.booking.bookingId, "x", opts), { ok: false, code: "not_operational" });
    assert.equal(await s.getOperations(r.booking.bookingId), null);
    assert.deepEqual(await setOpsStatus(s, ADMIN, "bk_000000000000000000000000", "preparing", opts), { ok: false, code: "not_found" });
  });

  it("transition rules", () => {
    assert.equal(opsTransitionError("not_started", "preparing", "2026-10-20", TODAY), null);
    assert.equal(opsTransitionError("preparing", "not_started", "2026-10-20", TODAY), null, "one step back is allowed");
    assert.equal(opsTransitionError("not_started", "ready", "2026-10-20", TODAY), "invalid_ops_transition");
    assert.equal(opsTransitionError("ready", "in_progress", "2026-10-20", TODAY), "event_not_started");
    assert.equal(opsTransitionError("ready", "in_progress", "2026-10-01", TODAY), null);
    assert.equal(opsTransitionError("in_progress", "completed", "2026-09-30", TODAY), null);
    assert.equal(opsTransitionError("ready", "ready", "2026-10-01", TODAY), "invalid_ops_transition");
  });

  it("completing operations stores a history snapshot (event + financial summary) and keeps everything", async () => {
    const s = new MemoryBookingStore();
    const id = await confirmedBooking(s, twoHallConfig(), "c1", { date: "2026-10-01" });
    for (const to of ["preparing", "ready", "in_progress", "completed"]) assert.ok((await setOpsStatus(s, ADMIN, id, to, opts)).ok, to);
    const ops = (await s.getOperations(id))!;
    assert.equal(ops.status, "completed");
    assert.equal(ops.completedSnapshot?.eventDate, "2026-10-01");
    assert.equal(ops.completedSnapshot?.total, 500_000);
    assert.equal(ops.completedSnapshot?.paid, 0);
    // Marking the BOOKING completed (booking engine) leaves operations intact.
    assert.ok((await adminSetStatus(s, ADMIN, id, "completed", { now: NOW })).ok);
    assert.deepEqual(await s.getOperations(id), ops);
  });

  it("rejects unknown statuses", async () => {
    const s = new MemoryBookingStore();
    const id = await confirmedBooking(s, twoHallConfig(), "c1", {});
    assert.deepEqual(await setOpsStatus(s, ADMIN, id, "done", opts), { ok: false, code: "invalid_ops_status" });
  });
});

describe("checklist", () => {
  const booking = (over: object = {}) =>
    ({
      bookingId: "bk_x",
      hallName: "Main Hall",
      guestCount: 300,
      services: [{ id: "svc-light", label: "Lighting" }],
      package: { id: "pkg-1", name: "Gold", serviceIds: ["svc-photo"] },
      menuPreference: { id: "m1", title: "Menu 1" },
      ...over,
    }) as never;

  it("is generated only from what the booking actually includes", () => {
    const ids = bookingChecklist(booking(), { service: (id) => (id === "svc-photo" ? "Photography" : id) }).map((i) => i.id);
    assert.deepEqual(ids, ["venue:hall", "venue:seating", "service:svc-light", "package:pkg-1", "service:svc-photo", "menu:m1"]);
    const plain = bookingChecklist(booking({ services: [], package: null, menuPreference: null }), LABELS).map((i) => i.id);
    assert.deepEqual(plain, ["venue:hall", "venue:seating"], "no pretend services");
  });

  it("sync adds new selections and marks removed ones (never deletes)", () => {
    const current = bookingChecklist(booking(), LABELS);
    const r = syncChecklist(current, booking({ services: [{ id: "svc-dj", label: "DJ" }], guestCount: 450 }), LABELS);
    assert.deepEqual([r.added, r.removed], [1, 1]);
    assert.ok(r.checklist.find((i) => i.id === "service:svc-light")!.removed);
    assert.ok(r.checklist.some((i) => i.id === "service:svc-dj" && !i.removed));
    assert.match(r.checklist.find((i) => i.id === "venue:seating")!.label, /450/);
  });

  it("item status, note, completed by/at, reopen; validation; custom items; audit", async () => {
    const s = new MemoryBookingStore();
    const config = twoHallConfig();
    config.services = [testService("svc-light", { name: "Lighting" })];
    const id = await confirmedBooking(s, config, "c1", { serviceIds: ["svc-light"] });
    assert.ok((await updateChecklistItem(s, ADMIN, id, "service:svc-light", { status: "in_progress" }, opts)).ok);
    assert.ok((await updateChecklistItem(s, ADMIN, id, "service:svc-light", { status: "completed", note: "Tested" }, opts)).ok);
    let item = (await s.getOperations(id))!.checklist.find((i) => i.id === "service:svc-light")!;
    assert.deepEqual([item.status, item.note, item.completedBy], ["completed", "Tested", "admin@example.test"]);
    assert.ok(item.completedAt);
    assert.ok((await updateChecklistItem(s, ADMIN, id, "service:svc-light", { status: "pending" }, opts)).ok);
    item = (await s.getOperations(id))!.checklist.find((i) => i.id === "service:svc-light")!;
    assert.deepEqual([item.status, item.completedAt, item.completedBy], ["pending", null, null], "reopened");
    assert.deepEqual(await updateChecklistItem(s, ADMIN, id, "service:svc-light", { status: "done" }, opts), { ok: false, code: "invalid_checklist_status" });
    assert.deepEqual(await updateChecklistItem(s, ADMIN, id, "nope", { status: "completed" }, opts), { ok: false, code: "item_not_found" });
    assert.deepEqual(await updateChecklistItem(s, ADMIN, id, "venue:hall", { note: "x".repeat(501) }, opts), { ok: false, code: "invalid_note" });
    assert.ok((await addChecklistItem(s, ADMIN, id, "Generator fuel check", opts)).ok);
    assert.deepEqual(await addChecklistItem(s, ADMIN, id, "x", opts), { ok: false, code: "invalid_label" });
    assert.deepEqual(await syncChecklistWithBooking(s, ADMIN, id, opts), { ok: false, code: "nothing_to_sync" });
    const actions = (await s.listAuditForBooking(id, 50)).map((a) => [a.action, a.reason]);
    assert.ok(actions.some(([a, r]) => a === "checklist_item_updated" && r === "completed"));
    assert.ok(actions.some(([a, r]) => a === "checklist_item_updated" && r === "reopened"));
    assert.ok(actions.some(([a]) => a === "checklist_item_added"));
  });
});

describe("internal notes", () => {
  it("add / edit with validation; audit keeps only the size, not the text", async () => {
    const s = new MemoryBookingStore();
    const id = await confirmedBooking(s, twoHallConfig(), "c1", {});
    assert.ok((await addOpsNote(s, ADMIN, id, "Bride's family arrives early", opts)).ok);
    const note = (await s.getOperations(id))!.notes[0];
    assert.ok((await editOpsNote(s, ADMIN, id, note.id, "Family arrives at 6 pm", opts)).ok);
    assert.equal((await s.getOperations(id))!.notes[0].text, "Family arrives at 6 pm");
    assert.deepEqual(await addOpsNote(s, ADMIN, id, "  ", opts), { ok: false, code: "invalid_note" });
    assert.deepEqual(await editOpsNote(s, ADMIN, id, "n_missing", "x", opts), { ok: false, code: "note_not_found" });
    const audit = await s.listAuditForBooking(id, 10);
    assert.ok(audit.some((a) => a.action === "ops_note_added") && audit.some((a) => a.action === "ops_note_updated"));
    assert.ok(!JSON.stringify(audit).includes("6 pm"), "note text not copied into the audit trail");
  });
});

describe("vendors", () => {
  it("validation refuses bad input and unknown fields", () => {
    const base = { name: "Studio X", category: "photographer", phone: "0300 1234567", whatsapp: "", email: "", notes: "" };
    assert.ok(validateVendorInput(base).ok);
    for (const [over, field] of [
      [{ name: "x" }, "name"],
      [{ category: "magician" }, "category"],
      [{ phone: "call me" }, "phone"],
      [{ whatsapp: "abc" }, "whatsapp"],
      [{ email: "not-an-email" }, "email"],
      [{ notes: "x".repeat(1001) }, "notes"],
      [{ active: false }, "body"],
      [{ vendorId: "vd_x" }, "body"],
    ] as const) {
      const r = validateVendorInput({ ...base, ...over });
      assert.equal(r.ok, false, JSON.stringify(over));
      assert.ok(!r.ok && field in r.errors, `${field}: ${JSON.stringify(!r.ok && r.errors)}`);
    }
  });

  it("create (idempotent), edit, deactivate, reactivate — audited, never deleted", async () => {
    const s = new MemoryBookingStore();
    const v = validateVendorInput({ name: "Studio X", category: "photographer", phone: "0300 1234567" });
    assert.ok(v.ok);
    const key = randomUUID();
    const first = await createVendor(s, ADMIN, v.value, key, { now: NOW });
    const again = await createVendor(s, ADMIN, v.value, key, { now: NOW });
    assert.ok(first.ok && again.ok && again.replayed);
    assert.equal(s.vendorCount(), 1);
    assert.deepEqual(await createVendor(s, ADMIN, v.value, "short", { now: NOW }), { ok: false, code: "invalid_request_key" });
    const id = first.vendor.vendorId;
    assert.ok((await updateVendor(s, ADMIN, id, { details: { ...v.value, phone: "0311 7654321" } }, { now: NOW })).ok);
    assert.deepEqual(await updateVendor(s, ADMIN, id, { details: { ...v.value, phone: "0311 7654321" } }, { now: NOW }), { ok: false, code: "no_change" });
    assert.deepEqual(await updateVendor(s, ADMIN, id, { active: false, expectedUpdatedAt: "2000-01-01T00:00:00.000Z" }, { now: NOW }), { ok: false, code: "stale" });
    assert.ok((await updateVendor(s, ADMIN, id, { active: false }, { now: NOW })).ok);
    assert.equal((await s.getVendor(id))!.active, false);
    assert.equal((await s.listVendors({ activeOnly: true, limit: 10 })).length, 0);
    assert.equal((await s.listVendors({ activeOnly: false, limit: 10 })).length, 1, "kept");
    assert.ok((await updateVendor(s, ADMIN, id, { active: true }, { now: NOW })).ok);
    const history = (await s.listAuditForEntity("vendor", id, 10)).map((a) => a.action).sort();
    assert.deepEqual(history, ["vendor_activated", "vendor_created", "vendor_deactivated", "vendor_updated"]);
  });
});

describe("vendor assignments", () => {
  it("assign, duplicate refused, inactive vendor refused, confirm, unassign (kept), audit", async () => {
    const s = new MemoryBookingStore();
    const config = twoHallConfig();
    const id = await confirmedBooking(s, config, "c1", {});
    const vendor = await testVendor(s, "Studio X");
    const a = await assignVendor(s, ADMIN, id, { vendorId: vendor, category: "photographer", notes: "Two cameras" }, { now: NOW });
    assert.ok(a.ok);
    assert.deepEqual(await assignVendor(s, ADMIN, id, { vendorId: vendor, category: "photographer" }, { now: NOW }), { ok: false, code: "already_assigned" });
    assert.deepEqual(await assignVendor(s, ADMIN, id, { vendorId: vendor, category: "magic" }, { now: NOW }), { ok: false, code: "invalid_category" });
    assert.deepEqual(await assignVendor(s, ADMIN, id, { vendorId: "vd_00000000000000000000", category: "other" }, { now: NOW }), { ok: false, code: "vendor_not_found" });
    const other = await testVendor(s, "Studio Y");
    assert.ok((await updateVendor(s, ADMIN, other, { active: false }, { now: NOW })).ok);
    assert.deepEqual(await assignVendor(s, ADMIN, id, { vendorId: other, category: "photographer" }, { now: NOW }), { ok: false, code: "vendor_inactive" });
    assert.ok((await setAssignmentStatus(s, ADMIN, a.assignment.assignmentId, "confirmed", { now: NOW })).ok);
    assert.deepEqual(await setAssignmentStatus(s, ADMIN, a.assignment.assignmentId, "confirmed", { now: NOW }), { ok: false, code: "invalid_transition" });
    assert.ok((await setAssignmentStatus(s, ADMIN, a.assignment.assignmentId, "cancelled", { now: NOW })).ok);
    assert.deepEqual(await setAssignmentStatus(s, ADMIN, a.assignment.assignmentId, "cancelled", { now: NOW }), { ok: false, code: "invalid_transition" });
    const list = await s.listAssignmentsForBooking(id);
    assert.deepEqual(list.map((x) => x.status), ["cancelled"], "history kept");
    // Re-assigning after an unassign is allowed.
    assert.ok((await assignVendor(s, ADMIN, id, { vendorId: vendor, category: "photographer" }, { now: NOW })).ok);
    const actions = (await s.listAuditForBooking(id, 50)).map((x) => x.action);
    for (const want of ["vendor_assigned", "vendor_assignment_confirmed", "vendor_unassigned"]) assert.ok(actions.includes(want as never), want);
  });

  it("two admins assigning one vendor to clashing events at the same time: exactly one succeeds", async () => {
    const s = new MemoryBookingStore();
    const config = twoHallConfig();
    const a = await confirmedBooking(s, config, "c1", { date: "2026-10-20" });
    const b = await confirmedBooking(s, config, "c2", { date: "2026-10-20", hallId: "test-hall-2" });
    const vendor = await testVendor(s, "Studio X");
    const results = await Promise.all([
      assignVendor(s, ADMIN, a, { vendorId: vendor, category: "photographer" }, { now: NOW }),
      assignVendor(s, { uid: "admin-2", email: "a2@example.test" }, b, { vendorId: vendor, category: "photographer" }, { now: NOW }),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1, JSON.stringify(results));
    assert.equal(results.find((r) => !r.ok)?.ok === false && (results.find((r) => !r.ok) as { code: string }).code, "vendor_conflict");
  });

  it("assignments only for confirmed events (not pending, cancelled or completed)", async () => {
    const s = new MemoryBookingStore();
    const vendor = await testVendor(s, "Studio X");
    const r = await createCustomerBookingRequest(s, { uid: "c1", email: null }, input(), { now: NOW, config: twoHallConfig() });
    assert.ok(r.ok);
    assert.deepEqual(await assignVendor(s, ADMIN, r.booking.bookingId, { vendorId: vendor, category: "photographer" }, { now: NOW }), { ok: false, code: "not_operational" });
  });
});

describe("financial data is read-only for operations", () => {
  it("no operational change alters the booking price, payments, quotations or receipts", async () => {
    const s = new MemoryBookingStore();
    const id = await confirmedBooking(s, twoHallConfig(), "c1", { date: "2026-10-01" });
    const business = { name: "Test", address: "Test", phones: [] };
    assert.ok((await recordPayment(s, ADMIN, id, { amount: 100_000, method: "cash", paidOn: TODAY, reference: "", notes: "", requestKey: randomUUID() }, { now: NOW, business })).ok);
    const q = await generateQuotation(s, ADMIN, id, { now: NOW, business });
    assert.ok(q.ok);
    assert.ok((await issueQuotation(s, ADMIN, q.quotation.quotationId, { now: NOW })).ok);
    const snapshot = async () => ({
      booking: await s.getBooking(id),
      payments: await s.listPaymentsForBooking(id),
      quotations: await s.listQuotationsForBooking(id),
      lock: s.lockFor((await s.getBooking(id))!.slotKey),
    });
    const before = structuredClone(await snapshot());
    const vendor = await testVendor(s, "Studio X");
    for (const to of ["preparing", "ready", "in_progress", "completed"]) assert.ok((await setOpsStatus(s, ADMIN, id, to, opts)).ok);
    assert.ok((await updateChecklistItem(s, ADMIN, id, "venue:hall", { status: "completed" }, opts)).ok);
    assert.ok((await addChecklistItem(s, ADMIN, id, "Extra chairs", opts)).ok);
    assert.ok((await addOpsNote(s, ADMIN, id, "note", opts)).ok);
    assert.ok((await assignVendor(s, ADMIN, id, { vendorId: vendor, category: "photographer" }, { now: NOW })).ok);
    assert.deepEqual(await snapshot(), before);
  });
});

describe("customer isolation", () => {
  it("the customer booking view carries no operational data", async () => {
    const s = new MemoryBookingStore();
    const id = await confirmedBooking(s, twoHallConfig(), "c1", {});
    assert.ok((await addOpsNote(s, ADMIN, id, "INTERNAL-OPS-NOTE", opts)).ok);
    const view = JSON.stringify(toCustomerView((await s.getBooking(id))!, NOW));
    for (const leak of ["INTERNAL-OPS-NOTE", "checklist", "opsStatus", "vendor"]) assert.ok(!view.includes(leak), leak);
  });
});

describe("upcoming events list", () => {
  it("presets, filters and search; cancelled / rejected / pending never listed", async () => {
    const s = new MemoryBookingStore();
    const config = twoHallConfig();
    const a = await confirmedBooking(s, config, "c1", { date: "2026-10-01", contactName: "Ayesha Khan", contactPhone: "0300 7654321" });
    const b = await confirmedBooking(s, config, "c2", { date: "2026-10-05", slotId: "night" });
    const c = await confirmedBooking(s, config, "c3", { date: "2026-10-06" });
    assert.ok((await adminSetStatus(s, ADMIN, c, "cancelled", { now: NOW })).ok);
    const pending = await createCustomerBookingRequest(s, { uid: "c4", email: null }, input({ date: "2026-10-07" }), { now: NOW, config });
    assert.ok(pending.ok);
    assert.ok((await setOpsStatus(s, ADMIN, b, "preparing", opts)).ok);
    const bookings = await s.listBookingsInRange({ from: "2026-10-01", to: "2026-12-31", limit: 500 });
    const ops = new Map((await s.getOperationsMany(bookings.map((x) => x.bookingId))).map((o) => [o.bookingId, o]));
    const run = (params: Record<string, string>) => applyEventsQuery(bookings, ops, parseEventsQuery(params, TODAY)).map((r) => r.bookingId);
    assert.deepEqual(run({}), [a, b], "30 days: confirmed only");
    assert.deepEqual(run({ range: "today" }), [a]);
    assert.deepEqual(run({ range: "tomorrow" }), []);
    assert.deepEqual(run({ range: "7d", slot: "night" }), [b]);
    assert.deepEqual(run({ ops: "preparing" }), [b]);
    assert.deepEqual(run({ ops: "not_started" }), [a]);
    assert.deepEqual(run({ q: "ayesha" }), [a]);
    assert.deepEqual(run({ q: "7654321" }), [a], "phone search");
    assert.deepEqual(run({ q: `SP-${b.slice(-8).toUpperCase()}` }), [b], "reference search");
    assert.deepEqual(run({ q: "2026-10-05" }), [b], "date search");
    assert.deepEqual(run({ range: "custom", from: "2026-10-05", to: "2026-10-10" }), [b]);
    const capped = parseEventsQuery({ range: "custom", from: "2026-10-01", to: "2027-12-31" }, TODAY);
    assert.equal(capped.to, "2027-01-01", "custom range capped at 92 days");
  });
});
