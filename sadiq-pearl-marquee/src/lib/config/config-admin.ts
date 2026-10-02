// Business-configuration changes (Phase 6) — validation and the transactional
// write. Only called by the Super Admin settings API after server-side
// authorization. Every change: strict field allow-list → validation →
// stale-version check → new document version → audit record, all in ONE
// transaction. Nothing is ever hard-deleted (records are deactivated), so
// existing bookings keep resolving; bookings themselves are never touched.
import { auditRecord } from "../booking/engine.ts";
import type { AdminActor } from "../booking/audit-model.ts";
import type { BookingStore } from "../booking/store.ts";
import { isIsoDate } from "../booking/dates.ts";
import {
  CONFIG_SCHEMA_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
  PRICING_MODES,
  SERVICE_CATEGORIES,
  SLOT_IDS,
  type BusinessConfig,
  type EventTypeConfig,
  type MenuConfig,
  type PackageConfig,
  type ServiceConfig,
} from "./business-config.ts";

export const ENTITY_SECTIONS = ["eventTypes", "services", "menus", "packages"] as const;
export type EntitySection = (typeof ENTITY_SECTIONS)[number];
export const SINGLE_SECTIONS = ["hall", "slot", "rules", "pricing", "policies"] as const;

export interface ConfigChange {
  section: string;
  /** For entity sections: create | update | setActive. */
  op?: string;
  id?: string;
  data?: unknown;
  /** The version the admin edited (stale edits are rejected). */
  expectedVersion?: number;
}

export type Errors = Record<string, string>;
export type ChangeResult =
  | { ok: true; config: BusinessConfig; entityId: string; action: "config_created" | "config_updated" | "config_deactivated" | "config_activated"; before: unknown; after: unknown }
  | { ok: false; code: "invalid" | "stale" | "not_found" | "duplicate_id"; errors?: Errors; message?: string };

const MAX_PRICE = 100_000_000;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

// ------------------------------------------------------------ field checks

class V {
  errors: Errors = {};
  private data: Record<string, unknown>;
  constructor(data: Record<string, unknown>, allowed: string[]) {
    this.data = data;
    const extra = Object.keys(data).filter((k) => !allowed.includes(k));
    if (extra.length) this.errors._ = `Unknown field(s): ${extra.join(", ")}`;
  }
  text(k: string, max: number, required = false): string {
    const v = this.data[k];
    if (v === undefined || v === null || v === "") {
      if (required) this.errors[k] = "Required.";
      return "";
    }
    if (typeof v !== "string" || v.length > max || CONTROL.test(v.replace(/[\n\r\t]/g, ""))) {
      this.errors[k] = `Text up to ${max} characters.`;
      return "";
    }
    const t = v.trim();
    if (required && !t) this.errors[k] = "Required.";
    return t;
  }
  bool(k: string): boolean {
    const v = this.data[k];
    if (typeof v !== "boolean") this.errors[k] = "Must be yes or no.";
    return v === true;
  }
  int(k: string, min: number, max: number, nullable = false): number | null {
    const v = this.data[k];
    if (nullable && (v === null || v === undefined || v === "")) return null;
    if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
      this.errors[k] = `A whole number from ${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")}.`;
      return null;
    }
    return v;
  }
  percent(k: string, nullable = true): number | null {
    const v = this.data[k];
    if (nullable && (v === null || v === undefined || v === "")) return null;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100 || Math.round(v * 100) !== v * 100) {
      this.errors[k] = "A percentage from 0 to 100 (up to 2 decimals).";
      return null;
    }
    return v;
  }
  pricing(): { pricingMode: ServiceConfig["pricingMode"]; price: number | null } {
    const mode = this.data.pricingMode ?? null;
    if (mode !== null && !(PRICING_MODES as readonly unknown[]).includes(mode)) this.errors.pricingMode = "Choose fixed or per guest.";
    const price = this.int("price", 0, MAX_PRICE, true);
    if (price !== null && mode === null) this.errors.pricingMode = "Choose how this price applies.";
    return { pricingMode: (mode as ServiceConfig["pricingMode"]) ?? null, price };
  }
  get ok() {
    return Object.keys(this.errors).length === 0;
  }
}

const obj = (x: unknown): Record<string, unknown> | null =>
  typeof x === "object" && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36) || "item";
}

// ------------------------------------------------------------ apply change

