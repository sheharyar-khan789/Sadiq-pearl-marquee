"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { AvailabilityResponse, DayAvailability, SlotState } from "@/lib/booking/availability";
import {
  activeEventTypes,
  activeMenus,
  activePackages,
  activeServices,
  activeSlots,
  DEFAULT_HALL_ID,
  getHall,
  slotTimeText,
  type BusinessConfig,
  type SlotId,
} from "@/lib/booking/catalog";
import { quote } from "@/lib/booking/pricing";
import PriceBreakdown from "./PriceBreakdown";
import { addDays } from "@/lib/booking/dates";
import { validateBookingRequest, NOTES_MAX, type BookingField } from "@/lib/booking/validation";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import Icon, { WhatsAppGlyph } from "../Icon";
import VenueTermsList from "../VenueTerms";
import AvailabilityCalendar, { longDate } from "./AvailabilityCalendar";

export interface Viewer {
  signedIn: boolean;
  emailVerified: boolean;
  name: string | null;
  email: string | null;
}

type Step = 1 | 2 | 3 | 4;
type Notice = { tone: "error" | "info"; message: string; action?: { href: string; label: string } };
interface Result {
  reference: string;
  eventDate: string;
  slotId: SlotId;
}

export const SLOT_TAKEN_MESSAGE = "The selected slot is no longer available. Please choose another available slot.";
const monthOf = (date: string) => date.slice(0, 7);
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
};
const lastDayOf = (month: string) => addDays(`${shiftMonth(month, 1)}-01`, -1);

