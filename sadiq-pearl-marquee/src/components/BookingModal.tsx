"use client";

import Link from "next/link";
import { useRef } from "react";
import { useBooking } from "./BookingContext";
import BookingForm from "./BookingForm";
import Icon from "./Icon";
import { useDialog } from "./useDialog";

/** "Book Your Event" dialog: bottom sheet on phones, centred dialog on larger screens. */
export default function BookingModal() {
  const { isOpen, close } = useBooking();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useDialog(isOpen, close, panelRef);
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-title"
    >
      <div className="absolute inset-0 animate-fade-in bg-espresso/70 backdrop-blur-sm" onClick={close} />
      <div
        ref={panelRef}
        className="relative max-h-[92svh] w-full animate-fade-up overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-frame sm:max-w-2xl sm:rounded-3xl sm:p-10"
      >
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Book Your Event</p>
            <h2 id="booking-title" className="mt-3 font-display text-[2.25rem] leading-none text-ink">
              Ask about your date
            </h2>
            <p className="mt-3 text-sm text-ink-soft">
              Your details open in WhatsApp for venue management to confirm availability. Or{" "}
              <Link href="/book" onClick={close} className="font-semibold text-gold underline underline-offset-2">
                check free dates and request online
              </Link>
              .
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line-strong/50 text-ink hover:bg-surface-mid"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <BookingForm />
      </div>
    </div>
  );
}
