"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { AvailabilityResponse, SlotState } from "@/lib/booking/availability";
import {
  activeEventTypes,
  activeMenus,
  activePackages,
  activeServices,
  activeSlots,
  DEFAULT_HALL_ID,
  getHall,
  type BusinessConfig,
} from "@/lib/booking/catalog";
import { quote } from "@/lib/booking/pricing";
import PriceBreakdown from "../booking/PriceBreakdown";
import { addDays } from "@/lib/booking/dates";
import { SOURCE_LABELS } from "@/lib/booking/admin-view";
import { SlotStateText } from "./AdminUi";
import { NoticeLine, type Notice } from "./BookingActions";

const SOURCES = ["walk_in", "whatsapp", "phone", "other"] as const;
const inputClass =
  "block h-11 w-full rounded-xl border border-line-strong/50 bg-surface px-3 text-[0.9375rem] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40 aria-[invalid=true]:border-red-600";
const labelClass = "mb-1 block text-[0.8125rem] font-semibold text-ink";

function newKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface CustomerOption {
  uid: string;
  name: string;
  email: string | null;
  phone: string | null;
}

/** Staff-entered booking. Submitted to the same engine (and slot locks) as website requests. */
export default function ManualBookingForm({ customers, today, config }: { customers: CustomerOption[]; today: string; config: BusinessConfig }) {
  const hall = getHall(config, DEFAULT_HALL_ID) ?? config.halls[0];
  const horizonDays = config.rules.bookingHorizonDays;
  const menus = activeMenus(config);
  const packages = activePackages(config);
  const services = activeServices(config);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const uid = useId();
  const router = useRouter();
  const [mode, setMode] = useState<"offline" | "account">("offline");
  const [customerId, setCustomerId] = useState("");
  const [f, setF] = useState({
    source: "walk_in",
    status: "confirmed",
    date: "",
    slotId: "day",
    eventTypeId: "",
    guests: "",
    name: "",
    phone: "",
    email: "",
    menu: "",
    packageId: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [slotState, setSlotState] = useState<SlotState | null>(null);
  const busyRef = useRef(false);
  const attempt = useRef<{ payload: string; key: string } | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setF((p) => ({ ...p, [k]: v }));
  };

  // Live availability from the same public engine (informational; the server re-checks on submit).
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date) || f.date < today) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlotState(null);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/availability?${new URLSearchParams({ hall: DEFAULT_HALL_ID, from: f.date, to: f.date })}`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<AvailabilityResponse>) : null))
      .then((d) => setSlotState(d?.days[0]?.slots.find((s) => s.slotId === f.slotId)?.state ?? null))
      .catch(() => setSlotState(null));
    return () => ctrl.abort();
  }, [f.date, f.slotId, today]);

  const pickCustomer = (id: string) => {
    setCustomerId(id);
    const c = customers.find((x) => x.uid === id);
    if (c) setF((p) => ({ ...p, name: p.name || c.name, phone: p.phone || c.phone || "", email: c.email ?? "" }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    const body = {
      source: f.source,
      status: f.status,
      customerId: mode === "account" && customerId ? customerId : null,
      email: mode === "offline" ? f.email.trim() || null : null,
      date: f.date,
      hallId: hall.id,
      slotId: f.slotId,
      eventTypeId: f.eventTypeId,
      guestCount: /^\d+$/.test(f.guests.trim()) ? Number(f.guests.trim()) : -1,
      contactName: f.name,
      contactPhone: f.phone,
      menuPreferenceId: packages.find((p) => p.id === f.packageId)?.menuId ?? (f.menu || null),
      packageId: f.packageId || null,
      serviceIds,
      customerNotes: f.notes,
    };
    if (mode === "account" && !customerId) {
      setErrors({ customerId: "Choose the customer's account, or switch to offline customer." });
      return;
    }
    const serialised = JSON.stringify(body);
    if (!attempt.current || attempt.current.payload !== serialised) attempt.current = { payload: serialised, key: newKey() };
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    setErrors({});
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...body, requestKey: attempt.current.key }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        router.push(`/admin/bookings/${data.bookingId}`);
        return;
      }
      if (res.status === 400 && data.fields) {
        const fields = data.fields as Record<string, { message: string }>;
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v?.message])));
        setNotice({ tone: "error", message: fields.body?.message ?? "Please check the highlighted fields." });
      } else {
        attempt.current = data.error === "timeout" || data.error === "database_error" ? attempt.current : null;
        setNotice({
          tone: "error",
          message: res.status === 401 ? "Your session has expired." : res.status === 403 ? "You are not authorised." : data.message ?? "The booking could not be created.",
        });
      }
    } catch {
      setNotice({ tone: "error", message: "Network error — the booking may not have been saved. Try again (it won't be duplicated)." });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const err = (k: string) =>
    errors[k] ? (
      <p id={`${uid}-${k}-err`} className="mt-1 text-xs font-medium text-red-700">
        {errors[k]}
      </p>
    ) : null;
  const a11y = (k: string) => ({ "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `${uid}-${k}-err` : undefined });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <NoticeLine notice={notice} />

      <fieldset className="rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Customer</legend>
        <div className="mb-3 flex flex-wrap gap-4 text-sm">
          {(["offline", "account"] as const).map((m) => (
            <label key={m} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2">
              <input type="radio" name={`${uid}-mode`} checked={mode === m} onChange={() => setMode(m)} className="h-4 w-4 accent-[#17120f]" />
              {m === "offline" ? "Offline customer (no online account)" : "Existing online account"}
            </label>
          ))}
        </div>
        {mode === "account" && (
          <div className="mb-3">
            <label htmlFor={`${uid}-cust`} className={labelClass}>Account</label>
            <select id={`${uid}-cust`} value={customerId} onChange={(e) => pickCustomer(e.target.value)} className={inputClass} {...a11y("customerId")}>
              <option value="">Choose a customer…</option>
              {customers.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {(c.name || "(no name)") + (c.email ? ` — ${c.email}` : "")}
                </option>
              ))}
            </select>
            {err("customerId")}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor={`${uid}-name`} className={labelClass}>Contact name</label>
            <input id={`${uid}-name`} value={f.name} onChange={set("name")} maxLength={100} className={inputClass} {...a11y("contactName")} />
            {err("contactName")}
          </div>
          <div>
            <label htmlFor={`${uid}-phone`} className={labelClass}>Phone</label>
            <input id={`${uid}-phone`} type="tel" value={f.phone} onChange={set("phone")} maxLength={24} className={inputClass} {...a11y("contactPhone")} />
            {err("contactPhone")}
          </div>
          {mode === "offline" && (
            <div>
              <label htmlFor={`${uid}-email`} className={labelClass}>Email (optional)</label>
              <input id={`${uid}-email`} type="email" value={f.email} onChange={set("email")} className={inputClass} {...a11y("email")} />
              {err("email")}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-muted">No login is created for offline customers. They can be linked to an online account in a later phase.</p>
      </fieldset>

      <fieldset className="rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Booking</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor={`${uid}-source`} className={labelClass}>Source</label>
            <select id={`${uid}-source`} value={f.source} onChange={set("source")} className={inputClass} {...a11y("source")}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
              ))}
            </select>
            {err("source")}
          </div>
          <div>
            <label htmlFor={`${uid}-status`} className={labelClass}>Status</label>
            <select id={`${uid}-status`} value={f.status} onChange={set("status")} className={inputClass} {...a11y("status")}>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
            </select>
            {err("status")}
          </div>
          <div>
            <label htmlFor={`${uid}-date`} className={labelClass}>Event date</label>
            <input id={`${uid}-date`} type="date" min={today} max={addDays(today, horizonDays)} value={f.date} onChange={set("date")} className={inputClass} {...a11y("date")} />
            {err("date")}
          </div>
          <div>
            <label htmlFor={`${uid}-slot`} className={labelClass}>Slot</label>
            <select id={`${uid}-slot`} value={f.slotId} onChange={set("slotId")} className={inputClass} {...a11y("slotId")}>
              {activeSlots(config).map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs" aria-live="polite">
              {slotState ? <>Right now: <SlotStateText state={slotState} /></> : <span className="text-ink-muted">Pick a date to see the slot.</span>}
            </p>
            {err("slotId")}
          </div>
          <div>
            <label htmlFor={`${uid}-event`} className={labelClass}>Event type</label>
            <select id={`${uid}-event`} value={f.eventTypeId} onChange={set("eventTypeId")} className={inputClass} {...a11y("eventTypeId")}>
              <option value="">Choose…</option>
              {activeEventTypes(config).map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            {err("eventTypeId")}
          </div>
          <div>
            <label htmlFor={`${uid}-guests`} className={labelClass}>Guests (max {hall.capacity.toLocaleString("en-US")})</label>
            <input id={`${uid}-guests`} type="number" inputMode="numeric" min={1} max={hall.capacity} value={f.guests} onChange={set("guests")} className={inputClass} {...a11y("guestCount")} />
            {err("guestCount")}
          </div>
          {packages.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor={`${uid}-package`} className={labelClass}>Package</label>
              <select id={`${uid}-package`} value={f.packageId} onChange={set("packageId")} className={inputClass} {...a11y("packageId")}>
                <option value="">No package</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {err("packageId")}
            </div>
          )}
          <div className="sm:col-span-2 lg:col-span-1">
            <label htmlFor={`${uid}-menu`} className={labelClass}>Menu</label>
            <select
              id={`${uid}-menu`}
              value={packages.find((p) => p.id === f.packageId)?.menuId ?? f.menu}
              onChange={set("menu")}
              disabled={!!packages.find((p) => p.id === f.packageId)?.menuId}
              className={`${inputClass} disabled:opacity-70`}
              {...a11y("menuPreferenceId")}
            >
              <option value="">{menus.length ? "Not decided" : "No menus configured"}</option>
              {menus.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            {err("menuPreferenceId")}
          </div>
          {services.length > 0 && (
            <fieldset className="sm:col-span-2 lg:col-span-3">
              <legend className={labelClass}>Services</legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((sv) => {
                  const included = packages.find((p) => p.id === f.packageId)?.serviceIds.includes(sv.id) ?? false;
                  return (
                    <label key={sv.id} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-sm">
                      <input
                        type="checkbox"
                        checked={included || serviceIds.includes(sv.id)}
                        disabled={included}
                        onChange={() => setServiceIds((l) => (l.includes(sv.id) ? l.filter((x) => x !== sv.id) : [...l, sv.id]))}
                        className="h-5 w-5 accent-[#17120f]"
                      />
                      {sv.name}
                      {included && <span className="text-xs text-ink-muted">(in package)</span>}
                    </label>
                  );
                })}
              </div>
              {err("serviceIds")}
            </fieldset>
          )}
          <div className="sm:col-span-2">
            <label htmlFor={`${uid}-notes`} className={labelClass}>Customer notes</label>
            <textarea id={`${uid}-notes`} rows={2} maxLength={1000} value={f.notes} onChange={set("notes")} className={`${inputClass} h-auto py-2`} {...a11y("customerNotes")} />
            {err("customerNotes")}
          </div>
        </div>
        <div className="mt-4">
          <p className="mb-1 text-sm font-semibold text-ink">Price (same engine as the website)</p>
          <PriceBreakdown
            estimate
            quote={quote(
              config,
              {
                hallId: hall.id,
                guestCount: /^\d+$/.test(f.guests.trim()) ? Number(f.guests.trim()) : 0,
                serviceIds,
                menuId: packages.find((p) => p.id === f.packageId)?.menuId ?? (f.menu || null),
                packageId: f.packageId || null,
              },
              new Date()
            )}
          />
        </div>
      </fieldset>

      <button type="submit" disabled={busy} aria-busy={busy || undefined} className="btn btn-primary w-full sm:w-auto">
        {busy ? "Saving…" : "Create booking"}
      </button>
    </form>
  );
}
