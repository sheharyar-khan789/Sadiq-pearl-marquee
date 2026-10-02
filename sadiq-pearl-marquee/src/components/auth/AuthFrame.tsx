import Image from "next/image";
import Link from "next/link";
import { business } from "@/lib/config";
import Icon from "../Icon";

/** Shared chrome for sign-in, sign-up and account pages (brand + back link). */
export function AuthTopBar() {
  return (
    <header className="container-px flex h-[68px] items-center justify-between">
      <Link href="/" className="leading-none" aria-label={`${business.name}, home`}>
        <span className="block font-display text-[1.375rem] font-semibold text-ink">Sadiq Pearl</span>
        <span className="mt-1 block text-[0.625rem] font-semibold uppercase tracking-[0.34em] text-gold">Marquee</span>
      </Link>
      <Link href="/" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink">
        <Icon name="prev" className="h-4 w-4" />
        Back to website
      </Link>
    </header>
  );
}

/** Split-screen frame: venue photography (desktop) beside the form panel. */
export default function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh bg-surface lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-espresso lg:block" aria-hidden="true">
        <Image src="/images/gallery/royal-stage.jpg" alt="" fill sizes="50vw" className="object-cover opacity-75" />
        <div className="absolute inset-0 bg-gradient-to-t from-espresso via-espresso/40 to-espresso/10" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white xl:p-16">
          <p className="eyebrow eyebrow-light">Sadiq Pearl Marquee</p>
          <p className="mt-5 max-w-md font-display text-4xl italic leading-tight xl:text-5xl">{business.tagline}.</p>
          <p className="mt-4 text-sm text-white/65">{business.fullAddress}</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <AuthTopBar />
        <main id="main" className="flex flex-1 items-center justify-center px-5 pb-12 pt-6 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function AuthHeading({ eyebrow, title, intro }: { eyebrow: string; title: React.ReactNode; intro?: string }) {
  return (
    <div className="mb-8">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-4 font-display text-[2.5rem] font-medium leading-[1.05] text-ink sm:text-5xl">{title}</h1>
      {intro && <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">{intro}</p>}
    </div>
  );
}
