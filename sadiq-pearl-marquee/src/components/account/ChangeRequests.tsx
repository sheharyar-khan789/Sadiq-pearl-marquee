"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { AvailabilityResponse, SlotState } from "@/lib/booking/availability";
import { activeMenus, activeServices, activeSlots, DEFAULT_HALL_ID, getHall, type BusinessConfig, type SlotId } from "@/lib/booking/catalog";
import { addDays } from "@/lib/booking/dates";
import Icon from "../Icon";

type Mode = null | "modification" | "cancellation";
type Notice = { tone: "error" | "info"; message: string; action?: { href: string; label: string } };

const inputClass =
  "block h-12 w-full rounded-xl border border-line-strong/50 bg-surface px-4 text-[0.9375rem] text-ink placeholder:text-ink-muted/70 focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40 aria-[invalid=true]:border-red-600";
const labelClass = "mb-1.5 block text-[0.8125rem] font-semibold text-ink";

function newKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

const SLOT_HINT: Record<SlotState, string> = {
  available: "This date and slot are free at the moment. Our team still needs to approve the change.",
  held: "Someone has already requested this date and slot. You can still ask; our team will review it.",
  booked: "This date and slot are already booked. You can still ask; our team will suggest alternatives.",
  closed: "This date can't be requested.",
};

