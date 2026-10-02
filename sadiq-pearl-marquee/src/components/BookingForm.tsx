"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { business, guestOptions, sessionOptions } from "@/lib/config";
import { buildWhatsAppUrl, WHATSAPP_DISPLAY_NUMBER, type BookingDetails } from "@/lib/whatsapp";
import { useBooking } from "./BookingContext";
import { usePublicEventTypes } from "./usePublicEventTypes";
import Icon, { WhatsAppGlyph } from "./Icon";

type Errors = Partial<Record<"name" | "phone" | "eventType" | "date" | "guests" | "message", string>>;

interface FormState {
  name: string;
  phone: string;
  eventType: string;
  date: string;
  session: string;
  guests: string;
  message: string;
}

const inputClass =
  "block h-12 w-full rounded-xl border border-line-strong/50 bg-surface px-4 text-[0.9375rem] text-ink placeholder:text-ink-muted/70 transition-colors focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40";
const errorInput = "border-red-600 focus:border-red-600 focus:ring-red-600/20";
const labelClass = "mb-1.5 block text-[0.8125rem] font-semibold text-ink";

const todayString = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const noopSubscribe = () => () => {};

/** Event inquiry form. Nothing is stored: submitting opens WhatsApp with the details. */
export default function BookingForm() {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const { openTerms } = useBooking();
  // Active event types from the stored business configuration (same list as bookings).
  const eventTypes = usePublicEventTypes();
  const freeText = eventTypes.status === "error" || (eventTypes.status === "ready" && eventTypes.eventTypes.length === 0);
  const [formData, setFormData] = useState<FormState>({
    name: "",
    phone: "",
    eventType: "",
    date: "",
    session: "Dinner",
    guests: "",
    message: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [sentDetails, setSentDetails] = useState<BookingDetails | null>(null);

  // Client-only "today" (undefined during server render) avoids a stale baked-in date.
  const minDate = useSyncExternalStore(noopSubscribe, todayString, () => undefined);

  const handleChange =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setFormData((prev) => ({ ...prev, [key]: value }));
      if (errors[key as keyof Errors]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  const validate = (): boolean => {
    const next: Errors = {};
    if (formData.name.trim().length < 2) next.name = "Please enter your full name (minimum 2 characters).";
    if (formData.phone.replace(/\D/g, "").length < 10)
      next.phone = "Please enter a valid phone number with at least 10 digits.";
    if (!formData.eventType.trim()) next.eventType = freeText ? "Please enter your event type." : "Please choose an event type.";
    if (!formData.date) next.date = "Please select your preferred date.";
    else if (formData.date < todayString()) next.date = "Preferred date cannot be in the past.";
    if (!formData.guests) next.guests = "Please select an estimated guest count.";
    if (formData.message.length > 500) next.message = "Message must be under 500 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const details: BookingDetails = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      eventType: formData.eventType,
      date: formData.date,
      session: formData.session,
      guests: formData.guests,
      message: formData.message.trim(),
    };
    setSentDetails(details);
    window.open(buildWhatsAppUrl(details), "_blank", "noopener,noreferrer");
  };

  const fieldError = (key: keyof Errors) =>
    errors[key] ? (
      <p id={id(`${key}-error`)} role="alert" className="mt-1.5 text-xs font-medium text-red-700">
        {errors[key]}
      </p>
    ) : null;
  const describedBy = (key: keyof Errors) => (errors[key] ? id(`${key}-error`) : undefined);

  if (sentDetails) {
    const rows: [string, string][] = [
      ["Name", sentDetails.name],
      ["Phone / WhatsApp", sentDetails.phone],
      ["Event", sentDetails.eventType],
      ["Preferred date", sentDetails.date],
      ["Session", sentDetails.session || "Dinner"],
      ["Guests", sentDetails.guests],
      ["Notes", sentDetails.message || "None"],
    ];
    return (
      <div role="status" className="space-y-6">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold-pale text-gold">
            <Icon name="check" className="h-6 w-6" />
          </span>
          <div>
            <h3 className="font-display text-[1.75rem] leading-tight text-ink">Your inquiry is ready</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              WhatsApp should have opened with your details for {WHATSAPP_DISPLAY_NUMBER}.{" "}
              <strong className="font-semibold text-ink">Press Send in WhatsApp</strong> to reach management. If it
              didn&rsquo;t open, use the button below.
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl border border-line bg-surface-low p-5 text-sm">
          {rows.map(([label, val]) => (
            <div key={label} className="contents">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="font-semibold text-ink">{val}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs leading-relaxed text-ink-muted">
          Sending this inquiry does not confirm a booking. Dates are confirmed only by venue management.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a href={buildWhatsAppUrl(sentDetails)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            <WhatsAppGlyph className="h-[18px] w-[18px]" />
            Open WhatsApp
          </a>
          <a href={business.phoneHref} className="btn btn-outline">
            <Icon name="phone" className="h-4 w-4 text-gold" />
            Call {business.phoneDisplay}
          </a>
          <button
            type="button"
            onClick={() => setSentDetails(null)}
            className="min-h-[44px] px-2 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            Edit details
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div>
        <label htmlFor={id("name")} className={labelClass}>
          Full name <span className="text-gold">*</span>
        </label>
        <input
          id={id("name")}
          name="name"
          type="text"
          autoComplete="name"
          required
          value={formData.name}
          onChange={handleChange("name")}
          placeholder="e.g. Muhammad Ali"
          aria-invalid={!!errors.name}
          aria-describedby={describedBy("name")}
          className={`${inputClass} ${errors.name ? errorInput : ""}`}
        />
        {fieldError("name")}
      </div>

      <div>
        <label htmlFor={id("phone")} className={labelClass}>
          Phone / WhatsApp <span className="text-gold">*</span>
        </label>
        <input
          id={id("phone")}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={formData.phone}
          onChange={handleChange("phone")}
          placeholder="03XX XXXXXXX"
          aria-invalid={!!errors.phone}
          aria-describedby={describedBy("phone")}
          className={`${inputClass} ${errors.phone ? errorInput : ""}`}
        />
        {fieldError("phone")}
      </div>

      <div>
        <label htmlFor={id("event")} className={labelClass}>
          Event type <span className="text-gold">*</span>
        </label>
        {freeText ? (
          <>
            <input
              id={id("event")}
              name="eventType"
              required
              maxLength={60}
              value={formData.eventType}
              onChange={handleChange("eventType")}
              aria-invalid={!!errors.eventType}
              aria-describedby={`${id("event-note")} ${describedBy("eventType") ?? ""}`.trim()}
              className={`${inputClass} ${errors.eventType ? errorInput : ""}`}
            />
            <p id={id("event-note")} className="mt-1 text-xs text-ink-muted">
              {eventTypes.status === "error"
                ? "The list of event types couldn't be loaded. Please type your event."
                : "Please type your event."}
            </p>
          </>
        ) : (
          <select
            id={id("event")}
            name="eventType"
            required
            disabled={eventTypes.status === "loading"}
            aria-busy={eventTypes.status === "loading" || undefined}
            value={formData.eventType}
            onChange={handleChange("eventType")}
            aria-invalid={!!errors.eventType}
            aria-describedby={describedBy("eventType")}
            className={`${inputClass} ${errors.eventType ? errorInput : ""}`}
          >
            <option value="">{eventTypes.status === "loading" ? "Loading event types…" : "Select event type…"}</option>
            {eventTypes.status === "ready" &&
              eventTypes.eventTypes.map((opt) => (
                <option key={opt.id} value={opt.name}>
                  {opt.name}
                </option>
              ))}
          </select>
        )}
        {fieldError("eventType")}
      </div>

      <div>
        <label htmlFor={id("date")} className={labelClass}>
          Preferred date <span className="text-gold">*</span>
        </label>
        <input
          id={id("date")}
          name="date"
          type="date"
          min={minDate}
          required
          value={formData.date}
          onChange={handleChange("date")}
          aria-invalid={!!errors.date}
          aria-describedby={describedBy("date")}
          className={`${inputClass} ${errors.date ? errorInput : ""}`}
        />
        {fieldError("date")}
      </div>

      <fieldset>
        <legend className={labelClass}>Preferred session</legend>
        <div className="grid grid-cols-2 gap-2">
          {sessionOptions.map((session) => {
            const checked = formData.session === session;
            return (
              <label
                key={session}
                className={`flex h-12 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold-container ${
                  checked
                    ? "border-espresso bg-espresso text-surface"
                    : "border-line-strong/50 bg-surface text-ink-soft hover:border-ink/50"
                }`}
              >
                <input
                  type="radio"
                  name={`${uid}-session`}
                  value={session}
                  checked={checked}
                  onChange={handleChange("session")}
                  className="sr-only"
                />
                {session}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor={id("guests")} className={labelClass}>
          Expected guests <span className="text-gold">*</span>
        </label>
        <select
          id={id("guests")}
          name="guests"
          required
          value={formData.guests}
          onChange={handleChange("guests")}
          aria-invalid={!!errors.guests}
          aria-describedby={describedBy("guests")}
          className={`${inputClass} ${errors.guests ? errorInput : ""}`}
        >
          <option value="">Select guest count…</option>
          {guestOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {fieldError("guests")}
      </div>

      <div className="sm:col-span-2">
        <label htmlFor={id("message")} className={labelClass}>
          Message &amp; special requirements <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <textarea
          id={id("message")}
          name="message"
          rows={3}
          maxLength={500}
          value={formData.message}
          onChange={handleChange("message")}
          placeholder="Menu preferences, décor requirements, or questions for management…"
          aria-invalid={!!errors.message}
          aria-describedby={describedBy("message")}
          className={`${inputClass} h-auto py-3 ${errors.message ? errorInput : ""}`}
        />
        {fieldError("message")}
      </div>

      <div className="sm:col-span-2">
        <button type="submit" className="btn btn-primary w-full sm:w-auto sm:px-8">
          <WhatsAppGlyph className="h-[18px] w-[18px]" />
          Send inquiry via WhatsApp
        </button>
        <p className="mt-4 text-xs leading-relaxed text-ink-muted">
          Opens WhatsApp with your details for <strong className="font-semibold text-ink">{WHATSAPP_DISPLAY_NUMBER}</strong>.
          Nothing is booked until confirmed by venue management.{" "}
          <button
            type="button"
            onClick={openTerms}
            aria-haspopup="dialog"
            className="font-semibold text-gold underline underline-offset-2 hover:text-ink"
          >
            Booking terms
          </button>
        </p>
      </div>
    </form>
  );
}
