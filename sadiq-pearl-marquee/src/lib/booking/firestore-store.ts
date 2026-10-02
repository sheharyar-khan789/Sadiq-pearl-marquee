// Firestore implementation of BookingStore — SERVER ONLY (Admin SDK).
// Uses Firestore transactions plus write preconditions:
//   create()                         -> fails if the document already exists
//   update/delete({ lastUpdateTime }) -> fails if it changed since it was read
// so a slot lock can never be claimed twice, even outside the transaction's
// own conflict detection.
// Server-only: imported solely by ./server.ts (which carries the "server-only"
// guard) and by the emulator test; it needs Admin credentials to do anything.
import { Timestamp, type DocumentData, type Firestore, type Transaction } from "firebase-admin/firestore";
import { BOOKINGS_COLLECTION, SLOT_LOCKS_COLLECTION, type BookingRecord, type SlotLock } from "./model.ts";
import type { BusinessConfig } from "../config/business-config.ts";
import { ADMIN_AUDIT_COLLECTION, type AuditRecord } from "./audit-model.ts";

const CONFIG_DOC = ["businessConfig", "main"] as const;
import { BOOKING_REQUESTS_COLLECTION, type BookingRequestRecord } from "./request-model.ts";
import type { BookingStore, BookingTransaction, Versioned } from "./store.ts";
import {
  COUNTERS_COLLECTION,
  PAYMENTS_COLLECTION,
  QUOTATIONS_COLLECTION,
  type CounterDoc,
  type PaymentRecord,
  type QuotationRecord,
} from "./finance-model.ts";

import {
  ASSIGNMENTS_COLLECTION,
  OPERATIONS_COLLECTION,
  VENDORS_COLLECTION,
  type EventOperationsRecord,
  type VendorAssignmentRecord,
  type VendorRecord,
} from "./operations-model.ts";

import { COMMUNICATIONS_COLLECTION, NOTIFICATIONS_COLLECTION, type CommunicationRecord, type NotificationRecord } from "./notifications.ts";

import { REVIEWS_COLLECTION, type ReviewRecord } from "./reviews.ts";

const newestFirst = <T extends { createdAt: Date }>(list: T[]) => list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
const byCreatedAt = <T extends { createdAt: Date }>(list: T[]) =>
  list.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

/** Firestore returns Timestamps; the engine works with Dates. */
function revive<T>(value: unknown): T {
  if (value instanceof Timestamp) return value.toDate() as T;
  if (Array.isArray(value)) return value.map((v) => revive(v)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as DocumentData).map(([k, v]) => [k, revive(v)])) as T;
  }
  return value as T;
}

/** Upper bound when reading one customer's documents to filter/sort in memory. */
const CUSTOMER_SCAN_LIMIT = 1000;

const asTimestamp = (version: unknown): Timestamp => {
  if (!(version instanceof Timestamp)) throw new Error("Missing document version for a conditional write.");
  return version;
};

