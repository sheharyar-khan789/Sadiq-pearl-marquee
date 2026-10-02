"use client";

import { useRouter } from "next/navigation";
import { useCallback, useId, useRef, useState } from "react";
import type { BookingRules, HallConfig, PolicySettings, PricingSettings, SlotConfig } from "@/lib/config/business-config";
import { NoticeLine, type Notice } from "../BookingActions";

// Settings forms for the single-record sections. Every save goes to
// POST /api/admin/settings, which re-validates on the server and rejects
// stale edits (someone saved the same section after this page was loaded).

export const field =
  "block h-11 w-full rounded-xl border border-line-strong/50 bg-surface px-3 text-[0.9375rem] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40 aria-[invalid=true]:border-red-600 disabled:opacity-60";
export const labelCls = "mb-1 block text-[0.8125rem] font-semibold text-ink";

/** Empty input → null; otherwise a number (the server validates it). */
export const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export function useSettingsSave() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const busyRef = useRef(false);
  const save = useCallback(
    async (body: Record<string, unknown>, success = "Saved."): Promise<boolean> => {
      if (busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      setNotice(null);
      setErrors({});
      try {
        const res = await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setNotice({ tone: "info", message: success });
          router.refresh();
          return true;
        }
        if (data.fields) setErrors(data.fields);
        setNotice({
          tone: "error",
          message:
            res.status === 401
              ? "Your session has expired. Sign in again."
              : res.status === 403
                ? "You are not authorised to change settings."
                : data.message ?? "The change could not be saved.",
        });
        return false;
      } catch {
        setNotice({ tone: "error", message: "Network error — nothing was saved. Check the connection and try again." });
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [router]
  );
  return { busy, notice, errors, save };
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs font-medium text-red-700">
      {message}
    </p>
  );
}

function SaveBar({ busy, label = "Save" }: { busy: boolean; label?: string }) {
  return (
    <button type="submit" disabled={busy} aria-busy={busy || undefined} className="btn btn-primary btn-sm">
      {busy ? "Saving…" : label}
    </button>
  );
}

// ------------------------------------------------------------------ hall

