// The one availability rule, as a pure function over slot locks. Used by the
// server API; the browser only displays what the server returns.
import { activeSlots, type BusinessConfig, type SlotId } from "../config/business-config.ts";
import { addDays, dateRange } from "./dates.ts";
import { lockIsActive, type SlotLock } from "./model.ts";

/** available: can be requested · held: a request is being considered ·
 *  booked: taken · closed: date passed or outside the booking window. */
export type SlotState = "available" | "held" | "booked" | "closed";

/** available: every slot free · partial: some free · unavailable: none free ·
 *  past / closed: cannot be requested. */
export type DayStatus = "available" | "partial" | "unavailable" | "past" | "closed";

export interface DayAvailability {
  date: string;
  status: DayStatus;
  slots: { slotId: SlotId; state: SlotState }[];
}

export interface AvailabilityResponse {
  hallId: string;
  today: string;
  days: DayAvailability[];
}

export function slotStateFor(lock: SlotLock | undefined, now: Date): SlotState {
  if (!lock || !lockIsActive(lock, now)) return "available";
  return lock.status === "pending" || lock.status === "under_review" ? "held" : "booked";
}

export function buildAvailability(
  config: BusinessConfig,
  hallId: string,
  from: string,
  to: string,
  locks: SlotLock[],
  now: Date,
  today: string
): DayAvailability[] {
  const byKey = new Map(locks.filter((l) => l.hallId === hallId).map((l) => [`${l.date}|${l.slotId}`, l]));
  const lastDay = addDays(today, config.rules.bookingHorizonDays);
  // Only slots that are active in the configuration are offered.
  const slots = activeSlots(config);

  return dateRange(from, to).map((date) => {
    const sameDayClosed = date === today && !config.rules.sameDayBookingAllowed;
    if (date < today || date > lastDay || sameDayClosed) {
      return {
        date,
        status: date < today ? "past" : "closed",
        slots: slots.map((s) => ({ slotId: s.id, state: "closed" as const })),
      };
    }
    const states = slots.map((s) => ({ slotId: s.id, state: slotStateFor(byKey.get(`${date}|${s.id}`), now) }));
    const free = states.filter((s) => s.state === "available").length;
    const status: DayStatus = free === states.length ? "available" : free === 0 ? "unavailable" : "partial";
    return { date, status, slots: states };
  });
}
