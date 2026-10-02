"use client";

import { useBooking } from "./BookingContext";

/** Opens the event-inquiry dialog (the form hands the details to WhatsApp). */
export default function BookNowButton({
  children,
  className,
  onOpen,
}: {
  children: React.ReactNode;
  className?: string;
  onOpen?: () => void;
}) {
  const { open } = useBooking();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => {
        onOpen?.();
        open();
      }}
      className={className}
    >
      {children}
    </button>
  );
}
