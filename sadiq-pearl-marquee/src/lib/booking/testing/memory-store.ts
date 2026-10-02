// TEST-ONLY in-memory BookingStore with Firestore-like transaction rules.
// Used by the unit tests, and by the local E2E mode (see ../server.ts), which
// can only switch on with the Auth EMULATOR and a "demo-" project. It is never
// used in production and is not a replacement for Firestore.
//
//  - reads must come before writes (Firestore throws otherwise);
//  - every read is recorded with the document's version; at commit, if any
//    read document (or queried scope) changed, the transaction is retried
//    (Firestore: ABORTED + retry), up to 5 attempts;
//  - create() fails if the document exists; update/delete with a version
//    fail if the document changed (write preconditions).
// Every read yields to the event loop, so concurrent transactions genuinely
// interleave between their reads and their commits.
import type { BookingRecord, SlotLock } from "../model.ts";
import type { BusinessConfig } from "../../config/business-config.ts";
import type { AuditRecord } from "../audit-model.ts";
import type { BookingRequestRecord } from "../request-model.ts";
import type { BookingStore, BookingTransaction } from "../store.ts";
import type { CounterDoc, PaymentRecord, QuotationRecord } from "../finance-model.ts";
import type { EventOperationsRecord, VendorAssignmentRecord, VendorRecord } from "../operations-model.ts";
import type { CommunicationRecord, NotificationRecord } from "../notifications.ts";
import type { ReviewRecord, ReviewStatus } from "../reviews.ts";

type Col = "b" | "l" | "r" | "a" | "c" | "p" | "q" | "n" | "o" | "v" | "g" | "t" | "m" | "w";
interface Doc<T> {
  data: T;
  version: number;
}

type Op =
  | { kind: "create"; col: Col; id: string; data: unknown }
  | { kind: "update"; col: Col; id: string; data: unknown; version: unknown; merge: boolean }
  | { kind: "delete"; col: Col; id: string; version: unknown }
  | { kind: "patch"; col: Col; id: string; data: unknown };

class Contention extends Error {}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const clone = <T>(v: T): T => structuredClone(v);
function hasUndefined(value: unknown): boolean {
  if (value === undefined) return true;
  if (value instanceof Date || value === null || typeof value !== "object") return false;
  return Object.values(value as object).some(hasUndefined);
}
const byCreated =<T extends { createdAt: Date }>(list: T[]) =>
  list.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

export class MemoryBookingStore implements BookingStore {
  private docs = {
    b: new Map<string, Doc<BookingRecord>>(),
    l: new Map<string, Doc<SlotLock>>(),
    r: new Map<string, Doc<BookingRequestRecord>>(),
    a: new Map<string, Doc<AuditRecord>>(),
    c: new Map<string, Doc<BusinessConfig>>(),
    p: new Map<string, Doc<PaymentRecord>>(),
    q: new Map<string, Doc<QuotationRecord>>(),
    n: new Map<string, Doc<CounterDoc>>(),
    o: new Map<string, Doc<EventOperationsRecord>>(),
    v: new Map<string, Doc<VendorRecord>>(),
    g: new Map<string, Doc<VendorAssignmentRecord>>(),
    t: new Map<string, Doc<NotificationRecord>>(),
    m: new Map<string, Doc<CommunicationRecord>>(),
    w: new Map<string, Doc<ReviewRecord>>(),
  };
  /** TEST-ONLY: make the next N commits that write a notification fail (failure-handling tests). */
  failNotificationWrites = 0;
  /** Versions of query scopes ("b:<customerId>", "r:<bookingId>"), for phantom-read detection. */
  private scopes = new Map<string, number>();
  private clock = 0;
  /** Number of transaction attempts that hit contention and were retried. */
  retries = 0;

