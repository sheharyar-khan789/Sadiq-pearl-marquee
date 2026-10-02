"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Public-site overlay state. Booking itself is a page (/book), not a modal, so
// this only holds the Terms & Conditions sheet.
interface SiteContextValue {
  termsOpen: boolean; // terms & conditions sheet
  openTerms: () => void;
  closeTerms: () => void;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [termsOpen, setTermsOpen] = useState(false);

  const openTerms = useCallback(() => setTermsOpen(true), []);
  const closeTerms = useCallback(() => setTermsOpen(false), []);

  const value = useMemo(() => ({ termsOpen, openTerms, closeTerms }), [termsOpen, openTerms, closeTerms]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useBooking() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useBooking must be used within a BookingProvider");
  return ctx;
}
