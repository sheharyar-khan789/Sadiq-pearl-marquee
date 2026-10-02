// The storage contract the booking engine needs. Production uses Firestore
// (firestore-store.ts); tests can supply another implementation with the
// same transactional guarantees.
import type { BookingRecord, SlotLock } from "./model.ts";
import type { BusinessConfig } from "../config/business-config.ts";
import type { AuditRecord } from "./audit-model.ts";
import type { BookingRequestRecord } from "./request-model.ts";
import type { CounterDoc, PaymentRecord, QuotationRecord } from "./finance-model.ts";
import type { EventOperationsRecord, VendorAssignmentRecord, VendorRecord } from "./operations-model.ts";
import type { CommunicationRecord, NotificationRecord } from "./notifications.ts";
import type { ReviewRecord, ReviewStatus } from "./reviews.ts";

/** A document plus an opaque version (Firestore: its update time). */
export interface Versioned<T> {
  data: T;
  version: unknown;
}

/**
 * One atomic unit of work. All reads must happen before any write. If any
 * document read inside the transaction changes before it commits, the
 * transaction is retried or fails; it never commits on stale data.
 */
export interface BookingTransaction {
  getBooking(bookingId: string): Promise<Versioned<BookingRecord> | null>;
  getLock(slotKey: string): Promise<Versioned<SlotLock> | null>;
  /** The customer's bookings whose status is one of `statuses`. */
  listCustomerBookings(customerId: string, statuses: readonly string[]): Promise<BookingRecord[]>;
  getRequest(requestId: string): Promise<Versioned<BookingRequestRecord> | null>;
  /** Open change requests for one booking. */
  listOpenRequestsForBooking(bookingId: string): Promise<BookingRequestRecord[]>;

  /** Fails the commit if the booking already exists. */
  createBooking(record: BookingRecord): void;
  /** Fails the commit if the booking changed since it was read at `version`. */
  updateBooking(bookingId: string, patch: Partial<BookingRecord>, version: unknown): void;
  /** Fails the commit if a lock for this slot already exists. */
  createLock(lock: SlotLock): void;
  /** Fails the commit if the lock changed since it was read at `version`. */
  replaceLock(lock: SlotLock, version: unknown): void;
  /** Fails the commit if the lock changed since it was read at `version`. */
  deleteLock(slotKey: string, version: unknown): void;
  /** Fails the commit if the request already exists. */
  createRequest(record: BookingRequestRecord): void;
  /** Updates a request read in this transaction (a conflicting change aborts/retries it). */
  updateRequest(requestId: string, patch: Partial<BookingRequestRecord>): void;
  /** Adds an admin audit record (Phase 5), committed together with the change. */
  createAudit(record: AuditRecord): void;
  /** Phase 6: the stored business configuration (null = never saved; defaults apply). */
  getConfig(): Promise<Versioned<BusinessConfig> | null>;
  /** Creates (version null) or replaces the configuration; fails if it changed since read. */
  putConfig(config: BusinessConfig, version: unknown | null): void;

  // Payments, quotations and document numbers (Phase 7)
  getPayment(paymentId: string): Promise<Versioned<PaymentRecord> | null>;
  /** Every payment (any status) of one booking, oldest first. */
  listPaymentsForBooking(bookingId: string): Promise<PaymentRecord[]>;
  getQuotation(quotationId: string): Promise<Versioned<QuotationRecord> | null>;
  /** Every quotation (any status) of one booking, oldest first. */
  listQuotationsForBooking(bookingId: string): Promise<QuotationRecord[]>;
  getCounter(name: string): Promise<Versioned<CounterDoc> | null>;
  /** Fails the commit if the payment already exists. */
  createPayment(record: PaymentRecord): void;
  /** Fails the commit if the payment changed since it was read at `version`. */
  updatePayment(paymentId: string, patch: Partial<PaymentRecord>, version: unknown): void;
  /** Fails the commit if the quotation already exists. */
  createQuotation(record: QuotationRecord): void;
  /** Fails the commit if the quotation changed since it was read at `version`. */
  updateQuotation(quotationId: string, patch: Partial<QuotationRecord>, version: unknown): void;
  /** Creates (version null) or advances a counter; fails if it changed since read. */
  putCounter(name: string, value: number, version: unknown | null): void;

  // Event operations (Phase 8)
  getOperations(bookingId: string): Promise<Versioned<EventOperationsRecord> | null>;
  /** Creates (version null; fails if it exists) or replaces the record; fails if it changed since read. */
  putOperations(record: EventOperationsRecord, version: unknown | null): void;
  getVendor(vendorId: string): Promise<Versioned<VendorRecord> | null>;
  /** Creates (version null; fails if it exists) or replaces a vendor; fails if it changed since read. */
  putVendor(record: VendorRecord, version: unknown | null): void;
  getAssignment(assignmentId: string): Promise<Versioned<VendorAssignmentRecord> | null>;
  /** Every assignment (any status) of one vendor - read so a concurrent assignment forces a retry. */
  listAssignmentsForVendor(vendorId: string): Promise<VendorAssignmentRecord[]>;
  /** Every assignment (any status) of one booking. */
  listAssignmentsForBookingTx(bookingId: string): Promise<VendorAssignmentRecord[]>;
  createAssignment(record: VendorAssignmentRecord): void;
  updateAssignment(assignmentId: string, patch: Partial<VendorAssignmentRecord>, version: unknown): void;

