// Server-side validation of a booking request against the CURRENT business
// configuration (Phase 6). The browser form runs the same checks for instant
// feedback, but only the server's result counts. Inactive halls, slots, event
// types, services, menus and packages cannot be chosen for NEW bookings;
// existing bookings keep their stored snapshots.
import {
  getEventType,
  getHall,
  getMenu,
  getPackage,
  getService,
  getSlot,
  type BusinessConfig,
  type SlotId,
} from "../config/business-config.ts";
import { addDays, isIsoDate } from "./dates.ts";

/** Exactly what a customer may send. Anything else is rejected, so fields such
 *  as customerId, status, prices or admin notes can never be supplied. */
export interface BookingRequestInput {
  date: string;
  hallId: string;
  slotId: SlotId;
  eventTypeId: string;
  guestCount: number;
  contactName: string;
  contactPhone: string;
  menuPreferenceId: string | null;
  /** Phase 6: optional package (its menu and services are included in its price). */
  packageId?: string | null;
  serviceIds: string[];
  customerNotes: string;
  /** Random key made once per form; resubmitting it never creates a second booking. */
  requestKey: string;
}

const ALLOWED_FIELDS = new Set<string>([
  "date",
  "hallId",
  "slotId",
  "eventTypeId",
  "guestCount",
  "contactName",
  "contactPhone",
  "menuPreferenceId",
  "packageId",
  "serviceIds",
  "customerNotes",
  "requestKey",
]);

export type BookingField = keyof BookingRequestInput | "body";
export interface FieldError {
  code: string;
  message: string;
}
export type FieldErrors = Partial<Record<BookingField, FieldError>>;
export type ValidationResult = { ok: true; value: BookingRequestInput } | { ok: false; errors: FieldErrors };

export const NOTES_MAX = 1000;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const REQUEST_KEY = /^[A-Za-z0-9_-]{16,80}$/;

export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Guest-count rule from the configuration (shared by bookings and change requests). */
export function guestCountError(
  config: BusinessConfig,
  hallId: string,
  guests: unknown
): { code: string; message: string } | null {
  const hall = config.halls.find((h) => h.id === hallId);
  if (typeof guests !== "number" || !Number.isInteger(guests) || guests < 1) {
    return { code: "invalid_guest_count", message: "Please enter the number of guests (a whole number, at least 1)." };
  }
  if (hall && guests > hall.capacity) {
    return { code: "capacity_exceeded", message: `${hall.name} holds up to ${hall.capacity.toLocaleString("en-US")} guests.` };
  }
  const min = config.rules.minGuests;
  if (min && guests < min) {
    return { code: "below_minimum", message: `Bookings are for at least ${min.toLocaleString("en-US")} guests.` };
  }
  return null;
}

/** Date rule from the configuration (past, same-day policy, booking horizon). */
export function eventDateError(config: BusinessConfig, date: unknown, today: string): { code: string; message: string } | null {
  if (!isIsoDate(date)) return { code: "invalid_date", message: "Please choose a valid date." };
  if (date < today) return { code: "past_date", message: "This date has already passed. Please choose a future date." };
  if (date === today && !config.rules.sameDayBookingAllowed) {
    return { code: "same_day_not_allowed", message: "Same-day bookings can't be requested online. Please contact us." };
  }
  if (date > addDays(today, config.rules.bookingHorizonDays)) {
    return { code: "beyond_horizon", message: "This date is too far ahead to request online. Please contact us." };
  }
  return null;
}

/**
 * @param today Today's date in the business time zone (see businessToday).
 * @param config The current business configuration.
 */
export function validateBookingRequest(raw: unknown, today: string, config: BusinessConfig): ValidationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: { body: { code: "invalid_body", message: "The request could not be read." } } };
  }
  const body = raw as Record<string, unknown>;
  const errors: FieldErrors = {};
  const fail = (field: BookingField, code: string, message: string) => {
    if (!errors[field]) errors[field] = { code, message };
  };

  const unexpected = Object.keys(body).filter((k) => !ALLOWED_FIELDS.has(k));
  if (unexpected.length) fail("body", "unexpected_field", `Unexpected field(s): ${unexpected.join(", ")}.`);

  const dateError = eventDateError(config, body.date, today);
  if (dateError) fail("date", dateError.code, dateError.message);

  const hall = getHall(config, body.hallId);
  if (!hall) fail("hallId", "invalid_hall", "Please choose a hall.");
  if (!getSlot(config, body.slotId)) fail("slotId", "invalid_slot", "Please choose an available slot (Day or Night).");
  if (!getEventType(config, body.eventTypeId)) fail("eventTypeId", "invalid_event_type", "Please choose the type of event.");

  const guests = body.guestCount;
  const guestError = guestCountError(config, hall?.id ?? String(body.hallId), guests);
  if (guestError) fail("guestCount", guestError.code, guestError.message);

  const name = typeof body.contactName === "string" ? body.contactName.trim() : "";
  if (name.length < 2 || name.length > 100 || CONTROL_CHARS.test(name)) {
    fail("contactName", "invalid_name", "Please enter your full name (2–100 characters).");
  }
  const phone = typeof body.contactPhone === "string" ? body.contactPhone.trim() : "";
  const digits = phoneDigits(phone);
  if (!/^\+?[\d\s()-]+$/.test(phone) || digits.length < 10 || digits.length > 15) {
    fail("contactPhone", "invalid_phone", "Please enter a valid phone number (at least 10 digits).");
  }

  // Package, menu, services: only active ones; a package fixes the menu.
  const packageId = body.packageId === undefined || body.packageId === null || body.packageId === "" ? null : body.packageId;
  const pkg = packageId === null ? null : getPackage(config, packageId);
  if (packageId !== null && !pkg) fail("packageId", "invalid_package", "This package is not available.");
  const menu = body.menuPreferenceId;
  const menuId = menu === undefined || menu === null || menu === "" ? null : menu;
  if (menuId !== null && !getMenu(config, menuId)) fail("menuPreferenceId", "invalid_menu", "Please choose a menu from the list.");
  if (pkg?.menuId && menuId !== null && menuId !== pkg.menuId) {
    fail("menuPreferenceId", "menu_not_in_package", "This package comes with its own menu.");
  }
  const services = body.serviceIds ?? [];
  if (
    !Array.isArray(services) ||
    services.length > 30 ||
    new Set(services).size !== services.length ||
    !services.every((id) => getService(config, id))
  ) {
    fail("serviceIds", "invalid_service", "One of the selected services is not available.");
  }
  const notes = body.customerNotes ?? "";
  if (typeof notes !== "string" || notes.length > NOTES_MAX || CONTROL_CHARS.test(notes)) {
    fail("customerNotes", "invalid_notes", `Notes must be under ${NOTES_MAX} characters.`);
  }

  if (typeof body.requestKey !== "string" || !REQUEST_KEY.test(body.requestKey)) {
    fail("requestKey", "invalid_request_key", "Please reload the page and try again.");
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      date: body.date as string,
      hallId: hall!.id,
      slotId: body.slotId as SlotId,
      eventTypeId: body.eventTypeId as string,
      guestCount: guests as number,
      contactName: name,
      contactPhone: phone,
      menuPreferenceId: (pkg?.menuId ?? menuId) as string | null,
      packageId: pkg?.id ?? null,
      serviceIds: services as string[],
      customerNotes: (notes as string).trim(),
      requestKey: body.requestKey as string,
    },
  };
}