  async runTransaction<T>(work: (tx: BookingTransaction) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const reads = new Map<string, number | null>();
      const scopeReads = new Map<string, number>();
      const ops: Op[] = [];
      const beforeRead = () => {
        if (ops.length) throw new Error("Firestore transactions require all reads before any writes.");
      };
      const readDoc = async <D>(col: Col, id: string) => {
        beforeRead();
        await tick();
        const doc = this.docs[col].get(id) as Doc<D> | undefined;
        reads.set(`${col}:${id}`, doc?.version ?? null);
        return doc ? { data: clone(doc.data), version: doc.version } : null;
      };
      const readScope = async <D>(scope: string, col: Col, match: (d: D) => boolean) => {
        beforeRead();
        await tick();
        scopeReads.set(scope, this.scopes.get(scope) ?? 0);
        return [...(this.docs[col] as Map<string, Doc<D>>).values()].filter((d) => match(d.data)).map((d) => clone(d.data));
      };

      const tx: BookingTransaction = {
        getBooking: (id) => readDoc<BookingRecord>("b", id),
        getLock: (key) => readDoc<SlotLock>("l", key),
        getRequest: (id) => readDoc<BookingRequestRecord>("r", id),
        listCustomerBookings: (customerId, statuses) =>
          readScope<BookingRecord>(`b:${customerId}`, "b", (b) => b.customerId === customerId && statuses.includes(b.status)),
        listOpenRequestsForBooking: (bookingId) =>
          readScope<BookingRequestRecord>(`r:${bookingId}`, "r", (r) => r.bookingId === bookingId && r.status === "open"),
        createBooking: (record) => void ops.push({ kind: "create", col: "b", id: record.bookingId, data: record }),
        updateBooking: (id, patch, version) =>
          void ops.push({ kind: "update", col: "b", id, data: patch, version, merge: true }),
        createLock: (lock) => void ops.push({ kind: "create", col: "l", id: lock.slotKey, data: lock }),
        replaceLock: (lock, version) =>
          void ops.push({ kind: "update", col: "l", id: lock.slotKey, data: lock, version, merge: false }),
        deleteLock: (key, version) => void ops.push({ kind: "delete", col: "l", id: key, version }),
        createRequest: (record) => void ops.push({ kind: "create", col: "r", id: record.requestId, data: record }),
        updateRequest: (id, patch) => void ops.push({ kind: "patch", col: "r", id, data: patch }),
        createAudit: (record) => void ops.push({ kind: "create", col: "a", id: record.auditId, data: record }),
        getConfig: () => readDoc<BusinessConfig>("c", "main"),
        putConfig: (config, version) =>
          void ops.push(
            version === null
              ? { kind: "create", col: "c", id: "main", data: config }
              : { kind: "update", col: "c", id: "main", data: config, version, merge: false }
          ),
        getPayment: (id) => readDoc<PaymentRecord>("p", id),
        listPaymentsForBooking: async (bookingId) =>
          byCreated(await readScope<PaymentRecord>(`p:${bookingId}`, "p", (p) => p.bookingId === bookingId)),
        getQuotation: (id) => readDoc<QuotationRecord>("q", id),
        listQuotationsForBooking: async (bookingId) =>
          byCreated(await readScope<QuotationRecord>(`q:${bookingId}`, "q", (q) => q.bookingId === bookingId)),
        getCounter: (name) => readDoc<CounterDoc>("n", name),
        createPayment: (record) => void ops.push({ kind: "create", col: "p", id: record.paymentId, data: record }),
        updatePayment: (id, patch, version) =>
          void ops.push({ kind: "update", col: "p", id, data: patch, version, merge: true }),
        createQuotation: (record) => void ops.push({ kind: "create", col: "q", id: record.quotationId, data: record }),
        updateQuotation: (id, patch, version) =>
          void ops.push({ kind: "update", col: "q", id, data: patch, version, merge: true }),
        putCounter: (name, value, version) =>
          void ops.push(
            version === null
              ? { kind: "create", col: "n", id: name, data: { value } }
              : { kind: "update", col: "n", id: name, data: { value }, version, merge: false }
          ),
        getOperations: (id) => readDoc<EventOperationsRecord>("o", id),
        putOperations: (record, version) =>
          void ops.push(
            version === null
              ? { kind: "create", col: "o", id: record.bookingId, data: record }
              : { kind: "update", col: "o", id: record.bookingId, data: record, version, merge: false }
          ),
        getVendor: (id) => readDoc<VendorRecord>("v", id),
        putVendor: (record, version) =>
          void ops.push(
            version === null
              ? { kind: "create", col: "v", id: record.vendorId, data: record }
              : { kind: "update", col: "v", id: record.vendorId, data: record, version, merge: false }
          ),
        getAssignment: (id) => readDoc<VendorAssignmentRecord>("g", id),
        listAssignmentsForVendor: (vendorId) =>
          readScope<VendorAssignmentRecord>(`gv:${vendorId}`, "g", (a) => a.vendorId === vendorId),
        listAssignmentsForBookingTx: (bookingId) =>
          readScope<VendorAssignmentRecord>(`gb:${bookingId}`, "g", (a) => a.bookingId === bookingId),
        createAssignment: (record) => void ops.push({ kind: "create", col: "g", id: record.assignmentId, data: record }),
        updateAssignment: (id, patch, version) =>
          void ops.push({ kind: "update", col: "g", id, data: patch, version, merge: true }),
        createNotification: (record) => void ops.push({ kind: "create", col: "t", id: record.notificationId, data: record }),
        getNotification: (id) => readDoc<NotificationRecord>("t", id),
        listUnreadNotifications: async (customerId, limit) => {
          const list = await readScope<NotificationRecord>(`t:${customerId}`, "t", (n) => n.customerId === customerId && n.readAt === null);
          return list.slice(0, limit).map((n) => ({ data: n, version: this.docs.t.get(n.notificationId)!.version }));
        },
        updateNotification: (id, patch, version) => void ops.push({ kind: "update", col: "t", id, data: patch, version, merge: true }),
        getCommunication: (id) => readDoc<CommunicationRecord>("m", id),
        createCommunication: (record) => void ops.push({ kind: "create", col: "m", id: record.communicationId, data: record }),
        getReview: (id) => readDoc<ReviewRecord>("w", id),
        putReview: (record, version) =>
          void ops.push(
            version === null
              ? { kind: "create", col: "w", id: record.reviewId, data: record }
              : { kind: "update", col: "w", id: record.reviewId, data: record, version, merge: false }
          ),
      };

      const result = await work(tx);
      try {
        this.commit(reads, scopeReads, ops);
        return result;
      } catch (error) {
        if (!(error instanceof Contention)) throw error;
        this.retries++;
      }
    }
    throw Object.assign(new Error("Transaction aborted after 5 attempts"), { code: "aborted" });
  }

  /** Synchronous, so it is atomic with respect to other transactions. */
  private commit(reads: Map<string, number | null>, scopeReads: Map<string, number>, ops: Op[]) {
    for (const [key, version] of reads) {
      const [col, id] = [key.slice(0, 1) as Col, key.slice(2)];
      if ((this.docs[col].get(id)?.version ?? null) !== version) throw new Contention();
    }
    for (const [scope, version] of scopeReads) if ((this.scopes.get(scope) ?? 0) !== version) throw new Contention();

    if (this.failNotificationWrites > 0 && ops.some((o) => o.col === "t")) {
      this.failNotificationWrites--;
      throw Object.assign(new Error("simulated notification write failure"), { code: "unavailable" });
    }
    for (const op of ops) {
      // Firestore (without ignoreUndefinedProperties) rejects undefined field values.
      if ("data" in op && hasUndefined(op.data)) {
        throw Object.assign(new Error(`undefined field value in ${op.col}/${op.id}`), { code: "invalid-argument" });
      }
      const existing = this.docs[op.col].get(op.id);
      if (op.kind === "create" && existing) throw Object.assign(new Error("already exists"), { code: "already-exists" });
      if (op.kind === "patch" && !existing) throw Object.assign(new Error("not found"), { code: "not-found" });
      if ((op.kind === "update" || op.kind === "delete") && (!existing || existing.version !== op.version)) {
        throw Object.assign(new Error("precondition failed"), { code: "failed-precondition" });
      }
    }
    for (const op of ops) {
      const map = this.docs[op.col] as Map<string, Doc<unknown>>;
      if (op.kind === "delete") map.delete(op.id);
      else {
        const base = (op.kind === "update" && op.merge) || op.kind === "patch" ? (map.get(op.id)!.data as object) : {};
        map.set(op.id, { data: clone({ ...base, ...(op.data as object) }), version: ++this.clock });
      }
      const data = map.get(op.id)?.data as { customerId?: string; bookingId?: string } | undefined;
      if (op.col === "b" && data?.customerId) this.scopes.set(`b:${data.customerId}`, ++this.clock);
      if (op.col === "r" && data?.bookingId) this.scopes.set(`r:${data.bookingId}`, ++this.clock);
      if ((op.col === "p" || op.col === "q") && data?.bookingId) this.scopes.set(`${op.col}:${data.bookingId}`, ++this.clock);
      if (op.col === "t") {
        const n = data as { customerId?: string } | undefined;
        if (n?.customerId) this.scopes.set(`t:${n.customerId}`, ++this.clock);
      }
      if (op.col === "g") {
        const g = data as { vendorId?: string; bookingId?: string } | undefined;
        if (g?.vendorId) this.scopes.set(`gv:${g.vendorId}`, ++this.clock);
        if (g?.bookingId) this.scopes.set(`gb:${g.bookingId}`, ++this.clock);
      }
    }
  }

  async listLocks(hallId: string, from: string, to: string): Promise<SlotLock[]> {
    await tick();
    return [...this.docs.l.values()]
      .map((d) => clone(d.data))
      .filter((l) => l.hallId === hallId && l.date >= from && l.date <= to);
  }

  async getBooking(bookingId: string): Promise<BookingRecord | null> {
    await tick();
    const doc = this.docs.b.get(bookingId);
    return doc ? clone(doc.data) : null;
  }

  async listBookingsForCustomer(customerId: string, limit: number): Promise<BookingRecord[]> {
    await tick();
    return [...this.docs.b.values()]
      .filter((d) => d.data.customerId === customerId)
      .slice(0, limit)
      .map((d) => clone(d.data));
  }

  async listRequestsForCustomer(customerId: string, filter: { bookingId?: string; openOnly?: boolean }) {
    await tick();
    return [...this.docs.r.values()]
      .map((d) => d.data)
      .filter(
        (r) =>
          r.customerId === customerId &&
          (!filter.bookingId || r.bookingId === filter.bookingId) &&
          (!filter.openOnly || r.status === "open")
      )
      .map(clone);
  }

  // ----- admin reads (Phase 5) -----
  async listBookingsInRange({ from, to, limit }: { from: string; to: string; limit: number }) {
    await tick();
    return [...this.docs.b.values()]
      .map((d) => d.data)
      .filter((b) => b.eventDate >= from && b.eventDate <= to)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
      .slice(0, limit)
      .map(clone);
  }
  async listBookingsByStatus(statuses: readonly string[], limit: number) {
    await tick();
    return [...this.docs.b.values()].map((d) => d.data).filter((b) => statuses.includes(b.status)).slice(0, limit).map(clone);
  }
  async getBookings(ids: string[]) {
    await tick();
    return [...new Set(ids)].map((id) => this.docs.b.get(id)?.data).filter((b): b is BookingRecord => !!b).map(clone);
  }
  async getRequest(requestId: string) {
    await tick();
    const d = this.docs.r.get(requestId);
    return d ? clone(d.data) : null;
  }
  async listOpenRequests(limit: number) {
    await tick();
    return [...this.docs.r.values()]
      .map((d) => d.data)
      .filter((r) => r.status === "open")
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, limit)
      .map(clone);
  }
  async listRequestsForBooking(bookingId: string) {
    await tick();
    return [...this.docs.r.values()]
      .map((d) => d.data)
      .filter((r) => r.bookingId === bookingId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map(clone);
  }
  async listAuditForBooking(bookingId: string, limit: number) {
    await tick();
    return [...this.docs.a.values()]
      .map((d) => d.data)
      .filter((a) => a.bookingId === bookingId)
      .sort((x, y) => +new Date(y.at) - +new Date(x.at))
      .slice(0, limit)
      .map(clone);
  }

  async getConfig() {
    await tick();
    const d = this.docs.c.get("main");
    return d ? clone(d.data) : null;
  }
  async listConfigAudit(limit: number) {
    await tick();
    return [...this.docs.a.values()]
      .map((d) => d.data)
      .filter((a) => a.entityType === "config")
      .sort((x, y) => +new Date(y.at) - +new Date(x.at))
      .slice(0, limit)
      .map(clone);
  }

  // ----- payments / quotations (Phase 7)
  async getPayment(paymentId: string) {
    await tick();
    const d = this.docs.p.get(paymentId);
    return d ? clone(d.data) : null;
  }
  async listPaymentsForBooking(bookingId: string) {
    await tick();
    return byCreated([...this.docs.p.values()].map((d) => d.data).filter((p) => p.bookingId === bookingId).map(clone));
  }
  async getQuotation(quotationId: string) {
    await tick();
    const d = this.docs.q.get(quotationId);
    return d ? clone(d.data) : null;
  }
  async listQuotationsForBooking(bookingId: string) {
    await tick();
    return byCreated([...this.docs.q.values()].map((d) => d.data).filter((q) => q.bookingId === bookingId).map(clone));
  }
  // ----- event operations (Phase 8)
  async getOperations(bookingId: string) {
    await tick();
    const d = this.docs.o.get(bookingId);
    return d ? clone(d.data) : null;
  }
  async getOperationsMany(ids: string[]) {
    await tick();
    return [...new Set(ids)].map((id) => this.docs.o.get(id)?.data).filter((o): o is EventOperationsRecord => !!o).map(clone);
  }
  async getVendor(vendorId: string) {
    await tick();
    const d = this.docs.v.get(vendorId);
    return d ? clone(d.data) : null;
  }
  async listVendors({ activeOnly, limit }: { activeOnly: boolean; limit: number }) {
    await tick();
    return [...this.docs.v.values()]
      .map((d) => d.data)
      .filter((v) => !activeOnly || v.active)
      .slice(0, limit)
      .map(clone)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async listAssignmentsForBooking(bookingId: string) {
    await tick();
    return [...this.docs.g.values()]
      .map((d) => d.data)
      .filter((a) => a.bookingId === bookingId)
      .map(clone)
      .sort((a, b) => +new Date(a.assignedAt) - +new Date(b.assignedAt));
  }
  async listAssignmentsOfVendor(vendorId: string, limit: number) {
    await tick();
    return [...this.docs.g.values()]
      .map((d) => d.data)
      .filter((a) => a.vendorId === vendorId)
      .slice(0, limit)
      .map(clone)
      .sort((a, b) => +new Date(b.assignedAt) - +new Date(a.assignedAt));
  }
  async listAuditForEntity(entityType: string, entityId: string, limit: number) {
    await tick();
    return [...this.docs.a.values()]
      .map((d) => d.data)
      .filter((a) => a.entityType === entityType && a.entityId === entityId)
      .sort((x, y) => +new Date(y.at) - +new Date(x.at))
      .slice(0, limit)
      .map(clone);
  }
  // ----- notifications / communications (Phase 9)
  async listNotificationsForCustomer(customerId: string, { before, limit }: { before: Date | null; limit: number }) {
    await tick();
    return [...this.docs.t.values()]
      .map((d) => d.data)
      .filter((n) => n.customerId === customerId && (!before || +new Date(n.createdAt) < +before))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, limit)
      .map(clone);
  }
  async countUnreadNotifications(customerId: string) {
    await tick();
    return [...this.docs.t.values()].filter((d) => d.data.customerId === customerId && d.data.readAt === null).length;
  }
  async listNotificationsForBooking(bookingId: string, limit: number) {
    await tick();
    return [...this.docs.t.values()]
      .map((d) => d.data)
      .filter((n) => n.bookingId === bookingId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, limit)
      .map(clone);
  }
  async listNotificationsInRange({ from, to, limit }: { from: Date; to: Date; limit: number }) {
    await tick();
    return [...this.docs.t.values()]
      .map((d) => d.data)
      .filter((n) => +new Date(n.createdAt) >= +from && +new Date(n.createdAt) <= +to)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, limit)
      .map(clone);
  }
  async listCommunicationsInRange({ from, to, limit }: { from: Date; to: Date; limit: number }) {
    await tick();
    return [...this.docs.m.values()]
      .map((d) => d.data)
      .filter((c) => +new Date(c.createdAt) >= +from && +new Date(c.createdAt) <= +to)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, limit)
      .map(clone);
  }
  async listCommunicationsForBooking(bookingId: string, limit: number) {
    await tick();
    return [...this.docs.m.values()]
      .map((d) => d.data)
      .filter((c) => c.bookingId === bookingId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, limit)
      .map(clone);
  }
  // ----- reviews (Phase 10)
  async getReview(reviewId: string) {
    await tick();
    const d = this.docs.w.get(reviewId);
    return d ? clone(d.data) : null;
  }
  async listReviewsByStatus(status: ReviewStatus, limit: number) {
    await tick();
    return [...this.docs.w.values()]
      .map((d) => d.data)
      .filter((r) => r.status === status)
      .slice(0, limit)
      .map(clone)
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }
  reviewCount(): number {
    return this.docs.w.size;
  }

  notificationCount(): number {
    return this.docs.t.size;
  }
  communicationCount(): number {
    return this.docs.m.size;
  }
  /** TEST-ONLY: every stored notification (for assertions). */
  allNotifications(): NotificationRecord[] {
    return [...this.docs.t.values()].map((d) => clone(d.data));
  }

  vendorCount(): number {
    return this.docs.v.size;
  }

  paymentCount(): number {
    return this.docs.p.size;
  }
  quotationCount(): number {
    return this.docs.q.size;
  }
  counterValue(name: string): number | null {
    return this.docs.n.get(name)?.data.value ?? null;
  }

  /** TEST-ONLY: put documents directly (seeding). Bypasses the engine on purpose. */
  seed(data: {
    bookings?: BookingRecord[];
    locks?: SlotLock[];
    requests?: BookingRequestRecord[];
    config?: BusinessConfig;
    payments?: PaymentRecord[];
    quotations?: QuotationRecord[];
    operations?: EventOperationsRecord[];
    vendors?: VendorRecord[];
    assignments?: VendorAssignmentRecord[];
    notifications?: NotificationRecord[];
    /** Document-number counters (e.g. "receipt-2026"), so seeded documents and new ones never share a number. */
    counters?: Record<string, number>;
    reviews?: ReviewRecord[];
  }) {
    for (const r of data.reviews ?? []) this.docs.w.set(r.reviewId, { data: clone(r), version: ++this.clock });
    for (const [name, value] of Object.entries(data.counters ?? {})) this.docs.n.set(name, { data: { value }, version: ++this.clock });
    for (const n of data.notifications ?? []) this.docs.t.set(n.notificationId, { data: clone(n), version: ++this.clock });
    for (const o of data.operations ?? []) this.docs.o.set(o.bookingId, { data: clone(o), version: ++this.clock });
    for (const v of data.vendors ?? []) this.docs.v.set(v.vendorId, { data: clone(v), version: ++this.clock });
    for (const g of data.assignments ?? []) this.docs.g.set(g.assignmentId, { data: clone(g), version: ++this.clock });
    if (data.config) this.docs.c.set("main", { data: clone(data.config), version: ++this.clock });
    for (const p of data.payments ?? []) this.docs.p.set(p.paymentId, { data: clone(p), version: ++this.clock });
    for (const q of data.quotations ?? []) this.docs.q.set(q.quotationId, { data: clone(q), version: ++this.clock });
    for (const b of data.bookings ?? []) this.docs.b.set(b.bookingId, { data: clone(b), version: ++this.clock });
    for (const l of data.locks ?? []) this.docs.l.set(l.slotKey, { data: clone(l), version: ++this.clock });
    for (const r of data.requests ?? []) this.docs.r.set(r.requestId, { data: clone(r), version: ++this.clock });
  }

  // Test inspection helpers (not part of BookingStore).
  bookingCount(): number {
    return this.docs.b.size;
  }
  lockCount(): number {
    return this.docs.l.size;
  }
  requestCount(): number {
    return this.docs.r.size;
  }
  auditCount(): number {
    return this.docs.a.size;
  }
  /** Every lock, for consistency checks in tests. */
  allLocks(): SlotLock[] {
    return [...this.docs.l.values()].map((d) => clone(d.data));
  }
  lockFor(slotKey: string): SlotLock | null {
    const doc = this.docs.l.get(slotKey);
    return doc ? clone(doc.data) : null;
  }
}
