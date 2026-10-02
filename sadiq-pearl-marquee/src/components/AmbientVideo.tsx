"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

/**
 * Muted, looping background film that loads and plays only while on screen.
 * Shows its poster until playing; never autoplays under reduced motion; has a
 * visible pause/play control.
 */
export default function AmbientVideo({
  src,
  poster,
  label,
  sizes,
  className = "",
}: {
  src: string;
  poster: string;
  label: string;
  sizes: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !userPaused) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.4 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [userPaused]);

  const toggle = () => {
    const v = ref.current;
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
    <div className={`relative overflow-hidden ${className}`}>
      <Image src={poster} alt="" fill sizes={sizes} className="object-cover" />
      <video
        ref={ref}
        src={src}
        muted
        loop
        playsInline
        preload="none"
        aria-label={label}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          playing ? "opacity-100" : "opacity-0"
        }`}
      />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={`${playing ? "Pause" : "Play"} video: ${label}`}
        className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-espresso/50 text-white backdrop-blur-md transition-colors hover:bg-espresso/80"
      >
        <Icon name={playing ? "pause" : "play"} className="h-4 w-4" />
      </button>
    </div>
  );
}
