"use client";

import { useBooking } from "./BookingContext";

export default function BookNowButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { open } = useBooking();
  return (
    <button type="button" onClick={open} className={className}>
      {children}
    </button>
  );
}