function Banner({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  const error = notice.tone === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
        error ? "border-red-200 bg-red-50 text-red-800" : "border-gold-container/40 bg-gold-pale/40 text-ink"
      }`}
    >
      <Icon name={error ? "alert" : "check"} className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        {notice.message}
        {notice.action && (
          <>
            {" "}
            <Link href={notice.action.href} className="font-semibold underline underline-offset-2">
              {notice.action.label}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Modification / cancellation REQUESTS for one booking. Nothing here changes
 * the booking: the server stores a request for the venue team to review.
 */
export default function ChangeRequests({
  bookingId,
  today,
  config,
  current,
  openTypes,
}: {
  bookingId: string;
  today: string;
  /** Public configuration: slots, menus, services, capacity and the modification policy. */
  config: BusinessConfig;
  current: { eventDate: string; slotId: SlotId; guestCount: number; menuPreferenceId: string | null; serviceIds: string[] };
  openTypes: string[];
}) {
  const uid = useId();
  const router = useRouter();
  const hall = getHall(config, DEFAULT_HALL_ID) ?? config.halls[0];
  const horizonDays = config.rules.bookingHorizonDays;
  // The admin's modification policy: only these changes can be requested.
  const allowed = config.rules.modifications;
  const services = activeServices(config);
  const [serviceIds, setServiceIds] = useState<string[]>(current.serviceIds);
  const [mode, setMode] = useState<Mode>(null);
  const [form, setForm] = useState({
    eventDate: current.eventDate,
    slotId: current.slotId as string,
    guests: String(current.guestCount),
    menu: current.menuPreferenceId ?? "",
    decoration: "",
    notes: "",
  });
  const [reason, setReason] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [slotHint, setSlotHint] = useState<SlotState | null>(null);
  const busyRef = useRef(false);
  const attempt = useRef<{ payload: string; key: string } | null>(null);

  const cancellationOpen = openTypes.includes("cancellation");
  const modificationOpen = openTypes.includes("modification");
  const slotChanged = form.eventDate !== current.eventDate || form.slotId !== current.slotId;

  // Informational only: shows whether the requested date/slot is free right now.
  useEffect(() => {
    if (mode !== "modification" || !slotChanged || !/^\d{4}-\d{2}-\d{2}$/.test(form.eventDate) || form.eventDate < today) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlotHint(null);
      return;
    }
    const ctrl = new AbortController();
    const params = new URLSearchParams({ hall: DEFAULT_HALL_ID, from: form.eventDate, to: form.eventDate });
    fetch(`/api/availability?${params}`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<AvailabilityResponse>) : null))
      .then((data) => {
        const state = data?.days[0]?.slots.find((s) => s.slotId === form.slotId)?.state ?? null;
        setSlotHint(state);
      })
      .catch(() => setSlotHint(null));
    return () => ctrl.abort();
  }, [mode, slotChanged, form.eventDate, form.slotId, today]);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => ({ ...prev, [key === "guests" ? "guestCount" : key === "menu" ? "menuPreferenceId" : key]: undefined }));
  };

  const send = async (body: Record<string, unknown>) => {
    if (busyRef.current) return; // no double submission
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    const serialised = JSON.stringify(body);
    if (!attempt.current || attempt.current.payload !== serialised) attempt.current = { payload: serialised, key: newKey() };
    try {
      const res = await fetch(`/api/account/bookings/${encodeURIComponent(bookingId)}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...body, requestKey: attempt.current.key }),
      });
      const data = await res.json().catch(() => ({}));
      const code: string = data.error ?? "";
      if (res.ok && data.ok) {
        attempt.current = null;
        setMode(null);
        setNotice({
          tone: "info",
          message:
            body.type === "cancellation"
              ? "Your cancellation request has been sent. Your booking stays as it is until our team contacts you."
              : "Your change request has been sent. Your booking stays as it is until our team confirms the change.",
        });
        router.refresh();
        return;
      }
      attempt.current = code === "request_timeout" || code === "booking_unavailable" ? attempt.current : null;
      if (res.status === 401) {
        setNotice({
          tone: "error",
          message: "Your session has expired. Please sign in again.",
          action: { href: `/login?next=${encodeURIComponent(`/account/bookings/${bookingId}`)}`, label: "Sign in" },
        });
      } else if (res.status === 404) {
        setNotice({ tone: "error", message: "We couldn't find this booking in your account." });
      } else if (code === "request_exists") {
        setNotice({ tone: "error", message: "You already have an open request for this booking. Our team will be in touch." });
        router.refresh();
      } else if (code === "not_allowed") {
        setNotice({ tone: "error", message: "This booking can no longer be changed online. Please contact us on WhatsApp." });
      } else if (code === "no_changes") {
        setNotice({ tone: "error", message: "Nothing has changed yet. Please update at least one detail." });
      } else if (res.status === 400 && data.fields) {
        const fields = data.fields as Record<string, { message: string }>;
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v?.message])));
        setNotice({ tone: "error", message: fields.changes?.message ?? fields.body?.message ?? "Please check the highlighted details." });
      } else {
        setNotice({
          tone: "error",
          message: "We couldn't send your request just now. Please try again — it won't be sent twice.",
        });
      }
    } catch {
      setNotice({ tone: "error", message: "We couldn't reach the server. Check your connection and try again." });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const onModify = (e: React.FormEvent) => {
    e.preventDefault();
    const changes: Record<string, unknown> = {};
    const found: Record<string, string> = {};
    if (allowed.date && form.eventDate !== current.eventDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.eventDate) || form.eventDate < today) found.eventDate = "Please choose a future date.";
      else changes.eventDate = form.eventDate;
    }
    if (allowed.slot && form.slotId !== current.slotId) changes.slotId = form.slotId;
    if (allowed.guestCount && form.guests.trim() !== String(current.guestCount)) {
      const g = Number(form.guests);
      if (!/^\d+$/.test(form.guests.trim()) || g < 1) found.guestCount = "Please enter a whole number of guests.";
      else if (g > hall.capacity) found.guestCount = `The hall holds up to ${hall.capacity.toLocaleString("en-US")} guests.`;
      else changes.guestCount = g;
    }
    if (allowed.menu && (form.menu || null) !== current.menuPreferenceId) changes.menuPreferenceId = form.menu || null;
    if (allowed.services && [...serviceIds].sort().join(",") !== [...current.serviceIds].sort().join(",")) changes.serviceIds = serviceIds;
    if (form.decoration.trim()) changes.decorationPreference = form.decoration.trim();
    if (form.notes.trim()) changes.notes = form.notes.trim();
    setErrors(found);
    if (Object.keys(found).length) return;
    if (!Object.keys(changes).length) {
      setNotice({ tone: "error", message: "Nothing has changed yet. Please update at least one detail." });
      return;
    }
    void send({ type: "modification", changes });
  };

  const onCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!understood) {
      setErrors({ understood: "Please confirm you understand this is a request." });
      return;
    }
    void send({ type: "cancellation", reason: reason.trim() });
  };

  const err = (key: string) =>
    errors[key] ? (
      <p id={`${uid}-${key}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-700">
        {errors[key]}
      </p>
    ) : null;
  const a11y = (key: string) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${uid}-${key}-error` : undefined,
  });

  return (
    <div className="space-y-5">
      <Banner notice={notice} />

      {mode === null && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setMode("modification")}
            disabled={modificationOpen || cancellationOpen}
            className="btn btn-outline"
          >
            <Icon name="doc" className="h-4 w-4" />
            Request a change
          </button>
          <button
            type="button"
            onClick={() => setMode("cancellation")}
            disabled={cancellationOpen}
            className="btn btn-outline"
          >
            <Icon name="close" className="h-4 w-4" />
            Request cancellation
          </button>
        </div>
      )}
      {mode === null && (modificationOpen || cancellationOpen) && (
        <p className="text-sm text-ink-soft">
          {cancellationOpen
            ? "A cancellation request is open for this booking. Our team will contact you."
            : "A change request is open for this booking. You can still ask to cancel."}
        </p>
      )}

      {mode === "modification" && (
        <form onSubmit={onModify} noValidate className="grid gap-5 sm:grid-cols-2" aria-label="Request a change">
          <p className="rounded-2xl bg-surface-low px-4 py-3 text-sm leading-relaxed text-ink-soft sm:col-span-2">
            Change only what you need. This sends a <strong className="font-semibold text-ink">request</strong>: your booking
            stays exactly as it is until our team confirms the change.
          </p>
          {allowed.date && (
          <div>
            <label htmlFor={`${uid}-date`} className={labelClass}>
              Event date
            </label>
            <input
              id={`${uid}-date`}
              type="date"
              min={today}
              max={addDays(today, horizonDays)}
              value={form.eventDate}
              onChange={update("eventDate")}
              className={inputClass}
              {...a11y("eventDate")}
            />
            {err("eventDate")}
          </div>
          )}
          {allowed.slot && (
          <div>
            <label htmlFor={`${uid}-slot`} className={labelClass}>
              Slot
            </label>
            <select id={`${uid}-slot`} value={form.slotId} onChange={update("slotId")} className={inputClass} {...a11y("slotId")}>
              {activeSlots(config).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {err("slotId")}
          </div>
          )}
          {slotChanged && slotHint && (
            <p role="status" className="flex gap-2 text-sm leading-relaxed text-ink-soft sm:col-span-2">
              <Icon name={slotHint === "available" ? "check" : "alert"} className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              {SLOT_HINT[slotHint]}
            </p>
          )}
          {allowed.guestCount && (
          <div>
            <label htmlFor={`${uid}-guests`} className={labelClass}>
              Number of guests
            </label>
            <input
              id={`${uid}-guests`}
              type="number"
              inputMode="numeric"
              min={1}
              max={hall.capacity}
              value={form.guests}
              onChange={update("guests")}
              className={inputClass}
              {...a11y("guestCount")}
            />
            {err("guestCount") ?? <p className="mt-1.5 text-xs text-ink-muted">Up to {hall.capacity.toLocaleString("en-US")} guests</p>}
          </div>
          )}
          {allowed.menu && (
          <div>
            <label htmlFor={`${uid}-menu`} className={labelClass}>
              Menu preference
            </label>
            <select id={`${uid}-menu`} value={form.menu} onChange={update("menu")} className={inputClass} {...a11y("menuPreferenceId")}>
              <option value="">No preference</option>
              {activeMenus(config).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {err("menuPreferenceId")}
          </div>
          )}
          {allowed.services && services.length > 0 && (
            <fieldset className="sm:col-span-2">
              <legend className={labelClass}>Add-on services</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {services.map((sv) => (
                  <label key={sv.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-line-strong/40 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={serviceIds.includes(sv.id)}
                      onChange={() => setServiceIds((l) => (l.includes(sv.id) ? l.filter((x) => x !== sv.id) : [...l, sv.id]))}
                      className="h-5 w-5 shrink-0 accent-[#17120f]"
                    />
                    <span className="font-semibold text-ink">{sv.name}</span>
                  </label>
                ))}
              </div>
              {err("serviceIds")}
            </fieldset>
          )}
          <div className="sm:col-span-2">
            <label htmlFor={`${uid}-decor`} className={labelClass}>
              Decoration preference <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <textarea
              id={`${uid}-decor`}
              rows={2}
              maxLength={500}
              value={form.decoration}
              onChange={update("decoration")}
              className={`${inputClass} h-auto py-3`}
              {...a11y("decorationPreference")}
            />
            {err("decorationPreference")}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${uid}-notes`} className={labelClass}>
              Anything else <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <textarea
              id={`${uid}-notes`}
              rows={3}
              maxLength={1000}
              value={form.notes}
              onChange={update("notes")}
              className={`${inputClass} h-auto py-3`}
              {...a11y("notes")}
            />
            {err("notes")}
          </div>
          <div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => setMode(null)} disabled={busy} className="btn btn-outline">
              Back
            </button>
            <button type="submit" disabled={busy} aria-busy={busy || undefined} className="btn btn-primary">
              {busy ? "Sending…" : "Send change request"}
            </button>
          </div>
        </form>
      )}

      {mode === "cancellation" && (
        <form onSubmit={onCancel} noValidate className="space-y-5" aria-label="Request cancellation">
          <p className="rounded-2xl bg-surface-low px-4 py-3 text-sm leading-relaxed text-ink-soft">
            This sends a cancellation <strong className="font-semibold text-ink">request</strong>. Your booking is not
            cancelled until our team contacts you; any cancellation terms will be explained then.
          </p>
          <div>
            <label htmlFor={`${uid}-reason`} className={labelClass}>
              Reason <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <textarea
              id={`${uid}-reason`}
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`${inputClass} h-auto py-3`}
              {...a11y("reason")}
            />
            {err("reason")}
          </div>
          <div>
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => {
                  setUnderstood(e.target.checked);
                  setErrors((p) => ({ ...p, understood: undefined }));
                }}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#17120f]"
                {...a11y("understood")}
              />
              I understand this is a request and my booking stays active until the team confirms.
            </label>
            {err("understood")}
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => setMode(null)} disabled={busy} className="btn btn-outline">
              Keep my booking
            </button>
            <button type="submit" disabled={busy} aria-busy={busy || undefined} className="btn btn-primary">
              {busy ? "Sending…" : "Send cancellation request"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
