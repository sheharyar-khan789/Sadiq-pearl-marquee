"use client";

import { useBooking } from "./BookingContext";
import BookingForm from "./BookingForm";
import Icon from "./Icon";
import { useDialog } from "./useDialog";

export default function BookingModal() {
  const { isOpen, close } = useBooking();
  const closeRef = useDialog(isOpen, close);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="booking-title">
      <div className="absolute inset-0 bg-night/60" onClick={close} />
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-surface rounded-t-2xl sm:rounded-xl shadow-2xl p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold mb-1">Reservation inquiry</p>
            <h2 id="booking-title" className="font-display text-3xl text-ink">Book your celebration</h2>
          </div>
          <button ref={closeRef} type="button" onClick={close} aria-label="Close" className="w-10 h-10 grid place-items-center rounded hover:bg-surface-mid shrink-0"><Icon name="close" /></button>
        </div>
        <BookingForm />
      </div>
    </div>
  );
}
