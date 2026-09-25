"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { business, media } from "@/lib/config";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import Icon, { Stars, WhatsAppGlyph } from "./Icon";

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [parallaxY, setParallaxY] = useState(0);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(motionQuery.matches);

    const onMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    motionQuery.addEventListener("change", onMotionChange);

    // If reduced motion is not preferred, initialize video & scroll parallax
    if (!motionQuery.matches) {
      const vid = videoRef.current;
      if (vid) {
        vid.play().catch(() => {
          // Autoplay blocked by browser policy — poster image remains fallback
          setVideoReady(false);
        });
      }

      // Parallax scroll effect for desktop
      let ticking = false;
      const handleScroll = () => {
        if (!ticking) {
          window.requestAnimationFrame(() => {
            if (window.innerWidth >= 1024) {
              const scrollY = window.scrollY;
              // Subtle, bounded parallax shift (max 24px)
              const offset = Math.min(scrollY * 0.05, 24);
              setParallaxY(-offset);
            } else {
              setParallaxY(0);
            }
            ticking = false;
          });
          ticking = true;
        }
      };

      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        motionQuery.removeEventListener("change", onMotionChange);
        window.removeEventListener("scroll", handleScroll);
      };
    }

    return () => {
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, []);

  const whatsappInquiryUrl = getWhatsAppUrl(
    "Assalam o Alaikum, I am interested in Sadiq Pearl Marquee and would like to ask about booking availability."
  );

  return (
    <section
      id="home"
      className="relative pt-20 sm:pt-24 lg:pt-28 pb-12 sm:pb-16 lg:pb-24 overflow-hidden bg-gradient-to-b from-surface via-surface-low to-surface"
    >
      {/* Subtle atmospheric ambient glow */}
      <div
        className="absolute top-0 right-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-content mx-auto container-px">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 xl:gap-16 items-center">
          {/* Left Column: Premium Positioning & Content */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            {/* Eyebrow badge */}
            <div className={`${prefersReducedMotion ? "" : "animate-fade-in-up"}`}>
              <span className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1 rounded-full bg-gold/10 border border-gold/25 text-gold text-[11px] sm:text-xs font-semibold uppercase tracking-[0.12em] sm:tracking-[0.16em] mb-4 sm:mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0 animate-pulse" />
                <span>Premium Wedding &amp; Event Venue · Sarai Alamgir</span>
              </span>
            </div>

            {/* Main Headline */}
            <h1
              className={`font-display text-3xl sm:text-4xl md:text-5xl lg:text-[56px] xl:text-[62px] leading-[1.12] sm:leading-[1.1] text-ink tracking-tight font-medium break-words ${
                prefersReducedMotion ? "" : "animate-fade-in-up delay-100"
              }`}
            >
              Sadiq Pearl Marquee
            </h1>

            {/* Tagline / Subheading */}
            <p
              className={`font-display italic text-xl sm:text-2xl text-gold-container mt-3 sm:mt-4 ${
                prefersReducedMotion ? "" : "animate-fade-in-up delay-200"
              }`}
            >
              {business.tagline}
            </p>

            {/* Verified Venue Positioning Copy */}
            <p
              className={`mt-4 sm:mt-5 text-base sm:text-lg leading-relaxed text-ink-soft max-w-xl ${
                prefersReducedMotion ? "" : "animate-fade-in-up delay-200"
              }`}
            >
              Situated on Rashidpur–Orangabad Road in Kakrot, Sarai Alamgir. An
              exquisite venue crafted for weddings, mehndi, barat, walima, and
              unforgettable family celebrations, offering gracious table service
              dining and dedicated parking.
            </p>

            {/* Trust and Feature Badges */}
            <div
              className={`mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs sm:text-sm text-ink-soft ${
                prefersReducedMotion ? "" : "animate-fade-in-up delay-300"
              }`}
            >
              <div className="inline-flex items-center gap-2 bg-surface border border-line/60 rounded-full px-3 py-1">
                <Stars value={business.rating} className="w-4 h-4 text-gold" />
                <span>
                  <strong className="text-ink font-semibold">{business.rating}</strong> / 5
                  · {business.reviewCount} Google reviews
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <Icon name="parking" className="w-4 h-4 text-gold" />
                <span>Free parking</span>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <Icon name="dining" className="w-4 h-4 text-gold" />
                <span>Table service</span>
              </div>
            </div>

            {/* Action Buttons: Primary & Secondary CTAs */}
            <div
              className={`mt-8 sm:mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 ${
                prefersReducedMotion ? "" : "animate-fade-in-up delay-400"
              }`}
            >
              {/* Primary CTA: INQUIRE ON WHATSAPP */}
              <a
                href={whatsappInquiryUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Inquire on WhatsApp: 0345 5673921"
                className="inline-flex items-center justify-center gap-2.5 bg-gold hover:bg-gold-container text-white font-semibold text-sm sm:text-base h-12 sm:h-13 px-7 rounded shadow-md hover:shadow-lg transition-all active:scale-[0.99]"
              >
                <WhatsAppGlyph className="w-5 h-5 fill-current" />
                <span>INQUIRE ON WHATSAPP</span>
              </a>

              {/* Secondary CTA: EXPLORE VENUE */}
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 h-12 sm:h-13 px-7 rounded border border-gold/70 text-gold hover:bg-gold hover:text-white font-semibold text-sm sm:text-base transition-colors"
              >
                <span>EXPLORE VENUE</span>
                <Icon name="down" className="w-4 h-4" />
              </a>
            </div>

            {/* Microcopy confirming direct number */}
            <p
              className={`mt-3.5 text-xs text-ink-muted ${
                prefersReducedMotion ? "" : "animate-fade-in-up delay-500"
              }`}
            >
              Direct contact with venue management on WhatsApp ·{" "}
              <a
                href={whatsappInquiryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold font-medium hover:underline"
              >
                0345 5673921
              </a>
            </p>
          </div>

          {/* Right Column: Cinematic Hero Media */}
          <div className="lg:col-span-5">
            <div
              className={`relative mx-auto w-full max-w-lg lg:max-w-none transition-transform duration-300 ease-out ${
                prefersReducedMotion ? "" : "animate-scale-in"
              }`}
              style={{
                transform: !prefersReducedMotion && parallaxY ? `translateY(${parallaxY}px)` : undefined,
              }}
            >
              {/* Cinematic Frame */}
              <figure className="relative aspect-[4/5] sm:aspect-[16/11] lg:aspect-[4/5] overflow-hidden rounded-2xl bg-night shadow-2xl ring-1 ring-gold/25">
                {/* Immediate fallback/poster image for zero LCP delay & zero layout shift */}
                <Image
                  src={media.hero}
                  alt="Sadiq Pearl Marquee illuminated facade at night on Rashidpur–Orangabad Road, Kakrot, Sarai Alamgir"
                  fill
                  priority
                  sizes="(min-width: 1280px) 520px, (min-width: 1024px) 42vw, (min-width: 640px) 80vw, 100vw"
                  className={`object-cover transition-opacity duration-1000 ${
                    videoReady ? "opacity-0" : "opacity-100"
                  }`}
                />

                {/* Hero video: deferred, muted, looped, autoplay, playsInline */}
                <video
                  ref={videoRef}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                    videoReady ? "opacity-100" : "opacity-0"
                  }`}
                  poster={media.hero}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onPlaying={() => setVideoReady(true)}
                  onCanPlay={() => {
                    if (!prefersReducedMotion) {
                      videoRef.current?.play().catch(() => {});
                    }
                  }}
                  aria-hidden="true"
                >
                  <source src={media.heroVideo} type="video/mp4" />
                </video>

                {/* Atmospheric gradient for readability */}
                <div
                  className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-night/90 via-night/40 to-transparent pointer-events-none"
                  aria-hidden="true"
                />

                {/* Top Location Badge */}
                <div className="absolute top-4 left-4 bg-night/70 backdrop-blur-md text-white/95 border border-white/15 rounded-full px-3.5 py-1.5 flex items-center gap-1.5 text-xs shadow-md">
                  <Icon name="pin" className="w-3.5 h-3.5 text-gold-light" />
                  <span>Kakrot, Sarai Alamgir</span>
                </div>

                {/* Real Footage Indicator */}
                <div className="absolute top-4 right-4 bg-gold/90 text-white rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider shadow">
                  Real Venue
                </div>

                {/* Bottom caption */}
                <figcaption className="absolute left-5 right-5 bottom-5 text-white">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-light">
                    The Venue
                  </span>
                  <span className="block font-display text-lg sm:text-xl text-white font-medium">
                    Illuminated facade and entrance at night
                  </span>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