  // Notifications / communications (Phase 9)
  /** Fails the commit if a notification with this (event-derived) ID already exists. */
  createNotification(record: NotificationRecord): void;
  getNotification(notificationId: string): Promise<Versioned<NotificationRecord> | null>;
  /** The customer's unread notifications (at most `limit`), with versions for conditional updates. */
  listUnreadNotifications(customerId: string, limit: number): Promise<Versioned<NotificationRecord>[]>;
  updateNotification(notificationId: string, patch: Partial<NotificationRecord>, version: unknown): void;
  getCommunication(communicationId: string): Promise<Versioned<CommunicationRecord> | null>;
  createCommunication(record: CommunicationRecord): void;

  // Reviews (Phase 10)
  getReview(reviewId: string): Promise<Versioned<ReviewRecord> | null>;
  /** Creates (version null; fails if it exists) or replaces a review; fails if it changed since read. */
  putReview(record: ReviewRecord, version: unknown | null): void;
}

/** Server-side filters for the admin booking list (Phase 5). */
export interface AdminBookingQuery {
  /** Inclusive YYYY-MM-DD range on eventDate (always bounded). */
  from: string;
  to: string;
  limit: number;
}

export interface BookingStore {
  runTransaction<T>(work: (tx: BookingTransaction) => Promise<T>): Promise<T>;
  /** Slot locks for one hall between two dates (inclusive), via an indexed query. */
  listLocks(hallId: string, from: string, to: string): Promise<SlotLock[]>;

  // Customer-portal reads (Phase 4). Always scoped to one customer's uid.
  getBooking(bookingId: string): Promise<BookingRecord | null>;
  /** Bookings whose customerId is `customerId` (a single equality query). */
  listBookingsForCustomer(customerId: string, limit: number): Promise<BookingRecord[]>;
  /** The customer's change requests, optionally for one booking and/or only open ones. */
  listRequestsForCustomer(
    customerId: string,
    filter: { bookingId?: string; openOnly?: boolean }
  ): Promise<BookingRequestRecord[]>;

  // Admin reads (Phase 5). Only ever called after Super Admin verification.
  /** Bookings with eventDate in [from, to] (single-field range query), ordered by date. */
  listBookingsInRange(query: AdminBookingQuery): Promise<BookingRecord[]>;
  /** Bookings whose status is one of `statuses` (single-field "in" query). */
  listBookingsByStatus(statuses: readonly string[], limit: number): Promise<BookingRecord[]>;
  getBookings(bookingIds: string[]): Promise<BookingRecord[]>;
  getRequest(requestId: string): Promise<BookingRequestRecord | null>;
  /** All open change requests (any customer), newest first. */
  listOpenRequests(limit: number): Promise<BookingRequestRecord[]>;
  /** All requests for one booking (any status). */
  listRequestsForBooking(bookingId: string): Promise<BookingRequestRecord[]>;
  listAuditForBooking(bookingId: string, limit: number): Promise<AuditRecord[]>;

  // Business configuration (Phase 6)
  /** The stored configuration document, or null when none has been saved yet. */
  getConfig(): Promise<BusinessConfig | null>;
  /** Recent configuration audit records, newest first. */
  listConfigAudit(limit: number): Promise<AuditRecord[]>;

  // Payments / quotations (Phase 7). Callers check access (admin, or the owning customer).
  getPayment(paymentId: string): Promise<PaymentRecord | null>;
  listPaymentsForBooking(bookingId: string): Promise<PaymentRecord[]>;
  getQuotation(quotationId: string): Promise<QuotationRecord | null>;
  listQuotationsForBooking(bookingId: string): Promise<QuotationRecord[]>;

  // Event operations (Phase 8). Admin-only callers.
  getOperations(bookingId: string): Promise<EventOperationsRecord | null>;
  getOperationsMany(bookingIds: string[]): Promise<EventOperationsRecord[]>;
  getVendor(vendorId: string): Promise<VendorRecord | null>;
  /** Vendors, at most `limit`, optionally only active ones; ordered by name. */
  listVendors(options: { activeOnly: boolean; limit: number }): Promise<VendorRecord[]>;
  listAssignmentsForBooking(bookingId: string): Promise<VendorAssignmentRecord[]>;
  listAssignmentsOfVendor(vendorId: string, limit: number): Promise<VendorAssignmentRecord[]>;
  /** Audit records for one non-booking entity (e.g. a vendor), newest first. */
  listAuditForEntity(entityType: string, entityId: string, limit: number): Promise<AuditRecord[]>;

  // Notifications / communications (Phase 9). Customer reads are always scoped to the session uid.
  /** Newest first; `before` = createdAt of the last item on the previous page. */
  listNotificationsForCustomer(customerId: string, options: { before: Date | null; limit: number }): Promise<NotificationRecord[]>;
  countUnreadNotifications(customerId: string): Promise<number>;
  listNotificationsForBooking(bookingId: string, limit: number): Promise<NotificationRecord[]>;
  /** Admin: notifications created in [from, to], newest first. */
  listNotificationsInRange(options: { from: Date; to: Date; limit: number }): Promise<NotificationRecord[]>;
  listCommunicationsInRange(options: { from: Date; to: Date; limit: number }): Promise<CommunicationRecord[]>;
  listCommunicationsForBooking(bookingId: string, limit: number): Promise<CommunicationRecord[]>;

  // Reviews (Phase 10)
  getReview(reviewId: string): Promise<ReviewRecord | null>;
  /** Reviews with one status, at most `limit` (single-field equality query), newest first. */
  listReviewsByStatus(status: ReviewStatus, limit: number): Promise<ReviewRecord[]>;
}
