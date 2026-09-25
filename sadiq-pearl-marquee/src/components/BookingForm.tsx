"use client";

import { useEffect, useState } from "react";
import { business, eventTypeOptions, guestOptions, sessionOptions } from "@/lib/config";
import { buildWhatsAppUrl, type BookingDetails } from "@/lib/whatsapp";
import { useBooking } from "./BookingContext";
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
  "w-full h-12 px-4 rounded-xl border border-line bg-surface text-ink text-sm placeholder:text-ink-muted/70 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors";

const todayString = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export default function BookingForm() {
  const { openTerms } = useBooking();
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

  // Set minDate dynamically to avoid stale hydration bakes
  const [minDate, setMinDate] = useState<string | undefined>(undefined);
  useEffect(() => {
    setMinDate(todayString());
  }, []);

  const handleChange = (
    key: keyof FormState
  ) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Clear inline error on change
    if (errors[key as keyof Errors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Errors = {};
    const trimmedName = formData.name.trim();
    const cleanPhone = formData.phone.replace(/\D/g, "");

    if (trimmedName.length < 2) {
      newErrors.name = "Please enter your full name (minimum 2 characters).";
    }

    if (cleanPhone.length < 10) {
      newErrors.phone = "Please enter a valid phone number with at least 10 digits.";
    }

    if (!formData.eventType) {
      newErrors.eventType = "Please choose an event type.";
    }

    if (!formData.date) {
      newErrors.date = "Please select your preferred date.";
    } else if (formData.date < todayString()) {
      newErrors.date = "Preferred date cannot be in the past.";
    }

    if (!formData.guests) {
      newErrors.guests = "Please select an estimated guest count.";
    }

    if (formData.message && formData.message.length > 500) {
      newErrors.message = "Message must be under 500 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
    const whatsappLink = buildWhatsAppUrl(details);

    try {
      window.open(whatsappLink, "_blank", "noopener,noreferrer");
    } catch {
      // Graceful fallback: window.location
      window.location.href = whatsappLink;
    }
  };

  // SUCCESS / CONFIRMATION STATE
  if (sentDetails) {
    const summaryRows: [string, string][] = [
      ["Full Name", sentDetails.name],
      ["Phone / WhatsApp", sentDetails.phone],
      ["Event Type", sentDetails.eventType],
      ["Preferred Date", sentDetails.date],
      ["Session", sentDetails.session || "Dinner"],
      ["Expected Guests", sentDetails.guests],
      ["Special Notes", sentDetails.message || "None"],
    ];

    const retryUrl = buildWhatsAppUrl(sentDetails);

    return (
      <div role="status" className="text-left space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gold/15 text-gold grid place-items-center shrink-0">
            <Icon name="check" className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display text-xl sm:text-2xl text-ink font-semibold">
              Inquiry Prepared for WhatsApp
            </h3>
            <p className="text-xs text-ink-muted">
              Redirecting to 0345 5673921
            </p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-ink-soft">
          We opened WhatsApp with your event details pre-filled.{" "}
          <strong className="text-ink font-semibold">
            Press &ldquo;Send&rdquo; inside WhatsApp to reach our management.
          </strong>{" "}
          Please note that submitting this form does not confirm a booking; dates are confirmed only after venue review.
        </p>

        {/* Inquiry Summary Review Box */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-xs sm:text-sm border border-line/70 rounded-xl p-5 bg-surface-low">
          {summaryRows.map(([label, val]) => (
            <div key={label} className="contents">
              <dt className="text-ink-muted font-medium">{label}</dt>
              <dd className="text-ink font-semibold">{val}</dd>
            </div>
          ))}
        </dl>

        {/* Post-submit Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <a
            href={retryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-container text-white font-semibold text-xs sm:text-sm h-11 px-5 rounded-xl transition-all shadow-sm"
          >
            <WhatsAppGlyph className="w-4 h-4 fill-current" />
            <span>Open WhatsApp Again</span>
          </a>
          <a
            href={business.phoneHref}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-line hover:border-gold text-ink font-semibold text-xs sm:text-sm transition-colors bg-surface"
          >
            <Icon name="phone" className="w-4 h-4 text-gold" />
            <span>Call {business.phoneDisplay}</span>
          </a>
          <button
            type="button"
            onClick={() => setSentDetails(null)}
            className="h-11 px-4 text-xs font-semibold text-ink-soft hover:text-gold transition-colors text-center"
          >
            Edit details
          </button>
        </div>
      </div>
    );
  }

  // ACTIVE INQUIRY FORM
  return (
    <form onSubmit={handleSubmit} noValidate className="grid sm:grid-cols-2 gap-4 sm:gap-5">
      {/* Name */}
      <div>
        <label htmlFor="inquiry-name" className="block text-xs sm:text-sm font-semibold text-ink mb-1.5">
          Full Name <span className="text-gold">*</span>
        </label>
        <input
          id="inquiry-name"
          name="name"
          type="text"
          required
          autoComplete="name"
          value={formData.name}
          onChange={handleChange("name")}
          placeholder="e.g. Muhammad Ali"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
          className={`${inputClass} ${errors.name ? "border-red-500 focus:ring-red-400" : ""}`}
        />
        {errors.name && (
          <p id="name-error" role="alert" className="mt-1 text-xs text-red-600 font-medium">
            {errors.name}
          </p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="inquiry-phone" className="block text-xs sm:text-sm font-semibold text-ink mb-1.5">
          Phone / WhatsApp Number <span className="text-gold">*</span>
        </label>
        <input
          id="inquiry-phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          value={formData.phone}
          onChange={handleChange("phone")}
          placeholder="03XX XXXXXXX"
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? "phone-error" : undefined}
          className={`${inputClass} ${errors.phone ? "border-red-500 focus:ring-red-400" : ""}`}
        />
        {errors.phone && (
          <p id="phone-error" role="alert" className="mt-1 text-xs text-red-600 font-medium">
            {errors.phone}
          </p>
        )}
      </div>

      {/* Event Type */}
      <div>
        <label htmlFor="inquiry-event" className="block text-xs sm:text-sm font-semibold text-ink mb-1.5">
          Event Type <span className="text-gold">*</span>
        </label>
        <select
          id="inquiry-event"
          name="eventType"
          required
          value={formData.eventType}
          onChange={handleChange("eventType")}
          aria-invalid={!!errors.eventType}
          aria-describedby={errors.eventType ? "event-error" : undefined}
          className={`${inputClass} ${errors.eventType ? "border-red-500 focus:ring-red-400" : ""}`}
        >
          <option value="">Select event type…</option>
          {eventTypeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {errors.eventType && (
          <p id="event-error" role="alert" className="mt-1 text-xs text-red-600 font-medium">
            {errors.eventType}
          </p>
        )}
      </div>

      {/* Preferred Date */}
      <div>
        <label htmlFor="inquiry-date" className="block text-xs sm:text-sm font-semibold text-ink mb-1.5">
          Preferred Date <span className="text-gold">*</span>
        </label>
        <input
          id="inquiry-date"
          name="date"
          type="date"
          min={minDate}
          required
          value={formData.date}
          onChange={handleChange("date")}
          aria-invalid={!!errors.date}
          aria-describedby={errors.date ? "date-error" : undefined}
          className={`${inputClass} ${errors.date ? "border-red-500 focus:ring-red-400" : ""}`}
        />
        {errors.date && (
          <p id="date-error" role="alert" className="mt-1 text-xs text-red-600 font-medium">
            {errors.date}
          </p>
        )}
      </div>

      {/* Session (Lunch / Dinner) */}
      <fieldset>
        <legend className="block text-xs sm:text-sm font-semibold text-ink mb-1.5">
          Preferred Session
        </legend>
        <div className="grid grid-cols-2 gap-2.5">
          {sessionOptions.map((session) => (
            <label
              key={session}
              className={`h-12 grid place-items-center rounded-xl border cursor-pointer text-xs sm:text-sm font-semibold transition-all ${
                formData.session === session
                  ? "bg-gold text-white border-gold shadow-sm"
                  : "bg-surface border-line text-ink-soft hover:border-gold hover:text-gold"
              }`}
            >
              <input
                type="radio"
                name="session"
                value={session}
                checked={formData.session === session}
                onChange={handleChange("session")}
                className="sr-only"
              />
              <span>{session}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Expected Guests */}
      <div>
        <label htmlFor="inquiry-guests" className="block text-xs sm:text-sm font-semibold text-ink mb-1.5">
          Expected Guests <span className="text-gold">*</span>
        </label>
        <select
          id="inquiry-guests"
          name="guests"
          required
          value={formData.guests}
          onChange={handleChange("guests")}
          aria-invalid={!!errors.guests}
          aria-describedby={errors.guests ? "guests-error" : undefined}
          className={`${inputClass} ${errors.guests ? "border-red-500 focus:ring-red-400" : ""}`}
        >
          <option value="">Select guest count bracket…</option>
          {guestOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {errors.guests && (
          <p id="guests-error" role="alert" className="mt-1 text-xs text-red-600 font-medium">
            {errors.guests}
          </p>
        )}
      </div>

      {/* Message / Special Requests */}
      <div className="sm:col-span-2">
        <label htmlFor="inquiry-message" className="block text-xs sm:text-sm font-semibold text-ink mb-1.5">
          Message &amp; Special Requirements (Optional)
        </label>
        <textarea
          id="inquiry-message"
          name="message"
          rows={3}
          maxLength={500}
          value={formData.message}
          onChange={handleChange("message")}
          placeholder="Mention menu preferences, decor requirements, or questions for management…"
          className="w-full p-4 rounded-xl border border-line bg-surface text-ink text-sm placeholder:text-ink-muted/70 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
        />
      </div>

      {/* Submit Button & Disclaimer */}
      <div className="sm:col-span-2 pt-2">
        <button
          type="submit"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-gold hover:bg-gold-container text-white font-semibold text-xs sm:text-sm h-12 px-8 rounded-xl transition-all shadow-sm active:scale-95"
        >
          <WhatsAppGlyph className="w-4 h-4 fill-current" />
          <span>Send Inquiry via WhatsApp</span>
        </button>

        <p className="mt-3 text-xs text-ink-muted leading-relaxed">
          Submitting opens WhatsApp with your inquiry pre-filled to{" "}
          <strong className="text-ink font-semibold">0345 5673921</strong>. Nothing is booked until confirmed by venue management.{" "}
          <button
            type="button"
            onClick={openTerms}
            className="text-gold underline hover:text-gold-container transition-colors"
          >
            Review booking terms &amp; conditions
          </button>
        </p>
      </div>
    </form>
  );
}
