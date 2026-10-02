// ============================================================================
// BUSINESS CONFIGURATION (Phase 6) — the single source for hall, slots,
// booking rules, event types, services, menus, packages, pricing and policies.
// ----------------------------------------------------------------------------
// Stored as ONE versioned Firestore document (businessConfig/main), edited only
// by the Super Admin through server code. Until an admin saves anything, the
// effective configuration is DEFAULT_CONFIG below, which reproduces the
// Phase 3–5 behaviour exactly (same IDs, capacity, hold, horizon, menus).
//
// Nothing here is invented: prices, times, services and packages start empty
// ("not configured"); the only content is what the project already had
// (hall capacity 1,000, Day/Night, the existing event-type list and the menus
// transcribed from the venue's printed menu card, which carries no prices).
// Pure data + helpers: safe for server and client code.
// ============================================================================
import { mehndiMenus, weddingMenus } from "../../data/menu.ts";

export const CONFIG_SCHEMA_VERSION = 1;
export const BUSINESS_TIME_ZONE = "Asia/Karachi";

export const SLOT_IDS = ["day", "night"] as const;
export type SlotId = (typeof SLOT_IDS)[number];

/** Established service categories (project requirements). Services are created by the admin. */
export const SERVICE_CATEGORIES = [
  { id: "decoration", label: "Decoration" },
  { id: "stage", label: "Stage" },
  { id: "lighting", label: "Lighting" },
  { id: "flooring", label: "Flooring" },
  { id: "tables_chairs", label: "Tables & chairs" },
  { id: "photography", label: "Photography" },
  { id: "dj_sound", label: "DJ / sound" },
  { id: "ac", label: "AC" },
  { id: "generator", label: "Generator" },
  { id: "bridal_room", label: "Bridal room" },
  { id: "other", label: "Other services" },
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]["id"];

/** fixed: one amount per booking · per_guest: amount × guest count. */
export const PRICING_MODES = ["fixed", "per_guest"] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

/** Every editable record carries a version so stale edits can be rejected. */
interface Versioned {
  version: number;
}

export interface HallConfig extends Versioned {
  id: string;
  name: string;
  capacity: number;
  active: boolean;
}

export interface SlotConfig extends Versioned {
  id: SlotId;
  label: string;
  /** "HH:mm" in the business time zone, or null = not configured. */
  startTime: string | null;
  endTime: string | null;
  active: boolean;
  sortOrder: number;
}

export interface BookingRules extends Versioned {
  pendingHoldHours: number;
  bookingHorizonDays: number;
  sameDayBookingAllowed: boolean;
  /** null = no minimum. */
  minGuests: number | null;
  maxOpenRequestsPerCustomer: number;
  /** What customers may ask to change (requests still need admin approval). */
  modifications: {
    date: boolean;
    slot: boolean;
    guestCount: boolean;
    services: boolean;
    menu: boolean;
  };
}

export interface EventTypeConfig extends Versioned {
  id: string;
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
}

export interface Priced {
  pricingMode: PricingMode | null;
  /** Whole PKR, or null = not configured ("pricing pending"). */
  price: number | null;
}

export interface ServiceConfig extends Versioned, Priced {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  active: boolean;
  sortOrder: number;
}

export interface MenuItemConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  active: boolean;
  sortOrder: number;
}

export interface MenuConfig extends Versioned, Priced {
  id: string;
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
  items: MenuItemConfig[];
}

export interface PackageConfig extends Versioned, Priced {
  id: string;
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
  /** References to services (never copies of them). */
  serviceIds: string[];
  menuId: string | null;
}

export interface PricingSettings extends Versioned {
  currency: "PKR";
  /** Rent per event by hall ID. null = not configured. 0 = explicitly none. */
  hallRent: Record<string, number | null>;
  /** Base amount per guest for every booking. null = not configured. 0 = none. */
  perGuestRate: number | null;
  /** Extra per guest when below a minimum guest count. null = none. */
  smallEventSurcharge: { belowGuests: number; perGuest: number } | null;
  /** Percentage added after any discount. null = none. */
  serviceChargePercent: number | null;
  /** Explicitly configured discount. null = none. */
  discount: { label: string; percent: number } | null;
  /** Advance due at confirmation. null = not configured. */
  advance: { mode: "percent" | "fixed"; value: number } | null;
}

