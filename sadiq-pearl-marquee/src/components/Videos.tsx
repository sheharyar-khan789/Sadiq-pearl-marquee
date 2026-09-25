"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { videos, type VideoItem } from "@/data/gallery";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import SectionHead from "./Section";
import Icon, { WhatsAppGlyph } from "./Icon";

export default function Videos() {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<Record<string, boolean>>({});

  const featuredVideo = videos[0]; // Grand Entrance Walkthrough
  const supportingVideos = videos.slice(1); // Aerial and Night Facade

  const handlePlay = useCallback((id: string) => {
    setActiveVideoId(id);
  }, []);

  const handleVideoError = useCallback((id: string) => {
    setVideoError((prev) => ({ ...prev, [id]: true }));
  }, []);

  const whatsappInquiryUrl = getWhatsAppUrl(
    "Assalam o Alaikum, I watched the video walkthroughs of Sadiq Pearl Marquee and would like to ask about availability for an upcoming event."
  );

  return (
    <section id="videos" className="py-16 md:py-24 scroll-mt-20 border-b border-line/40 bg-surface">
      <div className="max-w-content mx-auto container-px">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10 sm:mb-14">
          <SectionHead
            eyebrow="Motion &amp; Atmosphere"
            title="Experience the Marquee in Motion"
            intro="Watch real video footage filmed on-site at Sadiq Pearl Marquee. Experience the grand entrance colonnade, aerial grounds, and night facade in Sarai Alamgir."
          />
          <div className="lg:mb-14 shrink-0">
            <a
              href={whatsappInquiryUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Inquire on WhatsApp after watching videos: 0345 5673921"
              className="inline-flex items-center gap-2.5 bg-gold hover:bg-gold-container text-white font-semibold text-xs sm:text-sm h-12 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <WhatsAppGlyph className="w-4 h-4 fill-current" />
              <span>Inquire for Your Event</span>
            </a>
          </div>
        </div>

        {/* Featured Primary Video Spotlight */}
        <div className="mb-10 sm:mb-12">
          <article className="bg-surface-low rounded-2xl border border-line/70 overflow-hidden shadow-md">
            <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full bg-night overflow-hidden">
              {activeVideoId === featuredVideo.id && !videoError[featuredVideo.id] ? (
                <video
                  src={featuredVideo.src}
                  poster={featuredVideo.poster}
                  controls
                  autoPlay
                  playsInline
                  onError={() => handleVideoError(featuredVideo.id)}
                  className="w-full h-full object-cover"
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="relative w-full h-full group">
                  {/* Poster image fallback */}
                  <Image
                    src={featuredVideo.poster}
                    alt={`Video poster: ${featuredVideo.title}`}
                    fill
                    sizes="(min-width: 1280px) 1200px, 100vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-night/80 via-night/30 to-transparent pointer-events-none" />

                  {/* Top Badges */}
                  <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2">
                    <span className="bg-gold text-white text-[11px] sm:text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full shadow">
                      Featured Walkthrough
                    </span>
                    <span className="bg-night/70 backdrop-blur-md text-white/90 text-xs px-3 py-1 rounded-full border border-white/10 hidden sm:inline-block">
                      Real Footage
                    </span>
                  </div>

                  {/* Central Play Trigger Button */}
                  <button
                    type="button"
                    onClick={() => handlePlay(featuredVideo.id)}
                    aria-label={`Play ${featuredVideo.title}`}
                    className="absolute inset-0 grid place-items-center group focus-visible:ring-4 focus-visible:ring-gold"
                  >
                    <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gold/90 text-white grid place-items-center shadow-xl group-hover:scale-110 group-hover:bg-gold transition-all duration-300">
                      <Icon name="play" className="w-7 h-7 sm:w-9 sm:h-9 ml-1 fill-current" />
                    </span>
                  </button>

                  {/* Bottom Video Information */}
                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 text-white flex flex-col sm:flex-row sm:items-end justify-between gap-4 pointer-events-none">
                    <div>
                      <span className="text-xs uppercase tracking-widest text-gold-light font-semibold block mb-1">
                        {featuredVideo.subtitle}
                      </span>
                      <h3 className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold">
                        {featuredVideo.title}
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-white/80 max-w-xl line-clamp-2">
                        {featuredVideo.caption}
                      </p>
                    </div>
                    <span className="text-xs bg-white/15 backdrop-blur-sm px-3 py-1 rounded text-white/90 self-start sm:self-auto">
                      Tap to play
                    </span>
                  </div>
                </div>
              )}
            </div>
          </article>
        </div>

        {/* Supporting Video Cards (Asymmetrical Grid) */}
        <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
          {supportingVideos.map((video) => (
            <article
              key={video.id}
              className="bg-surface-low rounded-2xl border border-line/70 overflow-hidden shadow-sm hover:border-gold/60 transition-all flex flex-col justify-between group"
            >
              <div className="relative aspect-[16/10] w-full bg-night overflow-hidden">
                {activeVideoId === video.id && !videoError[video.id] ? (
                  <video
                    src={video.src}
                    poster={video.poster}
                    controls
                    autoPlay
                    playsInline
                    onError={() => handleVideoError(video.id)}
                    className="w-full h-full object-cover"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="relative w-full h-full">
                    <Image
                      src={video.poster}
                      alt={`Video thumbnail: ${video.title}`}
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-night/35 group-hover:bg-night/20 transition-colors pointer-events-none" />

                    {/* Top Category Badge */}
                    <div className="absolute top-4 left-4">
                      <span className="bg-night/75 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-1 rounded shadow">
                        {video.subtitle}
                      </span>
                    </div>

                    {/* Play Trigger */}
                    <button
                      type="button"
                      onClick={() => handlePlay(video.id)}
                      aria-label={`Play ${video.title}`}
                      className="absolute inset-0 grid place-items-center focus-visible:ring-4 focus-visible:ring-gold"
                    >
                      <span className="w-14 h-14 rounded-full bg-surface/90 text-gold grid place-items-center shadow-lg group-hover:scale-110 group-hover:bg-gold group-hover:text-white transition-all duration-300">
                        <Icon name="play" className="w-6 h-6 ml-0.5 fill-current" />
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Caption Content */}
              <div className="p-6 flex flex-col justify-between flex-1">
                <div>
                  <h4 className="font-display text-lg sm:text-xl text-ink font-semibold mb-1">
                    {video.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
                    {video.caption}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between text-xs text-ink-muted">
                  <span>Sadiq Pearl Marquee · Sarai Alamgir</span>
                  <button
                    type="button"
                    onClick={() => handlePlay(video.id)}
                    className="font-semibold text-gold hover:underline"
                  >
                    Play video →
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Experience Micro-Banner with Direct WhatsApp Contact */}
        <div className="mt-12 sm:mt-16 p-6 rounded-2xl bg-surface-mid/40 border border-line/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-gold/15 text-gold grid place-items-center shrink-0">
              <Icon name="pin" className="w-5 h-5" />
            </span>
            <div>
              <p className="font-display text-base text-ink font-semibold">
                Visit the Marquee in Person
              </p>
              <p className="text-xs text-ink-soft">
                Rashidpur–Orangabad Road in Kakrot, Sarai Alamgir · Management available daily
              </p>
            </div>
          </div>
          <a
            href={whatsappInquiryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gold hover:bg-gold-container text-white text-xs sm:text-sm font-semibold h-10 px-5 rounded-lg transition-colors shadow-sm shrink-0"
          >
            <WhatsAppGlyph className="w-4 h-4 fill-current" />
            <span>Message on WhatsApp</span>
          </a>
        </div>
      </div>
    </section>
  );
}
