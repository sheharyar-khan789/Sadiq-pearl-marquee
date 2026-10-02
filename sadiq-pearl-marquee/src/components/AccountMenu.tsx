"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";
import { endSession } from "./SignOutButton";

const firstName = (name: string | null, email: string | null) =>
  name?.trim().split(/\s+/)[0] || email?.split("@")[0] || "Account";

/** Signed-in customer menu in the desktop navbar: My Account, My Bookings, Logout. */
export default function AccountMenu({
  name,
  email,
  solid,
  onSignedOut,
}: {
  name: string | null;
  email: string | null;
  solid: boolean;
  onSignedOut: () => void;
}) {
  const router = useRouter();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onLogout = async () => {
    setBusy(true);
    await endSession();
    setOpen(false);
    setBusy(false);
    onSignedOut();
    router.refresh();
  };

  const item = "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-soft hover:bg-surface-low hover:text-ink";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-11 max-w-[11rem] items-center gap-2 rounded-full border pl-3 pr-3.5 text-[0.8125rem] font-semibold transition-colors ${
          solid ? "border-line-strong/60 text-ink hover:border-ink/60" : "border-white/35 text-white hover:border-white/70 hover:bg-white/10"
        }`}
      >
        <Icon name="user" className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">{firstName(name, email)}</span>
        <Icon name="down" className="h-4 w-4 shrink-0" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] w-60 animate-fade-in rounded-2xl border border-line bg-surface p-2 text-ink shadow-lift"
        >
          {email && <p className="truncate px-3 pb-2 pt-1 text-xs text-ink-muted">{email}</p>}
          <Link role="menuitem" href="/account" onClick={() => setOpen(false)} className={item}>
            <Icon name="user" className="h-4 w-4 text-gold" />
            My Account
          </Link>
          <Link role="menuitem" href="/account/bookings" onClick={() => setOpen(false)} className={item}>
            <Icon name="calendar" className="h-4 w-4 text-gold" />
            My Bookings
          </Link>
          <button role="menuitem" type="button" onClick={onLogout} disabled={busy} className={item}>
            <Icon name="logout" className="h-4 w-4 text-gold" />
            {busy ? "Signing out…" : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
}