export interface PolicySettings extends Versioned {
  cancellationPolicy: string;
  refundPolicy: string;
  modificationPolicy: string;
  /** YYYY-MM-DD, or null. */
  effectiveDate: string | null;
  /** Only an active policy is shown to customers. */
  active: boolean;
}

export interface BusinessConfig {
  schemaVersion: number;
  /** Increments on every saved change; stored in every price snapshot. */
  version: number;
  halls: HallConfig[];
  slots: SlotConfig[];
  rules: BookingRules;
  eventTypes: EventTypeConfig[];
  services: ServiceConfig[];
  menus: MenuConfig[];
  packages: PackageConfig[];
  pricing: PricingSettings;
  policies: PolicySettings;
  updatedAt: Date | string | null;
  updatedBy: string | null;
}

// ---------------------------------------------------------------- defaults

const EXISTING_EVENT_TYPES: [string, string][] = [
  ["wedding", "Wedding (Shadi)"],
  ["nikkah", "Nikkah"],
  ["mehndi", "Mehndi"],
  ["barat", "Barat"],
  ["walima", "Walima"],
  ["engagement", "Engagement"],
  ["family-gathering", "Family Gathering"],
  ["other", "Other"],
];

/**
 * The configuration in effect until the Super Admin saves changes. It equals
 * the Phase 3–5 behaviour. Marked values still need business confirmation.
 */
export const DEFAULT_CONFIG: BusinessConfig = {
  schemaVersion: CONFIG_SCHEMA_VERSION,
  version: 0,
  // CONFIRMED capacity 1,000 · display name "Main Hall" REQUIRES CONFIRMATION
  halls: [{ id: "main-hall", name: "Main Hall", capacity: 1000, active: true, version: 0 }],
  // CONFIRMED Day + Night · times NOT CONFIGURED
  slots: [
    { id: "day", label: "Day", startTime: null, endTime: null, active: true, sortOrder: 1, version: 0 },
    { id: "night", label: "Night", startTime: null, endTime: null, active: true, sortOrder: 2, version: 0 },
  ],
  // Phase 3 working values (REQUIRE CONFIRMATION): 48 h hold, 730-day horizon, same-day allowed
  rules: {
    pendingHoldHours: 48,
    bookingHorizonDays: 730,
    sameDayBookingAllowed: true,
    minGuests: null,
    maxOpenRequestsPerCustomer: 3,
    modifications: { date: true, slot: true, guestCount: true, services: true, menu: true },
    version: 0,
  },
  // The list already on the public inquiry form (REQUIRES CONFIRMATION)
  eventTypes: EXISTING_EVENT_TYPES.map(([id, name], i) => ({
    id,
    name,
    description: "",
    active: true,
    sortOrder: i + 1,
    version: 0,
  })),
  // No services until the venue enters them
  services: [],
  // CONFIRMED menus from the printed menu card (no prices on the card)
  menus: [...weddingMenus, ...mehndiMenus].map((m, i) => ({
    id: m.id,
    name: m.title,
    description: "",
    active: true,
    sortOrder: i + 1,
    pricingMode: null,
    price: null,
    items: m.items.map((name, j) => ({
      id: `${m.id}-i${j + 1}`,
      name,
      description: "",
      category: "",
      active: true,
      sortOrder: j + 1,
    })),
    version: 0,
  })),
  packages: [],
  pricing: {
    currency: "PKR",
    hallRent: { "main-hall": null },
    perGuestRate: null,
    // CONFIRMED by the venue's official policy card (src/data/policies.ts):
    // fewer than 300 guests → Rs 300 extra per guest; 5% service charge.
    // Applied by quote() only once base prices exist. The card's AC and
    // extra-time charges are per hour (no per-hour unit here), and the advance
    // AMOUNT is not on the card, so `advance` stays unset.
    smallEventSurcharge: { belowGuests: 300, perGuest: 300 },
    serviceChargePercent: 5,
    discount: null,
    advance: null,
    version: 0,
  },
  policies: {
    cancellationPolicy: "",
    refundPolicy: "",
    modificationPolicy: "",
    effectiveDate: null,
    active: false,
    version: 0,
  },
  updatedAt: null,
  updatedBy: null,
};