export function HallForm({ hall }: { hall: HallConfig }) {
  const uid = useId();
  const { busy, notice, errors, save } = useSettingsSave();
  const [name, setName] = useState(hall.name);
  const [capacity, setCapacity] = useState(String(hall.capacity));
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ section: "hall", id: hall.id, expectedVersion: hall.version, data: { name, capacity: numOrNull(capacity) } }, "Hall saved.");
      }}
    >
      <NoticeLine notice={notice} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-n`} className={labelCls}>Display name</label>
          <input id={`${uid}-n`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={field} aria-invalid={!!errors.name || undefined} />
          <FieldError id={`${uid}-ne`} message={errors.name} />
        </div>
        <div>
          <label htmlFor={`${uid}-c`} className={labelCls}>Capacity (guests)</label>
          <input id={`${uid}-c`} type="number" inputMode="numeric" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className={field} aria-invalid={!!errors.capacity || undefined} />
          <FieldError id={`${uid}-ce`} message={errors.capacity} />
        </div>
      </div>
      <p className="text-xs text-ink-muted">Stable ID: <span className="font-mono">{hall.id}</span> (never changes; existing bookings refer to it).</p>
      <SaveBar busy={busy} label="Save hall" />
    </form>
  );
}

// ------------------------------------------------------------------ slots

export function SlotForm({ slot }: { slot: SlotConfig }) {
  const uid = useId();
  const { busy, notice, errors, save } = useSettingsSave();
  const [f, setF] = useState({ label: slot.label, startTime: slot.startTime ?? "", endTime: slot.endTime ?? "", active: slot.active, sortOrder: String(slot.sortOrder) });
  return (
    <form
      className="space-y-3 rounded-xl border border-line p-3"
      aria-label={`${slot.label} slot`}
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          {
            section: "slot",
            id: slot.id,
            expectedVersion: slot.version,
            data: { label: f.label, startTime: f.startTime || null, endTime: f.endTime || null, active: f.active, sortOrder: numOrNull(f.sortOrder) },
          },
          `${f.label} slot saved.`
        );
      }}
    >
      <NoticeLine notice={notice} />
      <p className="text-sm font-semibold text-ink">
        Slot <span className="font-mono text-ink-muted">{slot.id}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor={`${uid}-l`} className={labelCls}>Display name</label>
          <input id={`${uid}-l`} value={f.label} maxLength={40} onChange={(e) => setF({ ...f, label: e.target.value })} className={field} aria-invalid={!!errors.label || undefined} />
          <FieldError id={`${uid}-le`} message={errors.label} />
        </div>
        <div>
          <label htmlFor={`${uid}-s`} className={labelCls}>Start time</label>
          <input id={`${uid}-s`} type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} className={field} aria-invalid={!!errors.startTime || undefined} />
          <FieldError id={`${uid}-se`} message={errors.startTime} />
        </div>
        <div>
          <label htmlFor={`${uid}-e`} className={labelCls}>End time</label>
          <input id={`${uid}-e`} type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} className={field} aria-invalid={!!errors.endTime || undefined} />
          <FieldError id={`${uid}-ee`} message={errors.endTime} />
        </div>
        <div>
          <label htmlFor={`${uid}-o`} className={labelCls}>Order</label>
          <input id={`${uid}-o`} type="number" inputMode="numeric" min={0} value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} className={field} />
        </div>
      </div>
      <p className="text-xs text-ink-muted">Leave both times empty while they are not final — the public site then shows &ldquo;Timing to be confirmed&rdquo;.</p>
      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="h-5 w-5 accent-[#17120f]" />
        Bookable (active)
      </label>
      <FieldError id={`${uid}-ae`} message={errors.active} />
      <SaveBar busy={busy} label={`Save ${slot.label} slot`} />
    </form>
  );
}

// ------------------------------------------------------------------ rules

export function RulesForm({ rules }: { rules: BookingRules }) {
  const uid = useId();
  const { busy, notice, errors, save } = useSettingsSave();
  const [f, setF] = useState({
    pendingHoldHours: String(rules.pendingHoldHours),
    bookingHorizonDays: String(rules.bookingHorizonDays),
    sameDayBookingAllowed: rules.sameDayBookingAllowed,
    minGuests: rules.minGuests === null ? "" : String(rules.minGuests),
    maxOpenRequestsPerCustomer: String(rules.maxOpenRequestsPerCustomer),
    modifications: { ...rules.modifications },
  });
  const mods: [keyof BookingRules["modifications"], string][] = [
    ["date", "Date change"],
    ["slot", "Slot change"],
    ["guestCount", "Guest-count change"],
    ["services", "Service change"],
    ["menu", "Menu change"],
  ];
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          {
            section: "rules",
            expectedVersion: rules.version,
            data: {
              pendingHoldHours: numOrNull(f.pendingHoldHours),
              bookingHorizonDays: numOrNull(f.bookingHorizonDays),
              sameDayBookingAllowed: f.sameDayBookingAllowed,
              minGuests: numOrNull(f.minGuests),
              maxOpenRequestsPerCustomer: numOrNull(f.maxOpenRequestsPerCustomer),
              modifications: f.modifications,
            },
          },
          "Booking rules saved."
        );
      }}
    >
      <NoticeLine notice={notice} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["pendingHoldHours", "Pending hold (hours)", "How long a new request holds its slot."],
            ["bookingHorizonDays", "Booking horizon (days)", "How far ahead dates can be requested."],
            ["minGuests", "Minimum guests (optional)", "Empty = no minimum."],
            ["maxOpenRequestsPerCustomer", "Open requests per customer", "Abuse protection."],
          ] as const
        ).map(([k, label, hint]) => (
          <div key={k}>
            <label htmlFor={`${uid}-${k}`} className={labelCls}>{label}</label>
            <input
              id={`${uid}-${k}`}
              type="number"
              inputMode="numeric"
              min={k === "minGuests" ? 1 : 1}
              value={f[k]}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
              className={field}
              aria-invalid={!!errors[k] || undefined}
            />
            {errors[k] ? <FieldError id={`${uid}-${k}-e`} message={errors[k]} /> : <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
          </div>
        ))}
      </div>
      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <input type="checkbox" checked={f.sameDayBookingAllowed} onChange={(e) => setF({ ...f, sameDayBookingAllowed: e.target.checked })} className="h-5 w-5 accent-[#17120f]" />
        Allow same-day requests
      </label>
      <fieldset>
        <legend className={labelCls}>Customers may request (always subject to admin approval)</legend>
        <div className="flex flex-wrap gap-x-5">
          {mods.map(([k, label]) => (
            <label key={k} className="flex min-h-[44px] items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={f.modifications[k]}
                onChange={(e) => setF({ ...f, modifications: { ...f.modifications, [k]: e.target.checked } })}
                className="h-5 w-5 accent-[#17120f]"
              />
              {label}
            </label>
          ))}
        </div>
        <FieldError id={`${uid}-me`} message={errors.modifications} />
      </fieldset>
      <p className="text-xs text-ink-muted">Maximum guests = the hall capacity (Hall section). Changes apply to new requests only.</p>
      <SaveBar busy={busy} label="Save booking rules" />
    </form>
  );
}

// ------------------------------------------------------------------ pricing

export function PricingForm({ pricing, halls }: { pricing: PricingSettings; halls: HallConfig[] }) {
  const uid = useId();
  const { busy, notice, errors, save } = useSettingsSave();
  const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
  const [f, setF] = useState({
    rent: Object.fromEntries(halls.map((h) => [h.id, str(pricing.hallRent[h.id])])) as Record<string, string>,
    perGuestRate: str(pricing.perGuestRate),
    small: pricing.smallEventSurcharge !== null,
    smallBelow: str(pricing.smallEventSurcharge?.belowGuests),
    smallPer: str(pricing.smallEventSurcharge?.perGuest),
    serviceCharge: str(pricing.serviceChargePercent),
    discountOn: pricing.discount !== null,
    discountLabel: pricing.discount?.label ?? "",
    discountPercent: str(pricing.discount?.percent),
    advanceMode: (pricing.advance?.mode ?? "none") as "none" | "percent" | "fixed",
    advanceValue: str(pricing.advance?.value),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });
  const num = (label: string, k: keyof typeof f, errKey: string, hint?: string, step = "1") => (
    <div>
      <label htmlFor={`${uid}-${k}`} className={labelCls}>{label}</label>
      <input id={`${uid}-${k}`} type="number" inputMode="decimal" min={0} step={step} value={f[k] as string} onChange={set(k)} className={field} aria-invalid={!!errors[errKey] || undefined} />
      {errors[errKey] ? <FieldError id={`${uid}-${k}-e`} message={errors[errKey]} /> : hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          {
            section: "pricing",
            expectedVersion: pricing.version,
            data: {
              hallRent: Object.fromEntries(Object.entries(f.rent).map(([id, v]) => [id, numOrNull(v)])),
              perGuestRate: numOrNull(f.perGuestRate),
              smallEventSurcharge: f.small ? { belowGuests: numOrNull(f.smallBelow), perGuest: numOrNull(f.smallPer) } : null,
              serviceChargePercent: numOrNull(f.serviceCharge),
              discount: f.discountOn ? { label: f.discountLabel, percent: numOrNull(f.discountPercent) } : null,
              advance: f.advanceMode === "none" ? null : { mode: f.advanceMode, value: numOrNull(f.advanceValue) },
            },
          },
          "Pricing saved. New bookings use it; existing bookings keep their stored prices."
        );
      }}
    >
      <NoticeLine notice={notice} />
      <p className="text-sm text-ink-soft">
        Whole rupees. Leave a price empty while it isn&rsquo;t final — bookings then show &ldquo;Pricing pending&rdquo;. Enter 0 only when
        something is genuinely free / not charged.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {halls.map((h) => (
          <div key={h.id}>
            <label htmlFor={`${uid}-rent-${h.id}`} className={labelCls}>{h.name} rent (per event, PKR)</label>
            <input
              id={`${uid}-rent-${h.id}`}
              type="number"
              inputMode="numeric"
              min={0}
              value={f.rent[h.id] ?? ""}
              onChange={(e) => setF({ ...f, rent: { ...f.rent, [h.id]: e.target.value } })}
              className={field}
              aria-invalid={!!errors.hallRent || undefined}
            />
          </div>
        ))}
        {num("Per-guest rate (PKR per guest)", "perGuestRate", "perGuestRate", "Applies to every booking; menus/packages add their own price.")}
      </div>
      <FieldError id={`${uid}-rent-e`} message={errors.hallRent} />

      <fieldset className="space-y-2 rounded-xl border border-line p-3">
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.small} onChange={set("small")} className="h-5 w-5 accent-[#17120f]" />
          Small-event surcharge
        </label>
        {f.small && (
          <div className="grid gap-3 sm:grid-cols-2">
            {num("Below this many guests", "smallBelow", "smallEventSurcharge")}
            {num("Extra per guest (PKR)", "smallPer", "smallEventSurcharge")}
          </div>
        )}
        <p className="text-xs text-ink-muted">Pre-filled from the printed terms card (below 300 guests: Rs 300 per guest) — confirm or remove.</p>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        {num("Service charge (%)", "serviceCharge", "serviceChargePercent", "Empty = none. The printed card states 5% — confirm.", "0.01")}
      </div>

      <fieldset className="space-y-2 rounded-xl border border-line p-3">
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.discountOn} onChange={set("discountOn")} className="h-5 w-5 accent-[#17120f]" />
          Discount
        </label>
        {f.discountOn && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-dl`} className={labelCls}>Label shown in the price</label>
              <input id={`${uid}-dl`} value={f.discountLabel} maxLength={60} onChange={set("discountLabel")} className={field} />
            </div>
            {num("Percent off subtotal", "discountPercent", "discount", undefined, "0.01")}
          </div>
        )}
        <FieldError id={`${uid}-de`} message={errors.discount} />
      </fieldset>

      <fieldset className="space-y-2 rounded-xl border border-line p-3">
        <legend className="text-sm font-semibold">Advance required at confirmation</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-am`} className={labelCls}>Type</label>
            <select id={`${uid}-am`} value={f.advanceMode} onChange={set("advanceMode")} className={field}>
              <option value="none">Not configured</option>
              <option value="percent">Percentage of total</option>
              <option value="fixed">Fixed amount (PKR)</option>
            </select>
          </div>
          {f.advanceMode !== "none" && num(f.advanceMode === "percent" ? "Percent" : "Amount (PKR)", "advanceValue", "advance", undefined, f.advanceMode === "percent" ? "0.01" : "1")}
        </div>
        <FieldError id={`${uid}-ae`} message={errors.advance} />
        <p className="text-xs text-ink-muted">No payment is taken online. This only shows the advance due in the booking price.</p>
      </fieldset>
      <SaveBar busy={busy} label="Save pricing" />
    </form>
  );
}

// ------------------------------------------------------------------ policies

export function PoliciesForm({ policies }: { policies: PolicySettings }) {
  const uid = useId();
  const { busy, notice, errors, save } = useSettingsSave();
  const [f, setF] = useState({ ...policies, effectiveDate: policies.effectiveDate ?? "" });
  const area = (k: "cancellationPolicy" | "refundPolicy" | "modificationPolicy", label: string) => (
    <div>
      <label htmlFor={`${uid}-${k}`} className={labelCls}>{label}</label>
      <textarea
        id={`${uid}-${k}`}
        rows={4}
        maxLength={5000}
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
        className={`${field} h-auto py-2`}
        aria-invalid={!!errors[k] || undefined}
      />
      <FieldError id={`${uid}-${k}-e`} message={errors[k]} />
    </div>
  );
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          {
            section: "policies",
            expectedVersion: policies.version,
            data: {
              cancellationPolicy: f.cancellationPolicy,
              refundPolicy: f.refundPolicy,
              modificationPolicy: f.modificationPolicy,
              effectiveDate: f.effectiveDate || null,
              active: f.active,
            },
          },
          "Policies saved."
        );
      }}
    >
      <NoticeLine notice={notice} />
      <p className="text-sm text-ink-soft">Write the venue&rsquo;s own policies. Nothing is calculated from this text (no automatic refunds).</p>
      {area("cancellationPolicy", "Cancellation policy")}
      {area("refundPolicy", "Refund policy")}
      {area("modificationPolicy", "Modification policy")}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-eff`} className={labelCls}>Effective date</label>
          <input id={`${uid}-eff`} type="date" value={f.effectiveDate} onChange={(e) => setF({ ...f, effectiveDate: e.target.value })} className={field} />
          <FieldError id={`${uid}-effe`} message={errors.effectiveDate} />
        </div>
      </div>
      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="h-5 w-5 accent-[#17120f]" />
        Show these policies to customers (booking page and their bookings)
      </label>
      <FieldError id={`${uid}-acte`} message={errors.active} />
      <SaveBar busy={busy} label="Save policies" />
    </form>
  );
}
