"use client";

import Image, { getImageProps } from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { business, media } from "@/lib/config";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import BookNowButton from "./BookNowButton";
import Icon, { Stars, WhatsAppGlyph } from "./Icon";

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => null // unknown on the server: render posters only
  );
}

// Art-directed poster: portrait stage frame on phones/tablets, night facade on desktop.
const posterCommon = { alt: "", sizes: "100vw", quality: 75, loading: "eager", fetchPriority: "high" } as const;
const {
  props: { srcSet: desktopPoster },
} = getImageProps({ ...posterCommon, src: media.hero, width: 1024, height: 576 });
const {
  props: { srcSet: mobilePoster, ...posterImg },
} = getImageProps({ ...posterCommon, src: media.heroStagePoster, width: 720, height: 1280 });

export default function Hero() {
  const isDesktop = useMedia("(min-width: 1024px)");
  const reduceMotion = useMedia("(prefers-reduced-motion: reduce)");
  const sectionRef = useRef<HTMLElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const portalVideoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false); // page finished loading → safe to fetch video
  const [bgReady, setBgReady] = useState(false);
  const [paused, setPaused] = useState(false);

  // Defer video downloads until after the page (and its LCP poster) has loaded.
  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (saveData) return;
    const start = () => window.setTimeout(() => setLoaded(true), 250);
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, []);

  // One film per device: full-bleed on phones/tablets, inside the arch portal on desktop.
  const playVideos = loaded && reduceMotion === false && isDesktop !== null;

  // Pause while the hero is off-screen, and respect the visitor's pause choice.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !playVideos) return;
    const videos = () => [bgVideoRef.current, portalVideoRef.current].filter(Boolean) as HTMLVideoElement[];
    const io = new IntersectionObserver(([entry]) => {
      for (const v of videos()) {
        if (entry.isIntersecting && !paused) v.play().catch(() => {});
        else v.pause();
      }
    });
    io.observe(section);
    return () => io.disconnect();
  }, [playVideos, paused, isDesktop]);

  const whatsappUrl = getWhatsAppUrl(
    "Assalam o Alaikum, I am interested in Sadiq Pearl Marquee and would like to ask about booking availability."
  );

  return (
    <section
      ref={sectionRef}
      id="top"
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden bg-espresso text-white lg:h-[100svh] lg:max-h-[1040px] lg:min-h-[720px] lg:justify-center"
    >
      {/* Layer 1 — background film */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 animate-hero-zoom">
        <picture>
          <source media="(min-width: 1024px)" srcSet={desktopPoster} />
          <source srcSet={mobilePoster} />
          {/* Art-directed <picture> via getImageProps (alt="" is in the spread: decorative).
              Desktop: soft focus on the far layer so the sharp portal and text read as nearer planes. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img {...posterImg} className="h-full w-full object-cover lg:scale-105 lg:blur-[3px]" />
        </picture>
        {playVideos && !isDesktop && (
          <video
            ref={bgVideoRef}
            src={media.heroStageVideo}
            muted
            loop
            playsInline
            autoPlay={!paused}
            preload="auto"
            onPlaying={() => setBgReady(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ${
              bgReady ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
      </div>

      {/* Readability: dark from the text side, light over the imagery */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-espresso via-espresso/75 to-espresso/25 lg:bg-gradient-to-r lg:from-espresso/95 lg:via-espresso/80 lg:to-espresso/40"
      />
      {/* Phones: the stage films are bright (white drape, marble), so dim the whole frame a little more. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-espresso/30 lg:hidden" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-espresso/70 to-transparent" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 hidden h-48 bg-gradient-to-t from-espresso/80 to-transparent lg:block" />

      <div className="container-px relative mx-auto grid w-full max-w-content items-center gap-12 pb-10 pt-28 sm:pb-14 grid-cols-1 lg:grid-cols-12 lg:pb-0 lg:pt-20">
        {/* Layer 3 — message */}
        <div className="max-w-2xl lg:col-span-7">
          <p className="eyebrow eyebrow-light animate-fade-up" style={{ animationDelay: "150ms" }}>
            <span>
              Wedding &amp; Event Venue<span className="hidden sm:inline"> · Sarai Alamgir</span>
            </span>
          </p>
          <h1
            id="hero-title"
            className="mt-5 animate-fade-up font-display text-[3.25rem] font-medium leading-[0.95] tracking-[-0.01em] sm:text-7xl lg:text-[5.25rem] xl:text-[6rem]"
            style={{ animationDelay: "250ms" }}
          >
            Sadiq Pearl
            <span className="block italic text-gold-light">Marquee</span>
          </h1>
          <p
            className="mt-6 max-w-xl animate-fade-up font-display text-2xl italic leading-snug text-white/90 sm:text-[1.75rem]"
            style={{ animationDelay: "380ms" }}
          >
            {business.tagline}.
          </p>
          <p
            className="mt-4 max-w-lg animate-fade-up text-[0.9375rem] leading-relaxed text-white/75 sm:text-base"
            style={{ animationDelay: "480ms" }}
          >
            Weddings, mehndi, barat, walima and family celebrations in Kakrot, Sarai Alamgir — with in-house
            catering, table service and free parking.
          </p>

          <div
            className="mt-8 flex animate-fade-up flex-col gap-3 sm:flex-row"
            style={{ animationDelay: "580ms" }}
          >
            <BookNowButton className="btn btn-accent sm:min-w-[210px]">
              Book Your Event
              <Icon name="arrow" className="h-4 w-4" />
            </BookNowButton>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline-light">
              <WhatsAppGlyph className="h-[18px] w-[18px]" />
              WhatsApp Us
            </a>
          </div>

          <ul
            className="mt-8 flex animate-fade-up flex-wrap items-center gap-x-6 gap-y-3 text-[0.8125rem] text-white/75"
            style={{ animationDelay: "680ms" }}
          >
            <li className="flex items-center gap-2">
              <Stars value={business.rating} className="h-3.5 w-3.5" />
              <span>
                <strong className="font-semibold text-white">{business.rating}</strong> · {business.reviewCount} Google
                reviews
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Icon name="parking" className="h-4 w-4 text-gold-light" />
              Free parking
            </li>
            <li className="flex items-center gap-2">
              <Icon name="dining" className="h-4 w-4 text-gold-light" />
              Table service
            </li>
          </ul>
        </div>

        {/* Layer 2 — arch portal with the stage film (desktop) */}
        <div className="relative hidden lg:col-span-5 lg:block">
          <div data-parallax="0.06" className="relative mx-auto w-[min(100%,360px)] xl:w-[380px]">
            <div
              data-tilt
              className="relative aspect-[9/14] animate-fade-in overflow-hidden rounded-t-[999px] rounded-b-2xl bg-espresso-800 shadow-frame ring-1 ring-gold-light/40"
              style={{ animationDelay: "400ms" }}
            >
              <Image
                src={media.heroStagePoster}
                alt="Stage set with a red and white rose frame and gold sofas at Sadiq Pearl Marquee"
                fill
                sizes="380px"
                className="object-cover"
              />
              {playVideos && isDesktop && (
                <video
                  ref={portalVideoRef}
                  src={media.heroStageVideo}
                  muted
                  loop
                  playsInline
                  autoPlay={!paused}
                  preload="auto"
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div aria-hidden="true" className="absolute inset-0 rounded-t-[999px] ring-1 ring-inset ring-white/15" />
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-espresso/70 to-transparent" />
            </div>
            {/* Offset outline frame for depth */}
            <div
              aria-hidden="true"
              className="absolute -inset-3 -z-10 rounded-t-[999px] rounded-b-3xl border border-gold-light/25"
            />
            <div
              data-parallax="0.14"
              className="absolute -left-10 bottom-10 w-60 rounded-2xl border border-white/15 bg-espresso/70 p-4 shadow-frame backdrop-blur-md"
            >
              <p className="text-eyebrow font-semibold uppercase text-gold-light">Filmed at the venue</p>
              <p className="mt-1.5 font-display text-lg leading-snug text-white">Stage décor, set for the celebration</p>
            </div>
          </div>
        </div>
      </div>

      {playVideos && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          aria-label={paused ? "Play background video" : "Pause background video"}
          className="absolute right-4 top-[84px] z-10 grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-espresso/40 text-white/85 backdrop-blur-md transition-colors hover:bg-espresso/70 sm:right-8 lg:bottom-8 lg:top-auto"
        >
          <Icon name={paused ? "play" : "pause"} className="h-4 w-4" />
        </button>
      )}

      <a
        href="#about"
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.3em] text-white/60 transition-colors hover:text-white [@media(min-width:1024px)_and_(min-height:820px)]:flex"
      >
        Discover
        <span aria-hidden="true" className="h-10 w-px bg-gradient-to-b from-white/70 to-transparent" />
      </a>
    </section>
  );
}