function newRequestKey(): string {
  // randomUUID exists only in secure contexts (https, localhost).
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const inputClass =
  "block h-12 w-full rounded-xl border border-line-strong/50 bg-surface px-4 text-[0.9375rem] text-ink placeholder:text-ink-muted/70 transition-colors focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40 aria-[invalid=true]:border-red-600";
const labelClass = "mb-1.5 block text-[0.8125rem] font-semibold text-ink";

const STATE_LABEL: Record<SlotState, string> = {
  available: "Available",
  held: "Requested — on hold",
  booked: "Booked",
  closed: "Unavailable",
};

function NoticeBanner({ notice }: { notice: Notice | null }) {
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

/** Date → slot → details → review → submit. The server re-checks everything. */
export default function BookingRequestFlow({
  viewer,
  today,
  config,
  initialDate,
  initialSlot,
}: {
  viewer: Viewer;
  today: string;
  /** Public (active-only) business configuration from the server. */
  config: BusinessConfig;
  initialDate: string | null;
  initialSlot: SlotId | null;
}) {
  const uid = useId();
  const hall = getHall(config, DEFAULT_HALL_ID) ?? config.halls[0];
  const slots = activeSlots(config);
  const eventTypes = activeEventTypes(config);
  const menus = activeMenus(config);
  const packages = activePackages(config);
  const services = activeServices(config);
  const horizonDays = config.rules.bookingHorizonDays;
  const slotLabel = (id: SlotId | null) => slots.find((s) => s.id === id)?.label ?? "";
  const slotTime = (id: SlotId) => {
    const s = slots.find((x) => x.id === id);
    return (s && slotTimeText(s)) ?? "Timing to be confirmed";
  };
  const [step, setStep] = useState<Step>(1);
  const [month, setMonth] = useState(monthOf(initialDate ?? today));
  const [months, setMonths] = useState<Record<string, DayAvailability[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [date, setDate] = useState<string | null>(initialDate);
  const [slotId, setSlotId] = useState<SlotId | null>(initialSlot);
  const [form, setForm] = useState({
    eventTypeId: "",
    guests: "",
    contactName: viewer.name ?? "",
    contactPhone: "",
    menuPreferenceId: "",
    packageId: "",
    customerNotes: "",
  });
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<Record<BookingField, string>>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const submittingRef = useRef(false);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const lastMonth = monthOf(addDays(today, horizonDays));
  const days = months[month] ?? null;
  const selectedDay = date ? (months[monthOf(date)] ?? []).find((d) => d.date === date) ?? null : null;
  const slotState = (id: SlotId): SlotState => selectedDay?.slots.find((s) => s.slotId === id)?.state ?? "closed";

  const loadMonth = useCallback(async (m: string) => {
    setLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams({ hall: DEFAULT_HALL_ID, from: `${m}-01`, to: lastDayOf(m) });
      const res = await fetch(`/api/availability?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as AvailabilityResponse;
      setMonths((prev) => ({ ...prev, [m]: data.days }));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Data fetching for the visible month (external system), not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!months[month]) void loadMonth(month);
  }, [month, months, loadMonth]);

  // A slot preselected from the URL is kept only if it is still available.
  useEffect(() => {
    if (!selectedDay || !slotId) return;
    if (slotState(slotId) !== "available") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlotId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  // Move focus to the new step's heading so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [step]);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    const field = (key === "guests" ? "guestCount" : key) as BookingField;
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const selectedPackage = packages.find((p) => p.id === form.packageId) ?? null;
  const packageMenuId = selectedPackage?.menuId ?? null;
  const toggleService = (id: string) =>
    setServiceIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const estimate = () =>
    quote(
      config,
      {
        hallId: hall.id,
        guestCount: /^\d+$/.test(form.guests.trim()) ? Number(form.guests.trim()) : 0,
        serviceIds,
        menuId: packageMenuId ?? (form.menuPreferenceId || null),
        packageId: form.packageId || null,
      },
      new Date()
    );

  const payload = () => ({
    date: date ?? "",
    hallId: hall.id,
    slotId: slotId ?? "",
    eventTypeId: form.eventTypeId,
    guestCount: /^\d+$/.test(form.guests.trim()) ? Number(form.guests.trim()) : -1,
    contactName: form.contactName,
    contactPhone: form.contactPhone,
    menuPreferenceId: packageMenuId ?? (form.menuPreferenceId || null),
    packageId: form.packageId || null,
    serviceIds,
    customerNotes: form.customerNotes,
  });

  const onReview = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateBookingRequest({ ...payload(), requestKey: "client-side-check-only" }, today, config);
    if (!check.ok) {
      setErrors(Object.fromEntries(Object.entries(check.errors).map(([k, v]) => [k, v?.message])));
      return;
    }
    setErrors({});
    setNotice(null);
    setStep(3);
  };

  const backToDates = (message: string) => {
    setNotice({ tone: "error", message });
    setSlotId(null);
    setStep(1);
    if (date) {
      setMonth(monthOf(date));
      void loadMonth(monthOf(date));
    }
  };

  const onSubmit = async () => {
    if (submittingRef.current) return; // no double submission
    submittingRef.current = true;
    setSubmitting(true);
    setNotice(null);

    // Retrying the same details reuses the same key, so a request that did
    // reach the server is never created twice.
    const body = payload();
    const serialised = JSON.stringify(body);
    if (!attempt.current || attempt.current.payload !== serialised) {
      attempt.current = { payload: serialised, key: newRequestKey() };
    }
    const signInHref = `/login?next=${encodeURIComponent(`/book?date=${date}&slot=${slotId}`)}`;

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...body, requestKey: attempt.current.key }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        attempt.current = null;
        setResult(data.booking);
        setStep(4);
        return;
      }
      const code: string = data.error ?? "";
      if (res.status === 409) {
        attempt.current = null;
        backToDates(SLOT_TAKEN_MESSAGE);
      } else if (res.status === 401) {
        attempt.current = null;
        setNotice({
          tone: "error",
          message: "Your session has expired. Please sign in again to send your request.",
          action: { href: signInHref, label: "Sign in" },
        });
      } else if (code === "email_unverified") {
        setNotice({
          tone: "error",
          message: "Please verify your email address before sending a booking request.",
          action: { href: "/account", label: "Go to your account" },
        });
      } else if (res.status === 429) {
        setNotice({
          tone: "error",
          message:
            "You already have several open requests. Please wait for our team to review them, or contact us on WhatsApp.",
        });
      } else if (res.status === 400 && data.fields) {
        const fields = data.fields as Partial<Record<BookingField, { message: string }>>;
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v?.message])));
        if (fields.date || fields.slotId || fields.hallId) backToDates(Object.values(fields)[0]?.message ?? SLOT_TAKEN_MESSAGE);
        else setStep(2);
      } else if (code === "booking_timeout") {
        setNotice({
          tone: "error",
          message: "We couldn't confirm that your request was saved. Please try again — it won't be sent twice.",
        });
      } else {
        setNotice({
          tone: "error",
          message: "Online requests are temporarily unavailable. Please try again shortly, or contact us on WhatsApp.",
        });
      }
    } catch {
      setNotice({
        tone: "error",
        message: "We couldn't reach the server. Check your connection and try again — your request won't be sent twice.",
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setDate(null);
    setSlotId(null);
    setForm((f) => ({ ...f, eventTypeId: "", guests: "", menuPreferenceId: "", packageId: "", customerNotes: "" }));
    setServiceIds([]);
    setMonths({});
    setStep(1);
  };

  const stepTitle = { 1: "Choose a date and slot", 2: "Your event details", 3: "Review your request", 4: "Request sent" }[step];
  const fieldError = (field: BookingField) =>
    errors[field] ? (
      <p id={`${uid}-${field}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-700">
        {errors[field]}
      </p>
    ) : null;
  const a11y = (field: BookingField) => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${uid}-${field}-error` : undefined,
  });

  return (
    <div className="rounded-3xl border border-line bg-surface p-4 shadow-soft sm:p-8 lg:p-10">
      {step < 4 && (
        <ol className="mb-8 flex items-center gap-2 text-xs font-semibold text-ink-muted sm:gap-3 sm:text-sm" aria-label="Progress">
          {["Date & slot", "Details", "Review"].map((label, i) => {
            const n = (i + 1) as Step;
            return (
              <li key={label} className="flex min-w-0 items-center gap-2 sm:gap-3" aria-current={n === step ? "step" : undefined}>
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${
                    n === step ? "bg-espresso text-surface" : n < step ? "bg-gold-pale text-gold" : "bg-surface-mid text-ink-muted"
                  }`}
                >
                  {n < step ? <Icon name="check" className="h-3.5 w-3.5" /> : n}
                </span>
                <span className={n === step ? "text-ink" : "sr-only sm:not-sr-only"}>{label}</span>
                {i < 2 && <span aria-hidden="true" className="h-px w-4 bg-line-strong/60 sm:w-8" />}
              </li>
            );
          })}
        </ol>
      )}

      <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-28 font-display text-[1.75rem] leading-tight text-ink focus:outline-none sm:text-[2rem]">
        {stepTitle}
      </h2>

      <div className="mt-5 space-y-6">
        <NoticeBanner notice={notice} />

        {step === 1 && (
          <>
            {loadError && !days ? (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
                <p>We couldn&rsquo;t load availability right now.</p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => void loadMonth(month)} className="btn btn-outline btn-sm border-red-300 text-red-900">
                    Try again
                  </button>
                  <a href={getWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    <WhatsAppGlyph className="h-4 w-4 text-gold" /> Ask on WhatsApp
                  </a>
                </div>
              </div>
            ) : (
              <AvailabilityCalendar
                month={month}
                days={days}
                selected={date}
                loading={loading}
                onSelect={(d) => {
                  setDate(d);
                  setSlotId(null);
                  setNotice(null);
                }}
                onMonthChange={(delta) => setMonth((m) => shiftMonth(m, delta))}
                canGoBack={month > monthOf(today)}
                canGoForward={month < lastMonth}
              />
            )}

            {date && selectedDay && (
              <fieldset>
                <legend className={labelClass}>Slot on {longDate(date)}</legend>
                <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
                  {slots.map((s) => {
                    const state = slotState(s.id);
                    const free = state === "available";
                    const checked = slotId === s.id;
                    return (
                      <label
                        key={s.id}
                        className={`flex min-h-[64px] items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold-container ${
                          checked
                            ? "border-espresso bg-espresso text-surface"
                            : free
                              ? "cursor-pointer border-line-strong/50 bg-surface text-ink hover:border-ink/50"
                              : "cursor-not-allowed border-transparent bg-surface-mid text-ink-muted"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`${uid}-slot`}
                          value={s.id}
                          checked={checked}
                          disabled={!free}
                          onChange={() => setSlotId(s.id)}
                          className="sr-only"
                        />
                        <span>
                          <span className="block text-base font-semibold">{s.label}</span>
                          <span className={`block text-xs ${checked ? "text-surface/75" : "text-ink-muted"}`}>{slotTime(s.id)}</span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            checked
                              ? "bg-surface/15 text-surface"
                              : free
                                ? "bg-emerald-50 text-emerald-800"
                                : state === "held"
                                  ? "bg-amber-50 text-amber-800"
                                  : "bg-surface-high text-ink-soft"
                          }`}
                        >
                          {checked ? "Selected" : STATE_LABEL[state]}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {selectedDay.status === "unavailable" && (
                  <p className="mt-3 text-sm text-ink-soft">Both slots on this date are taken. Please choose another date.</p>
                )}
              </fieldset>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-muted">
                {hall.name} · up to {hall.capacity.toLocaleString("en-US")} guests
              </p>
              <button
                type="button"
                disabled={!date || !slotId || slotState(slotId) !== "available"}
                onClick={() => {
                  setNotice(null);
                  setStep(2);
                }}
                className="btn btn-primary w-full sm:w-auto"
              >
                Continue
                <Icon name="arrow" className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="rounded-2xl bg-surface-low px-4 py-3 text-sm text-ink-soft">
              <strong className="font-semibold text-ink">{date && longDate(date)}</strong> · {slotLabel(slotId)} slot ·{" "}
              <button type="button" onClick={() => setStep(1)} className="font-semibold text-gold underline underline-offset-2">
                Change
              </button>
            </p>

            {!viewer.signedIn ? (
              <div className="rounded-2xl border border-gold-container/40 bg-gold-pale/30 p-5 sm:p-6">
                <p className="text-[0.9375rem] leading-relaxed text-ink">
                  Please sign in to send a booking request, so we can keep you updated about it.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Link href={`/login?next=${encodeURIComponent(`/book?date=${date}&slot=${slotId}`)}`} className="btn btn-primary">
                    Sign in
                  </Link>
                  <Link href={`/signup?next=${encodeURIComponent(`/book?date=${date}&slot=${slotId}`)}`} className="btn btn-outline">
                    Create an account
                  </Link>
                </div>
              </div>
            ) : !viewer.emailVerified ? (
              <div className="rounded-2xl border border-gold-container/40 bg-gold-pale/30 p-5 sm:p-6">
                <p className="text-[0.9375rem] leading-relaxed text-ink">
                  Please verify your email address first. A request holds a date for you, so we need to know we can reach
                  you.
                </p>
                <Link href="/account" className="btn btn-primary mt-4">
                  Verify my email
                </Link>
              </div>
            ) : (
              <form onSubmit={onReview} noValidate className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${uid}-event`} className={labelClass}>
                    Event type <span className="text-gold">*</span>
                  </label>
                  <select id={`${uid}-event`} value={form.eventTypeId} onChange={update("eventTypeId")} className={inputClass} {...a11y("eventTypeId")}>
                    <option value="">Select event type…</option>
                    {eventTypes.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                  {fieldError("eventTypeId")}
                </div>

                <div>
                  <label htmlFor={`${uid}-guests`} className={labelClass}>
                    Number of guests <span className="text-gold">*</span>
                  </label>
                  <input
                    id={`${uid}-guests`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={hall.capacity}
                    step={1}
                    value={form.guests}
                    onChange={update("guests")}
                    placeholder="e.g. 400"
                    className={inputClass}
                    {...a11y("guestCount")}
                  />
                  {fieldError("guestCount") ?? (
                    <p className="mt-1.5 text-xs text-ink-muted">Up to {hall.capacity.toLocaleString("en-US")} guests</p>
                  )}
                </div>

                <div>
                  <label htmlFor={`${uid}-name`} className={labelClass}>
                    Your name <span className="text-gold">*</span>
                  </label>
                  <input id={`${uid}-name`} type="text" autoComplete="name" maxLength={100} value={form.contactName} onChange={update("contactName")} className={inputClass} {...a11y("contactName")} />
                  {fieldError("contactName")}
                </div>

                <div>
                  <label htmlFor={`${uid}-phone`} className={labelClass}>
                    Phone / WhatsApp <span className="text-gold">*</span>
                  </label>
                  <input
                    id={`${uid}-phone`}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={24}
                    value={form.contactPhone}
                    onChange={update("contactPhone")}
                    placeholder="03XX XXXXXXX"
                    className={inputClass}
                    {...a11y("contactPhone")}
                  />
                  {fieldError("contactPhone")}
                </div>

                {packages.length > 0 && (
                  <div className="sm:col-span-2">
                    <label htmlFor={`${uid}-package`} className={labelClass}>
                      Package <span className="font-normal text-ink-muted">(optional)</span>
                    </label>
                    <select id={`${uid}-package`} value={form.packageId} onChange={update("packageId")} className={inputClass} {...a11y("packageId")}>
                      <option value="">No package</option>
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {selectedPackage?.description && <p className="mt-1.5 text-xs text-ink-muted">{selectedPackage.description}</p>}
                    {fieldError("packageId")}
                  </div>
                )}

                {menus.length > 0 && (
                  <div className="sm:col-span-2">
                    <label htmlFor={`${uid}-menu`} className={labelClass}>
                      Menu <span className="font-normal text-ink-muted">(optional)</span>
                    </label>
                    <select
                      id={`${uid}-menu`}
                      value={packageMenuId ?? form.menuPreferenceId}
                      onChange={update("menuPreferenceId")}
                      disabled={packageMenuId !== null}
                      className={`${inputClass} disabled:opacity-70`}
                      {...a11y("menuPreferenceId")}
                    >
                      <option value="">Not decided yet</option>
                      {menus.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    {packageMenuId !== null && <p className="mt-1.5 text-xs text-ink-muted">Included with the selected package.</p>}
                    {fieldError("menuPreferenceId")}
                  </div>
                )}

                {services.length > 0 && (
                  <fieldset className="sm:col-span-2">
                    <legend className={labelClass}>
                      Add-on services <span className="font-normal text-ink-muted">(optional)</span>
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {services.map((sv) => {
                        const included = selectedPackage?.serviceIds.includes(sv.id) ?? false;
                        return (
                          <label key={sv.id} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-line-strong/40 px-3 py-2.5 text-sm">
                            <input
                              type="checkbox"
                              checked={included || serviceIds.includes(sv.id)}
                              disabled={included}
                              onChange={() => toggleService(sv.id)}
                              className="mt-0.5 h-5 w-5 shrink-0 accent-[#17120f]"
                            />
                            <span>
                              <span className="block font-semibold text-ink">{sv.name}</span>
                              {included ? (
                                <span className="block text-xs text-ink-muted">Included in the package</span>
                              ) : (
                                sv.description && <span className="block text-xs text-ink-muted">{sv.description}</span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {fieldError("serviceIds")}
                  </fieldset>
                )}

                <div className="sm:col-span-2">
                  <label htmlFor={`${uid}-notes`} className={labelClass}>
                    Notes for our team <span className="font-normal text-ink-muted">(optional)</span>
                  </label>
                  <textarea
                    id={`${uid}-notes`}
                    rows={3}
                    maxLength={NOTES_MAX}
                    value={form.customerNotes}
                    onChange={update("customerNotes")}
                    placeholder="Decoration ideas, timing, questions…"
                    className={`${inputClass} h-auto py-3`}
                    {...a11y("customerNotes")}
                  />
                  {fieldError("customerNotes")}
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:col-span-2 sm:flex-row sm:justify-between">
                  <button type="button" onClick={() => setStep(1)} className="btn btn-outline">
                    Back
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Review request
                    <Icon name="arrow" className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-2xl border border-line bg-surface-low p-5 text-sm sm:grid-cols-[auto_1fr]">
              {(
                [
                  ["Date", date ? longDate(date) : ""],
                  ["Slot", `${slotLabel(slotId)} · ${slotId ? slotTime(slotId) : ""}`],
                  ["Hall", hall.name],
                  ["Event", eventTypes.find((e) => e.id === form.eventTypeId)?.name ?? ""],
                  ["Guests", Number(form.guests).toLocaleString("en-US")],
                  ["Name", form.contactName.trim()],
                  ["Phone", form.contactPhone.trim()],
                  ["Package", selectedPackage?.name ?? "None"],
                  ["Menu", menus.find((m) => m.id === (packageMenuId ?? form.menuPreferenceId))?.name ?? "Not decided yet"],
                  [
                    "Services",
                    services.filter((sv) => serviceIds.includes(sv.id) || selectedPackage?.serviceIds.includes(sv.id)).map((sv) => sv.name).join(", ") || "None",
                  ],
                  ["Notes", form.customerNotes.trim() || "None"],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="-mt-2 break-words font-semibold text-ink sm:mt-0">{value}</dd>
                </div>
              ))}
            </dl>
            <section aria-label="Price">
              <h3 className="mb-2 text-sm font-semibold text-ink">Price</h3>
              <PriceBreakdown quote={estimate()} estimate />
            </section>
            {config.policies.active && (
              <details className="rounded-2xl border border-line px-4 py-3 text-sm text-ink-soft">
                <summary className="min-h-[44px] cursor-pointer py-2 font-semibold text-ink">Booking policies</summary>
                {config.policies.effectiveDate && <p className="mb-2 text-xs text-ink-muted">Effective {config.policies.effectiveDate}</p>}
                {[
                  ["Cancellation", config.policies.cancellationPolicy],
                  ["Refunds", config.policies.refundPolicy],
                  ["Changes", config.policies.modificationPolicy],
                ]
                  .filter(([, text]) => text)
                  .map(([title, text]) => (
                    <div key={title} className="mt-2">
                      <p className="font-semibold text-ink">{title}</p>
                      <p className="whitespace-pre-line">{text}</p>
                    </div>
                  ))}
              </details>
            )}
            <details className="rounded-2xl border border-line px-4 py-3 text-sm">
              <summary className="min-h-[44px] cursor-pointer py-2 font-semibold text-ink">Venue terms (please read before sending)</summary>
              <VenueTermsList className="mt-2" />
            </details>
            <p className="text-xs leading-relaxed text-ink-muted">
              This sends a booking <strong className="font-semibold text-ink">request</strong>. Your date is not confirmed
              until our team contacts you.
            </p>
            <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => setStep(2)} disabled={submitting} className="btn btn-outline">
                Edit details
              </button>
              <button type="button" onClick={onSubmit} disabled={submitting} aria-busy={submitting || undefined} className="btn btn-primary">
                {submitting ? "Sending…" : "Send booking request"}
              </button>
            </div>
          </>
        )}

        {step === 4 && result && (
          <div role="status" className="space-y-6">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold-pale text-gold">
                <Icon name="check" className="h-6 w-6" />
              </span>
              <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
                We&rsquo;ve received your request for <strong className="font-semibold text-ink">{longDate(result.eventDate)}</strong>,{" "}
                {slotLabel(result.slotId)} slot. It is <strong className="font-semibold text-ink">not confirmed yet</strong>: our
                team will contact you to confirm the booking and the price.
              </p>
            </div>
            <p className="rounded-2xl border border-line bg-surface-low px-5 py-4 text-sm text-ink-soft">
              Your reference: <strong className="font-mono text-base text-ink">{result.reference}</strong>
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={getWhatsAppUrl(`Assalam o Alaikum, I sent a booking request (${result.reference}) for ${result.eventDate}, ${slotLabel(result.slotId)} slot.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                <WhatsAppGlyph className="h-[18px] w-[18px]" />
                Message us on WhatsApp
              </a>
              <button type="button" onClick={reset} className="btn btn-outline">
                Make another request
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
