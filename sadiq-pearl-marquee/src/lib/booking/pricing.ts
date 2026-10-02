// Pricing engine (Phase 3 architecture, Phase 6 configuration). The ONLY place
// a price is calculated — website requests, staff bookings and approved
// modifications all call quote(). Prices come from the business configuration
// (src/lib/config/business-config.ts); a booking stores the resulting snapshot,
// so later price changes never rewrite existing bookings.
//
// Rules:
//  - Every component the booking needs must have a configured price; if any
//    is missing the result is "unpriced" (with the missing items listed) and
//    no total is produced. 0 is a real price ("explicitly nothing").
//  - Nothing is added that the admin didn't configure (no invented charges).
//  - Whole Pakistani rupees; percentages are rounded to the nearest rupee.
import type { BusinessConfig, PricingMode } from "../config/business-config.ts";

export interface PriceLine {
  code: string;
  label: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

export interface PricingSnapshot {
  /** Business configuration version the price was calculated from. */
  configVersion: string;
  currency: "PKR";
  lines: PriceLine[];
  subtotal: number;
  /** Configured discount taken off the subtotal (0 when none). Absent on pre-Phase-6 snapshots. */
  discount?: number;
  discountLabel?: string;
  serviceCharge: number;
  total: number;
  advanceRequired: number | null;
  calculatedAt: Date;
}

export type Quote = { status: "priced"; snapshot: PricingSnapshot } | { status: "unpriced"; missing: string[] };

export interface QuoteRequest {
  hallId: string;
  guestCount: number;
  serviceIds: string[];
  menuId: string | null;
  packageId: string | null;
}

const isAmount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
const isPercent = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;

function priced(mode: PricingMode | null, price: number | null, guests: number): { quantity: number; unit: number } | null {
  if (!mode || !isAmount(price)) return null;
  return mode === "per_guest" ? { quantity: guests, unit: price } : { quantity: 1, unit: price };
}

/** Calculates a price from the configuration, or lists what is still missing. */
export function quote(config: BusinessConfig, req: QuoteRequest, now: Date): Quote {
  const p = config.pricing;
  const missing: string[] = [];
  const lines: PriceLine[] = [];
  const line = (code: string, label: string, quantity: number, unitAmount: number) =>
    lines.push({ code, label, quantity, unitAmount, amount: quantity * unitAmount });
  const hall = config.halls.find((h) => h.id === req.hallId);
  const guests = req.guestCount;

  const rent = p.hallRent[req.hallId];
  if (!isAmount(rent)) missing.push("Hall rent");
  else if (rent > 0) line("hall_rent", `${hall?.name ?? "Hall"} rent`, 1, rent);

  if (!isAmount(p.perGuestRate)) missing.push("Per-guest rate");
  else if (p.perGuestRate > 0) line("per_guest", "Per-guest rate", guests, p.perGuestRate);

  // A package's own services and menu are included in its price.
  const pkg = req.packageId ? config.packages.find((x) => x.id === req.packageId) : null;
  if (req.packageId) {
    if (!pkg) missing.push("Package");
    else {
      const q = priced(pkg.pricingMode, pkg.price, guests);
      if (!q) missing.push(`Price for package "${pkg.name}"`);
      else line(`package:${pkg.id}`, `Package: ${pkg.name}`, q.quantity, q.unit);
    }
  }
  const included = new Set(pkg?.serviceIds ?? []);

  if (req.menuId && req.menuId !== pkg?.menuId) {
    const menu = config.menus.find((m) => m.id === req.menuId);
    if (!menu) missing.push("Menu");
    else {
      const q = priced(menu.pricingMode, menu.price, guests);
      if (!q) missing.push(`Price for menu "${menu.name}"`);
      else line(`menu:${menu.id}`, `Menu: ${menu.name}`, q.quantity, q.unit);
    }
  }

  for (const id of req.serviceIds) {
    if (included.has(id)) continue;
    const s = config.services.find((x) => x.id === id);
    if (!s) {
      missing.push("Service");
      continue;
    }
    const q = priced(s.pricingMode, s.price, guests);
    if (!q) missing.push(`Price for "${s.name}"`);
    else line(`service:${s.id}`, s.name, q.quantity, q.unit);
  }

  const small = p.smallEventSurcharge;
  if (small && isAmount(small.belowGuests) && isAmount(small.perGuest) && guests < small.belowGuests && small.perGuest > 0) {
    line("small_event_surcharge", `Surcharge below ${small.belowGuests} guests`, guests, small.perGuest);
  }

  if (missing.length) return { status: "unpriced", missing };

  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const discount = p.discount && isPercent(p.discount.percent) ? Math.round((subtotal * p.discount.percent) / 100) : 0;
  const afterDiscount = subtotal - discount;
  const serviceCharge = isPercent(p.serviceChargePercent) ? Math.round((afterDiscount * p.serviceChargePercent) / 100) : 0;
  const total = afterDiscount + serviceCharge;
  let advanceRequired: number | null = null;
  if (p.advance?.mode === "percent" && isPercent(p.advance.value)) advanceRequired = Math.round((total * p.advance.value) / 100);
  if (p.advance?.mode === "fixed" && isAmount(p.advance.value)) advanceRequired = Math.min(p.advance.value, total);

  return {
    status: "priced",
    snapshot: {
      configVersion: String(config.version),
      currency: "PKR",
      lines,
      subtotal,
      discount,
      ...(discount > 0 && p.discount ? { discountLabel: p.discount.label } : {}),
      serviceCharge,
      total,
      advanceRequired,
      calculatedAt: now,
    },
  };
}