/** Pure: validates and applies one change to a configuration. */
export function applyConfigChange(current: BusinessConfig, change: ConfigChange, actorUid: string, now: Date): ChangeResult {
  const c = normalizeConfig(current);
  const data = obj(change.data);
  const next: BusinessConfig = structuredClone(c);
  const stale = (version: number) => change.expectedVersion !== version;
  const bump = (cfg: BusinessConfig): BusinessConfig => ({
    ...cfg,
    schemaVersion: CONFIG_SCHEMA_VERSION,
    version: c.version + 1,
    updatedAt: now,
    updatedBy: actorUid,
  });

  // ---- single sections
  if (change.section === "hall") {
    const i = next.halls.findIndex((h) => h.id === change.id);
    if (i < 0) return { ok: false, code: "not_found" };
    if (stale(next.halls[i].version)) return { ok: false, code: "stale" };
    if (!data) return { ok: false, code: "invalid", errors: { _: "Missing data." } };
    const v = new V(data, ["name", "capacity"]);
    const name = v.text("name", 60, true);
    const capacity = v.int("capacity", 1, 100_000);
    if (!v.ok) return { ok: false, code: "invalid", errors: v.errors };
    const before = c.halls[i];
    next.halls[i] = { ...before, name, capacity: capacity!, version: before.version + 1 };
    if (next.rules.minGuests && next.rules.minGuests > capacity!) {
      return { ok: false, code: "invalid", errors: { capacity: "Capacity can't be below the configured minimum guests." } };
    }
    return { ok: true, config: bump(next), entityId: `halls/${before.id}`, action: "config_updated", before, after: next.halls[i] };
  }

  if (change.section === "slot") {
    const i = next.slots.findIndex((s) => s.id === change.id);
    if (i < 0 || !(SLOT_IDS as readonly string[]).includes(String(change.id))) return { ok: false, code: "not_found" };
    if (stale(next.slots[i].version)) return { ok: false, code: "stale" };
    if (!data) return { ok: false, code: "invalid", errors: { _: "Missing data." } };
    const v = new V(data, ["label", "startTime", "endTime", "active", "sortOrder"]);
    const label = v.text("label", 40, true);
    const start = data.startTime === "" || data.startTime === null ? null : data.startTime;
    const end = data.endTime === "" || data.endTime === null ? null : data.endTime;
    if (start !== null && (typeof start !== "string" || !TIME.test(start))) v.errors.startTime = "Use HH:mm (24-hour).";
    if (end !== null && (typeof end !== "string" || !TIME.test(end))) v.errors.endTime = "Use HH:mm (24-hour).";
    if ((start === null) !== (end === null)) v.errors.endTime = "Set both times, or neither (not configured).";
    else if (start !== null && start === end) v.errors.endTime = "End time must differ from start time.";
    const active = v.bool("active");
    const sortOrder = v.int("sortOrder", 0, 1000);
    if (!v.ok) return { ok: false, code: "invalid", errors: v.errors };
    const before = c.slots[i];
    next.slots[i] = { ...before, label, startTime: start as string | null, endTime: end as string | null, active, sortOrder: sortOrder!, version: before.version + 1 };
    if (!next.slots.some((s) => s.active)) return { ok: false, code: "invalid", errors: { active: "At least one slot must stay active." } };
    return { ok: true, config: bump(next), entityId: `slots/${before.id}`, action: "config_updated", before, after: next.slots[i] };
  }

  if (change.section === "rules") {
    if (stale(c.rules.version)) return { ok: false, code: "stale" };
    if (!data) return { ok: false, code: "invalid", errors: { _: "Missing data." } };
    const v = new V(data, ["pendingHoldHours", "bookingHorizonDays", "sameDayBookingAllowed", "minGuests", "maxOpenRequestsPerCustomer", "modifications"]);
    const capacity = Math.max(...c.halls.filter((h) => h.active).map((h) => h.capacity), 1);
    const pendingHoldHours = v.int("pendingHoldHours", 1, 720);
    const bookingHorizonDays = v.int("bookingHorizonDays", 1, 1825);
    const sameDayBookingAllowed = v.bool("sameDayBookingAllowed");
    const minGuests = v.int("minGuests", 1, capacity, true);
    const maxOpen = v.int("maxOpenRequestsPerCustomer", 1, 20);
    const m = obj(data.modifications);
    const keys = ["date", "slot", "guestCount", "services", "menu"] as const;
    if (!m || Object.keys(m).some((k) => !(keys as readonly string[]).includes(k)) || keys.some((k) => typeof m[k] !== "boolean")) {
      v.errors.modifications = "Choose yes or no for each change type.";
    }
    if (!v.ok) return { ok: false, code: "invalid", errors: v.errors };
    const before = c.rules;
    next.rules = {
      pendingHoldHours: pendingHoldHours!,
      bookingHorizonDays: bookingHorizonDays!,
      sameDayBookingAllowed,
      minGuests,
      maxOpenRequestsPerCustomer: maxOpen!,
      modifications: { date: !!m!.date, slot: !!m!.slot, guestCount: !!m!.guestCount, services: !!m!.services, menu: !!m!.menu },
      version: before.version + 1,
    };
    return { ok: true, config: bump(next), entityId: "rules", action: "config_updated", before, after: next.rules };
  }

  if (change.section === "pricing") {
    if (stale(c.pricing.version)) return { ok: false, code: "stale" };
    if (!data) return { ok: false, code: "invalid", errors: { _: "Missing data." } };
    const v = new V(data, ["hallRent", "perGuestRate", "smallEventSurcharge", "serviceChargePercent", "discount", "advance"]);
    const rentIn = obj(data.hallRent);
    const hallRent: Record<string, number | null> = {};
    if (!rentIn || Object.keys(rentIn).some((id) => !c.halls.some((h) => h.id === id))) v.errors.hallRent = "Rent for known halls only.";
    else {
      for (const h of c.halls) {
        const r = rentIn[h.id];
        if (r === null || r === undefined || r === "") hallRent[h.id] = null;
        else if (typeof r !== "number" || !Number.isInteger(r) || r < 0 || r > MAX_PRICE) v.errors.hallRent = "Rent must be a whole, non-negative amount.";
        else hallRent[h.id] = r;
      }
    }
    const perGuestRate = v.int("perGuestRate", 0, MAX_PRICE, true);
    let smallEventSurcharge: BusinessConfig["pricing"]["smallEventSurcharge"] = null;
    if (data.smallEventSurcharge !== null && data.smallEventSurcharge !== undefined) {
      const sv = obj(data.smallEventSurcharge);
      const inner = new V(sv ?? {}, ["belowGuests", "perGuest"]);
      const below = inner.int("belowGuests", 1, 100_000);
      const per = inner.int("perGuest", 0, MAX_PRICE);
      if (!sv || !inner.ok) v.errors.smallEventSurcharge = "Guest threshold and amount per guest are required (or remove it).";
      else smallEventSurcharge = { belowGuests: below!, perGuest: per! };
    }
    const serviceChargePercent = v.percent("serviceChargePercent");
    let discount: BusinessConfig["pricing"]["discount"] = null;
    if (data.discount !== null && data.discount !== undefined) {
      const d = obj(data.discount);
      const inner = new V(d ?? {}, ["label", "percent"]);
      const label = inner.text("label", 60, true);
      const percent = inner.percent("percent", false);
      if (!d || !inner.ok || !percent) v.errors.discount = "A label and a percentage above 0 are required (or remove it).";
      else discount = { label, percent };
    }
    let advance: BusinessConfig["pricing"]["advance"] = null;
    if (data.advance !== null && data.advance !== undefined) {
      const a = obj(data.advance);
      const inner = new V(a ?? {}, ["mode", "value"]);
      const mode = a?.mode;
      const value = mode === "percent" ? inner.percent("value", false) : inner.int("value", 0, MAX_PRICE);
      if (!a || (mode !== "percent" && mode !== "fixed") || !inner.ok) v.errors.advance = "Choose percent or fixed amount with a valid value (or remove it).";
      else advance = { mode, value: value! };
    }
    if (!v.ok) return { ok: false, code: "invalid", errors: v.errors };
    const before = c.pricing;
    next.pricing = { currency: "PKR", hallRent, perGuestRate, smallEventSurcharge, serviceChargePercent, discount, advance, version: before.version + 1 };
    return { ok: true, config: bump(next), entityId: "pricing", action: "config_updated", before, after: next.pricing };
  }

  if (change.section === "policies") {
    if (stale(c.policies.version)) return { ok: false, code: "stale" };
    if (!data) return { ok: false, code: "invalid", errors: { _: "Missing data." } };
    const v = new V(data, ["cancellationPolicy", "refundPolicy", "modificationPolicy", "effectiveDate", "active"]);
    const cancellationPolicy = v.text("cancellationPolicy", 5000);
    const refundPolicy = v.text("refundPolicy", 5000);
    const modificationPolicy = v.text("modificationPolicy", 5000);
    const eff = data.effectiveDate === "" || data.effectiveDate === null || data.effectiveDate === undefined ? null : data.effectiveDate;
    if (eff !== null && !isIsoDate(eff)) v.errors.effectiveDate = "Use a valid date.";
    const active = v.bool("active");
    if (active && !cancellationPolicy && !refundPolicy && !modificationPolicy) v.errors.active = "Write at least one policy before publishing.";
    if (!v.ok) return { ok: false, code: "invalid", errors: v.errors };
    const before = c.policies;
    next.policies = { cancellationPolicy, refundPolicy, modificationPolicy, effectiveDate: eff as string | null, active, version: before.version + 1 };
    return { ok: true, config: bump(next), entityId: "policies", action: "config_updated", before, after: next.policies };
  }

  // ---- entity sections (event types, services, menus, packages)
  if (!(ENTITY_SECTIONS as readonly string[]).includes(change.section)) return { ok: false, code: "invalid", errors: { _: "Unknown section." } };
  const section = change.section as EntitySection;
  const list = next[section] as { id: string; version: number; active: boolean; name: string }[];

  if (change.op === "setActive") {
    const i = list.findIndex((x) => x.id === change.id);
    if (i < 0) return { ok: false, code: "not_found" };
    if (stale(list[i].version)) return { ok: false, code: "stale" };
    const active = obj(data)?.active;
    if (typeof active !== "boolean") return { ok: false, code: "invalid", errors: { active: "Must be yes or no." } };
    const before = list[i];
    list[i] = { ...before, active, version: before.version + 1 };
    if (section === "eventTypes" && !list.some((x) => x.active)) {
      return { ok: false, code: "invalid", errors: { active: "At least one event type must stay active." } };
    }
    return {
      ok: true,
      config: bump(next),
      entityId: `${section}/${before.id}`,
      action: active ? "config_activated" : "config_deactivated",
      before: { active: before.active },
      after: { active },
    };
  }

  if (change.op !== "create" && change.op !== "update") return { ok: false, code: "invalid", errors: { _: "Unknown operation." } };
  if (!data) return { ok: false, code: "invalid", errors: { _: "Missing data." } };
  const existingIndex = change.op === "update" ? list.findIndex((x) => x.id === change.id) : -1;
  if (change.op === "update") {
    if (existingIndex < 0) return { ok: false, code: "not_found" };
    if (stale(list[existingIndex].version)) return { ok: false, code: "stale" };
  }

  const common = ["name", "description", "active", "sortOrder"];
  const fields: Record<EntitySection, string[]> = {
    eventTypes: common,
    services: [...common, "category", "pricingMode", "price"],
    menus: [...common, "pricingMode", "price", "items"],
    packages: [...common, "pricingMode", "price", "serviceIds", "menuId"],
  };
  const v = new V(data, change.op === "create" ? [...fields[section], "id"] : fields[section]);
  const name = v.text("name", 80, true);
  const description = v.text("description", 500);
  const active = v.bool("active");
  const sortOrder = v.int("sortOrder", 0, 10_000);

  // Stable ID: given (validated) or derived from the name; never reused.
  let id = change.op === "update" ? list[existingIndex].id : "";
  if (change.op === "create") {
    if (data.id !== undefined && data.id !== "") {
      if (typeof data.id !== "string" || !ID.test(data.id)) v.errors.id = "Lowercase letters, numbers and dashes (2–40).";
      else if (list.some((x) => x.id === data.id)) return { ok: false, code: "duplicate_id", message: `The ID "${data.id}" already exists.` };
      else id = data.id;
    } else {
      const base = slugify(name);
      id = base;
      for (let n = 2; list.some((x) => x.id === id); n++) id = `${base}-${n}`;
    }
  }
  if (list.some((x, i) => i !== existingIndex && x.name.trim().toLowerCase() === name.toLowerCase())) {
    v.errors.name = "Another item already has this name.";
  }

  let record: EventTypeConfig | ServiceConfig | MenuConfig | PackageConfig;
  const version = change.op === "update" ? list[existingIndex].version + 1 : 1;
  if (section === "eventTypes") {
    record = { id, name, description, active, sortOrder: sortOrder ?? 0, version };
  } else if (section === "services") {
    const category = data.category;
    if (!SERVICE_CATEGORIES.some((k) => k.id === category)) v.errors.category = "Choose a category.";
    record = { id, name, description, active, sortOrder: sortOrder ?? 0, category: category as ServiceConfig["category"], ...v.pricing(), version };
  } else if (section === "menus") {
    const items = data.items ?? [];
    const cleaned: MenuConfig["items"] = [];
    if (!Array.isArray(items) || items.length > 200) v.errors.items = "Up to 200 items.";
    else {
      const used = new Set<string>();
      items.forEach((raw, idx) => {
        const it = obj(raw);
        const iv = new V(it ?? {}, ["id", "name", "description", "category", "active", "sortOrder"]);
        const itemName = iv.text("name", 120, true);
        const itemDesc = iv.text("description", 300);
        const itemCat = iv.text("category", 60);
        const itemActive = iv.bool("active");
        const itemOrder = iv.int("sortOrder", 0, 10_000) ?? idx + 1;
        let itemId = typeof it?.id === "string" && /^[a-z0-9-]{1,60}$/.test(it.id) ? it.id : "";
        if (!itemId || used.has(itemId)) {
          let n = idx + 1;
          do itemId = `${id}-i${n++}`;
          while (used.has(itemId));
        }
        used.add(itemId);
        if (!it || !iv.ok) v.errors[`items.${idx}`] = Object.values(iv.errors)[0] ?? "Invalid item.";
        else cleaned.push({ id: itemId, name: itemName, description: itemDesc, category: itemCat, active: itemActive, sortOrder: itemOrder });
      });
    }
    record = { id, name, description, active, sortOrder: sortOrder ?? 0, ...v.pricing(), items: cleaned, version };
  } else {
    const serviceIds = data.serviceIds ?? [];
    if (
      !Array.isArray(serviceIds) ||
      serviceIds.length > 50 ||
      new Set(serviceIds).size !== serviceIds.length ||
      !serviceIds.every((sid) => c.services.some((s) => s.id === sid && s.active))
    ) {
      v.errors.serviceIds = "Include only existing, active services.";
    }
    const menuId = data.menuId === undefined || data.menuId === null || data.menuId === "" ? null : data.menuId;
    if (menuId !== null && !c.menus.some((m) => m.id === menuId && m.active)) v.errors.menuId = "Choose an existing, active menu.";
    record = { id, name, description, active, sortOrder: sortOrder ?? 0, ...v.pricing(), serviceIds: serviceIds as string[], menuId: menuId as string | null, version };
  }
  if (!v.ok) return { ok: false, code: "invalid", errors: v.errors };

  const before = existingIndex >= 0 ? list[existingIndex] : null;
  if (existingIndex >= 0) list[existingIndex] = record as never;
  else list.push(record as never);
  if (section === "eventTypes" && !list.some((x) => x.active)) {
    return { ok: false, code: "invalid", errors: { active: "At least one event type must stay active." } };
  }
  return {
    ok: true,
    config: bump(next),
    entityId: `${section}/${id}`,
    action: change.op === "create" ? "config_created" : "config_updated",
    before,
    after: record,
  };
}

/**
 * Applies a change in ONE transaction: read the stored document (or the
 * defaults), validate + apply, write with a "not changed since read"
 * precondition, and record the audit entry.
 */
export async function mutateConfig(
  store: BookingStore,
  actor: AdminActor,
  change: ConfigChange,
  now = new Date()
): Promise<ChangeResult> {
  return store.runTransaction(async (tx) => {
    const stored = await tx.getConfig();
    const current = stored ? normalizeConfig(stored.data) : DEFAULT_CONFIG;
    const result = applyConfigChange(current, change, actor.uid, now);
    if (!result.ok) return result;
    tx.putConfig(result.config, stored ? stored.version : null);
    tx.createAudit({
      ...auditRecord(result.action, actor, "", now, {
        before: result.before === null ? null : (JSON.parse(JSON.stringify(result.before)) as Record<string, unknown>),
        after: JSON.parse(JSON.stringify(result.after)) as Record<string, unknown>,
      }),
      entityType: "config",
      entityId: result.entityId,
    });
    return result;
  });
}