function transaction(db: Firestore, t: Transaction): BookingTransaction {
  const bookings = db.collection(BOOKINGS_COLLECTION);
  const locks = db.collection(SLOT_LOCKS_COLLECTION);
  const requests = db.collection(BOOKING_REQUESTS_COLLECTION);
  const payments = db.collection(PAYMENTS_COLLECTION);
  const quotations = db.collection(QUOTATIONS_COLLECTION);
  const counters = db.collection(COUNTERS_COLLECTION);
  const operations = db.collection(OPERATIONS_COLLECTION);
  const vendors = db.collection(VENDORS_COLLECTION);
  const assignments = db.collection(ASSIGNMENTS_COLLECTION);
  const notifications = db.collection(NOTIFICATIONS_COLLECTION);
  const communications = db.collection(COMMUNICATIONS_COLLECTION);

  async function read<T>(ref: FirebaseFirestore.DocumentReference): Promise<Versioned<T> | null> {
    const snap = await t.get(ref);
    return snap.exists ? { data: revive<T>(snap.data()), version: snap.updateTime } : null;
  }

  return {
    getBooking: (id) => read<BookingRecord>(bookings.doc(id)),
    getLock: (key) => read<SlotLock>(locks.doc(key)),
    async listCustomerBookings(customerId, statuses) {
      // Single-field query (no composite index needed); a customer's bookings
      // are few, so the status filter runs here.
      const wanted = new Set<string>(statuses);
      const snap = await t.get(bookings.where("customerId", "==", customerId).limit(CUSTOMER_SCAN_LIMIT));
      return snap.docs.map((d) => revive<BookingRecord>(d.data())).filter((b) => wanted.has(b.status)).slice(0, 50);
    },
    getRequest: (id) => read<BookingRequestRecord>(requests.doc(id)),
    async listOpenRequestsForBooking(bookingId) {
      const snap = await t.get(requests.where("bookingId", "==", bookingId).where("status", "==", "open").limit(20));
      return snap.docs.map((d) => revive<BookingRequestRecord>(d.data()));
    },
    createBooking: (record) => void t.create(bookings.doc(record.bookingId), record),
    updateBooking: (id, patch, version) =>
      void t.update(bookings.doc(id), patch as DocumentData, { lastUpdateTime: asTimestamp(version) }),
    createLock: (lock) => void t.create(locks.doc(lock.slotKey), lock),
    replaceLock: (lock, version) =>
      void t.update(locks.doc(lock.slotKey), { ...lock }, { lastUpdateTime: asTimestamp(version) }),
    deleteLock: (key, version) => void t.delete(locks.doc(key), { lastUpdateTime: asTimestamp(version) }),
    createRequest: (record) => void t.create(requests.doc(record.requestId), record),
    updateRequest: (id, patch) => void t.update(requests.doc(id), patch as DocumentData),
    createAudit: (record) => void t.create(db.collection(ADMIN_AUDIT_COLLECTION).doc(record.auditId), record),
    getConfig: () => read<BusinessConfig>(db.collection(CONFIG_DOC[0]).doc(CONFIG_DOC[1])),
    putConfig: (config, version) => {
      const ref = db.collection(CONFIG_DOC[0]).doc(CONFIG_DOC[1]);
      // create(): fails if someone else created it first. update() with the
      // read version: fails if another admin saved in between (no lost updates).
      // Every top-level field is written, so the document is fully replaced.
      if (version === null) void t.create(ref, config);
      else void t.update(ref, { ...config } as DocumentData, { lastUpdateTime: asTimestamp(version) });
    },

    // ----- Phase 7: payments / quotations / counters
    getPayment: (id) => read<PaymentRecord>(payments.doc(id)),
    async listPaymentsForBooking(bookingId) {
      // Single-field equality (automatic index). A query read inside the
      // transaction: a payment added concurrently makes this transaction retry.
      const snap = await t.get(payments.where("bookingId", "==", bookingId).limit(500));
      return byCreatedAt(snap.docs.map((d) => revive<PaymentRecord>(d.data())));
    },
    getQuotation: (id) => read<QuotationRecord>(quotations.doc(id)),
    async listQuotationsForBooking(bookingId) {
      const snap = await t.get(quotations.where("bookingId", "==", bookingId).limit(200));
      return byCreatedAt(snap.docs.map((d) => revive<QuotationRecord>(d.data())));
    },
    getCounter: (name) => read<CounterDoc>(counters.doc(name)),
    createPayment: (record) => void t.create(payments.doc(record.paymentId), record),
    updatePayment: (id, patch, version) =>
      void t.update(payments.doc(id), patch as DocumentData, { lastUpdateTime: asTimestamp(version) }),
    createQuotation: (record) => void t.create(quotations.doc(record.quotationId), record),
    updateQuotation: (id, patch, version) =>
      void t.update(quotations.doc(id), patch as DocumentData, { lastUpdateTime: asTimestamp(version) }),
    putCounter: (name, value, version) => {
      if (version === null) void t.create(counters.doc(name), { value });
      else void t.update(counters.doc(name), { value }, { lastUpdateTime: asTimestamp(version) });
    },

    // ----- Phase 8: event operations / vendors / assignments
    getOperations: (id) => read<EventOperationsRecord>(operations.doc(id)),
    putOperations: (record, version) => {
      if (version === null) void t.create(operations.doc(record.bookingId), record);
      else void t.update(operations.doc(record.bookingId), { ...record } as DocumentData, { lastUpdateTime: asTimestamp(version) });
    },
    getVendor: (id) => read<VendorRecord>(vendors.doc(id)),
    putVendor: (record, version) => {
      if (version === null) void t.create(vendors.doc(record.vendorId), record);
      else void t.update(vendors.doc(record.vendorId), { ...record } as DocumentData, { lastUpdateTime: asTimestamp(version) });
    },
    getAssignment: (id) => read<VendorAssignmentRecord>(assignments.doc(id)),
    async listAssignmentsForVendor(vendorId) {
      // Single-field equality (automatic index); status is filtered by the caller.
      const snap = await t.get(assignments.where("vendorId", "==", vendorId).limit(500));
      return snap.docs.map((d) => revive<VendorAssignmentRecord>(d.data()));
    },
    async listAssignmentsForBookingTx(bookingId) {
      const snap = await t.get(assignments.where("bookingId", "==", bookingId).limit(100));
      return snap.docs.map((d) => revive<VendorAssignmentRecord>(d.data()));
    },
    createAssignment: (record) => void t.create(assignments.doc(record.assignmentId), record),
    updateAssignment: (id, patch, version) =>
      void t.update(assignments.doc(id), patch as DocumentData, { lastUpdateTime: asTimestamp(version) }),

    // ----- Phase 9: notifications / communications
    createNotification: (record) => void t.create(notifications.doc(record.notificationId), record),
    getNotification: (id) => read<NotificationRecord>(notifications.doc(id)),
    async listUnreadNotifications(customerId, limit) {
      // Two equality filters (automatic indexes).
      const snap = await t.get(notifications.where("customerId", "==", customerId).where("readAt", "==", null).limit(limit));
      return snap.docs.map((d) => ({ data: revive<NotificationRecord>(d.data()), version: d.updateTime }));
    },
    updateNotification: (id, patch, version) =>
      void t.update(notifications.doc(id), patch as DocumentData, { lastUpdateTime: asTimestamp(version) }),
    getCommunication: (id) => read<CommunicationRecord>(communications.doc(id)),
    createCommunication: (record) => void t.create(communications.doc(record.communicationId), record),

    // ----- Phase 10: reviews
    getReview: (id) => read<ReviewRecord>(db.collection(REVIEWS_COLLECTION).doc(id)),
    putReview: (record, version) => {
      const ref = db.collection(REVIEWS_COLLECTION).doc(record.reviewId);
      if (version === null) void t.create(ref, record);
      else void t.update(ref, { ...record } as DocumentData, { lastUpdateTime: asTimestamp(version) });
    },
  };
}

