"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { reels, type VideoItem } from "@/data/gallery";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { useBooking } from "./BookingContext";
import SectionHead from "./Section";
import Icon, { WhatsAppGlyph } from "./Icon";

function Reel({ item, index }: { item: VideoItem; index: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  // Play only while mostly on screen (downloads nothing until then).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !userPaused) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.6 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [userPaused]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      setUserPaused(false);
      v.play().catch(() => {});
    } else {
      setUserPaused(true);
      v.pause();
    }
  };

  return (
    <li className="w-[68%] shrink-0 snap-center sm:w-[40%] lg:w-auto">
      <div data-reveal data-reveal-delay={index * 90}>
        <figure className="group relative aspect-[9/16] overflow-hidden rounded-2xl bg-espresso-700 ring-1 ring-white/10">
          <Image
            src={item.poster}
            alt=""
            fill
            sizes="(min-width: 1024px) 280px, (min-width: 640px) 40vw, 68vw"
            className="object-cover"
          />
          <video
            ref={videoRef}
            src={item.src}
            muted
            loop
            playsInline
            preload="none"
            aria-label={`${item.title}: ${item.caption}`}
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              playing ? "opacity-100" : "opacity-0"
            }`}
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-espresso/90 via-transparent to-espresso/20" />
          <figcaption className="absolute inset-x-0 bottom-0 p-4 pr-16 text-white sm:p-5 sm:pr-16">
            <p className="font-display text-xl leading-tight">{item.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/70">{item.caption}</p>
          </figcaption>
          <button
            type="button"
            onClick={toggle}
            aria-pressed={playing}
            aria-label={`${playing ? "Pause" : "Play"} ${item.title} video`}
            className="absolute bottom-4 right-4 grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-espresso/50 text-white backdrop-blur-md transition-colors hover:bg-espresso/80"
          >
            <Icon name={playing ? "pause" : "play"} className="h-4 w-4" />
          </button>
        </figure>
      </div>
    </li>
  );
}

export default function DecorReels() {
  const { openTerms } = useBooking();
  const whatsappUrl = getWhatsAppUrl(
    "Assalam o Alaikum, I watched the stage and décor videos on your website and would like to ask about decoration for my event."
  );

  return (
    <section
      id="decor"
      aria-labelledby="decor-title"
      className="relative overflow-hidden bg-espresso py-20 text-white sm:py-28 lg:py-36"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_85%_0%,rgba(217,188,134,0.12),transparent_70%)]"
      />
      <div className="container-px relative mx-auto max-w-content">
        <div className="grid items-end gap-8 grid-cols-1 lg:grid-cols-12 lg:gap-16">
          <SectionHead
            id="decor-title"
            tone="dark"
            className="lg:col-span-7"
            eyebrow="Stages & Décor"
            title={
              <>
                Stage décor, <em className="text-gold-light">filmed at the venue</em>
              </>
            }
            intro="Real stage setups recorded inside Sadiq Pearl Marquee. Decoration is arranged in-house — outside decoration is not permitted — and extra decoration, lighting and sound are available as separately charged services."
          />
          <div data-reveal data-reveal-delay="120" className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-accent">
              <WhatsAppGlyph className="h-[18px] w-[18px]" />
              Ask about décor
            </a>
            <button type="button" onClick={openTerms} className="btn btn-outline-light" aria-haspopup="dialog">
              Booking terms
            </button>
          </div>
        </div>

        <ul
          aria-label="Stage and venue videos"
          className="no-scrollbar -mx-5 mt-12 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:mt-16 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-0"
        >
          {reels.map((item, i) => (
            <Reel key={item.id} item={item} index={i} />
          ))}
        </ul>
      </div>
    </section>
  );
}
