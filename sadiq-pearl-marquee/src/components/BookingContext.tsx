"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface SiteContextValue {
  isOpen: boolean; // booking modal
  open: () => void;
  close: () => void;
  termsOpen: boolean; // terms & conditions sheet
  openTerms: () => void;
  closeTerms: () => void;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const openTerms = useCallback(() => setTermsOpen(true), []);
  const closeTerms = useCallback(() => setTermsOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, open, close, termsOpen, openTerms, closeTerms }),
    [isOpen, open, close, termsOpen, openTerms, closeTerms]
  );
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useBooking() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useBooking must be used within a BookingProvider");
  return ctx;
}