export function firestoreBookingStore(db: Firestore): BookingStore {
  return {
    runTransaction: (work) => db.runTransaction((t) => work(transaction(db, t)), { maxAttempts: 5 }),
    async listLocks(hallId, from, to) {
      // Date range only (single-field index, created automatically by
      // Firestore); the hall filter runs here. A range is at most a few
      // months of dates x slots x halls, so this stays small.
      const snap = await db.collection(SLOT_LOCKS_COLLECTION).where("date", ">=", from).where("date", "<=", to).get();
      return snap.docs.map((d) => revive<SlotLock>(d.data())).filter((l) => l.hallId === hallId);
    },
    async getBooking(bookingId) {
      const snap = await db.collection(BOOKINGS_COLLECTION).doc(bookingId).get();
      return snap.exists ? revive<BookingRecord>(snap.data()) : null;
    },
    async listBookingsForCustomer(customerId, limit) {
      // Single-field equality query (automatic index); sorted on the server.
      const snap = await db.collection(BOOKINGS_COLLECTION).where("customerId", "==", customerId).limit(limit).get();
      return snap.docs.map((d) => revive<BookingRecord>(d.data()));
    },
    async listRequestsForCustomer(customerId, filter) {
      // Equality filters only: served by Firestore's automatic single-field indexes.
      let query = db.collection(BOOKING_REQUESTS_COLLECTION).where("customerId", "==", customerId);
      if (filter.bookingId) query = query.where("bookingId", "==", filter.bookingId);
      if (filter.openOnly) query = query.where("status", "==", "open");
      const snap = await query.limit(100).get();
      return snap.docs.map((d) => revive<BookingRequestRecord>(d.data()));
    },

    // ----- admin reads (Phase 5) -----
    async listBookingsInRange({ from, to, limit }) {
      // Single-field range + order on the same field: automatic index.
      const snap = await db
        .collection(BOOKINGS_COLLECTION)
        .where("eventDate", ">=", from)
        .where("eventDate", "<=", to)
        .orderBy("eventDate")
        .limit(limit)
        .get();
      return snap.docs.map((d) => revive<BookingRecord>(d.data()));
    },
    async listBookingsByStatus(statuses, limit) {
      const snap = await db.collection(BOOKINGS_COLLECTION).where("status", "in", [...statuses]).limit(limit).get();
      return snap.docs.map((d) => revive<BookingRecord>(d.data()));
    },
    async getBookings(ids) {
      const unique = [...new Set(ids)].filter(Boolean);
      if (!unique.length) return [];
      const snaps = await db.getAll(...unique.map((id) => db.collection(BOOKINGS_COLLECTION).doc(id)));
      return snaps.filter((s) => s.exists).map((s) => revive<BookingRecord>(s.data()));
    },
    async getRequest(requestId) {
      const snap = await db.collection(BOOKING_REQUESTS_COLLECTION).doc(requestId).get();
      return snap.exists ? revive<BookingRequestRecord>(snap.data()) : null;
    },
    async listOpenRequests(limit) {
      const snap = await db.collection(BOOKING_REQUESTS_COLLECTION).where("status", "==", "open").limit(limit).get();
      return snap.docs
        .map((d) => revive<BookingRequestRecord>(d.data()))
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    },
    async listRequestsForBooking(bookingId) {
      const snap = await db.collection(BOOKING_REQUESTS_COLLECTION).where("bookingId", "==", bookingId).limit(100).get();
      return snap.docs
        .map((d) => revive<BookingRequestRecord>(d.data()))
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    },
    async getConfig() {
      const snap = await db.collection(CONFIG_DOC[0]).doc(CONFIG_DOC[1]).get();
      return snap.exists ? revive<BusinessConfig>(snap.data()) : null;
    },
    async listConfigAudit(limit) {
      const snap = await db.collection(ADMIN_AUDIT_COLLECTION).where("entityType", "==", "config").limit(200).get();
      return snap.docs
        .map((d) => revive<AuditRecord>(d.data()))
        .sort((a, b) => +new Date(b.at) - +new Date(a.at))
        .slice(0, limit);
    },
    async getPayment(paymentId) {
      const snap = await db.collection(PAYMENTS_COLLECTION).doc(paymentId).get();
      return snap.exists ? revive<PaymentRecord>(snap.data()) : null;
    },
    async listPaymentsForBooking(bookingId) {
      const snap = await db.collection(PAYMENTS_COLLECTION).where("bookingId", "==", bookingId).limit(500).get();
      return byCreatedAt(snap.docs.map((d) => revive<PaymentRecord>(d.data())));
    },
    async getQuotation(quotationId) {
      const snap = await db.collection(QUOTATIONS_COLLECTION).doc(quotationId).get();
      return snap.exists ? revive<QuotationRecord>(snap.data()) : null;
    },
    async listQuotationsForBooking(bookingId) {
      const snap = await db.collection(QUOTATIONS_COLLECTION).where("bookingId", "==", bookingId).limit(200).get();
      return byCreatedAt(snap.docs.map((d) => revive<QuotationRecord>(d.data())));
    },
    // ----- Phase 10
    async getReview(reviewId) {
      const snap = await db.collection(REVIEWS_COLLECTION).doc(reviewId).get();
      return snap.exists ? revive<ReviewRecord>(snap.data()) : null;
    },
    async listReviewsByStatus(status, limit) {
      // Single-field equality (automatic index); sorted in memory.
      const snap = await db.collection(REVIEWS_COLLECTION).where("status", "==", status).limit(limit).get();
      return snap.docs.map((d) => revive<ReviewRecord>(d.data())).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    },

    // ----- Phase 9
    async listNotificationsForCustomer(customerId, { before, limit }) {
      // Single-field query (no composite index needed); newest first and the
      // "before" cursor are applied here over the customer's own notifications.
      const snap = await db.collection(NOTIFICATIONS_COLLECTION).where("customerId", "==", customerId).limit(CUSTOMER_SCAN_LIMIT).get();
      return snap.docs
        .map((d) => revive<NotificationRecord>(d.data()))
        .filter((n) => !before || n.createdAt.getTime() < before.getTime())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
    },
    async countUnreadNotifications(customerId) {
      const snap = await db.collection(NOTIFICATIONS_COLLECTION).where("customerId", "==", customerId).where("readAt", "==", null).count().get();
      return snap.data().count;
    },
    async listNotificationsForBooking(bookingId, limit) {
      const snap = await db.collection(NOTIFICATIONS_COLLECTION).where("bookingId", "==", bookingId).limit(limit).get();
      return newestFirst(snap.docs.map((d) => revive<NotificationRecord>(d.data())));
    },
    async listNotificationsInRange({ from, to, limit }) {
      // Range + order on the same single field: automatic index.
      const snap = await db
        .collection(NOTIFICATIONS_COLLECTION)
        .where("createdAt", ">=", Timestamp.fromDate(from))
        .where("createdAt", "<=", Timestamp.fromDate(to))
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
      return snap.docs.map((d) => revive<NotificationRecord>(d.data()));
    },
    async listCommunicationsInRange({ from, to, limit }) {
      const snap = await db
        .collection(COMMUNICATIONS_COLLECTION)
        .where("createdAt", ">=", Timestamp.fromDate(from))
        .where("createdAt", "<=", Timestamp.fromDate(to))
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
      return snap.docs.map((d) => revive<CommunicationRecord>(d.data()));
    },
    async listCommunicationsForBooking(bookingId, limit) {
      const snap = await db.collection(COMMUNICATIONS_COLLECTION).where("bookingId", "==", bookingId).limit(limit).get();
      return newestFirst(snap.docs.map((d) => revive<CommunicationRecord>(d.data())));
    },

    // ----- Phase 8
    async getOperations(bookingId) {
      const snap = await db.collection(OPERATIONS_COLLECTION).doc(bookingId).get();
      return snap.exists ? revive<EventOperationsRecord>(snap.data()) : null;
    },
    async getOperationsMany(ids) {
      const unique = [...new Set(ids)].filter(Boolean);
      if (!unique.length) return [];
      const snaps = await db.getAll(...unique.map((id) => db.collection(OPERATIONS_COLLECTION).doc(id)));
      return snaps.filter((s) => s.exists).map((s) => revive<EventOperationsRecord>(s.data()));
    },
    async getVendor(vendorId) {
      const snap = await db.collection(VENDORS_COLLECTION).doc(vendorId).get();
      return snap.exists ? revive<VendorRecord>(snap.data()) : null;
    },
    async listVendors({ activeOnly, limit }) {
      // Single-field equality / plain collection read, bounded by `limit`; sorted in memory.
      let query: FirebaseFirestore.Query = db.collection(VENDORS_COLLECTION);
      if (activeOnly) query = query.where("active", "==", true);
      const snap = await query.limit(limit).get();
      return snap.docs.map((d) => revive<VendorRecord>(d.data())).sort((a, b) => a.name.localeCompare(b.name));
    },
    async listAssignmentsForBooking(bookingId) {
      const snap = await db.collection(ASSIGNMENTS_COLLECTION).where("bookingId", "==", bookingId).limit(100).get();
      return snap.docs.map((d) => revive<VendorAssignmentRecord>(d.data())).sort((a, b) => +new Date(a.assignedAt) - +new Date(b.assignedAt));
    },
    async listAssignmentsOfVendor(vendorId, limit) {
      const snap = await db.collection(ASSIGNMENTS_COLLECTION).where("vendorId", "==", vendorId).limit(limit).get();
      return snap.docs.map((d) => revive<VendorAssignmentRecord>(d.data())).sort((a, b) => +new Date(b.assignedAt) - +new Date(a.assignedAt));
    },
    async listAuditForEntity(entityType, entityId, limit) {
      // Two equality filters: served by Firestore's automatic single-field indexes.
      const snap = await db
        .collection(ADMIN_AUDIT_COLLECTION)
        .where("entityType", "==", entityType)
        .where("entityId", "==", entityId)
        .limit(limit)
        .get();
      return snap.docs.map((d) => revive<AuditRecord>(d.data())).sort((a, b) => +new Date(b.at) - +new Date(a.at));
    },
    async listAuditForBooking(bookingId, limit) {
      const snap = await db.collection(ADMIN_AUDIT_COLLECTION).where("bookingId", "==", bookingId).limit(limit).get();
      return snap.docs.map((d) => revive<AuditRecord>(d.data())).sort((a, b) => +new Date(b.at) - +new Date(a.at));
    },
  };
}