// ----------------------------------------------------------------- lookups

export const DEFAULT_HALL_ID = "main-hall";
const byOrder = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;

/** Active records only (for NEW bookings). Historical bookings use their own snapshots. */
export function getHall(c: BusinessConfig, id: unknown): HallConfig | null {
  return c.halls.find((h) => h.id === id && h.active) ?? null;
}
export function activeSlots(c: BusinessConfig): SlotConfig[] {
  return c.slots.filter((s) => s.active).sort(byOrder);
}
export function getSlot(c: BusinessConfig, id: unknown): SlotConfig | null {
  return c.slots.find((s) => s.id === id && s.active) ?? null;
}
/** Any slot, active or not (labels for existing records). */
export function slotLabel(c: BusinessConfig, id: string): string {
  return c.slots.find((s) => s.id === id)?.label ?? id;
}
export function activeEventTypes(c: BusinessConfig): EventTypeConfig[] {
  return c.eventTypes.filter((e) => e.active).sort(byOrder);
}
export function getEventType(c: BusinessConfig, id: unknown): EventTypeConfig | null {
  return c.eventTypes.find((e) => e.id === id && e.active) ?? null;
}
export function activeServices(c: BusinessConfig): ServiceConfig[] {
  return c.services.filter((s) => s.active).sort(byOrder);
}
export function getService(c: BusinessConfig, id: unknown): ServiceConfig | null {
  return c.services.find((s) => s.id === id && s.active) ?? null;
}
export function activeMenus(c: BusinessConfig): MenuConfig[] {
  return c.menus.filter((m) => m.active).sort(byOrder);
}
export function getMenu(c: BusinessConfig, id: unknown): MenuConfig | null {
  return c.menus.find((m) => m.id === id && m.active) ?? null;
}
export function activePackages(c: BusinessConfig): PackageConfig[] {
  return c.packages.filter((p) => p.active).sort(byOrder);
}
export function getPackage(c: BusinessConfig, id: unknown): PackageConfig | null {
  return c.packages.find((p) => p.id === id && p.active) ?? null;
}
/** Labels for existing records whose entity may since have been deactivated. */
export function anyLabel(c: BusinessConfig, kind: "service" | "menu" | "package" | "eventType", id: string): string {
  const list = kind === "service" ? c.services : kind === "menu" ? c.menus : kind === "package" ? c.packages : c.eventTypes;
  return list.find((x) => x.id === id)?.name ?? id;
}

export function slotTimeText(s: Pick<SlotConfig, "startTime" | "endTime">): string | null {
  return s.startTime && s.endTime ? `${s.startTime} – ${s.endTime}` : null;
}

/** What a public page may receive: only active records, same shape. */
export function toPublicConfig(c: BusinessConfig): BusinessConfig {
  return {
    ...c,
    halls: c.halls.filter((h) => h.active),
    slots: activeSlots(c),
    eventTypes: activeEventTypes(c),
    services: activeServices(c),
    menus: activeMenus(c).map((m) => ({ ...m, items: m.items.filter((i) => i.active).sort(byOrder) })),
    packages: activePackages(c),
    policies: c.policies.active ? c.policies : { ...c.policies, cancellationPolicy: "", refundPolicy: "", modificationPolicy: "" },
    updatedBy: null,
  };
}

/** Fills missing sections of a stored document with defaults (forward-compatible reads). */
export function normalizeConfig(raw: Partial<BusinessConfig> | null | undefined): BusinessConfig {
  if (!raw) return DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    rules: { ...DEFAULT_CONFIG.rules, ...raw.rules, modifications: { ...DEFAULT_CONFIG.rules.modifications, ...raw.rules?.modifications } },
    pricing: { ...DEFAULT_CONFIG.pricing, ...raw.pricing },
    policies: { ...DEFAULT_CONFIG.policies, ...raw.policies },
    halls: raw.halls ?? DEFAULT_CONFIG.halls,
    slots: raw.slots ?? DEFAULT_CONFIG.slots,
    eventTypes: raw.eventTypes ?? DEFAULT_CONFIG.eventTypes,
    services: raw.services ?? [],
    menus: raw.menus ?? DEFAULT_CONFIG.menus,
    packages: raw.packages ?? [],
  };
}
