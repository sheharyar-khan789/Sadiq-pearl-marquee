"use client";

import { useEffect } from "react";

/**
 * One lightweight controller for the site's motion language. Elements opt in
 * with data attributes, so server components need no client JS of their own:
 *
 *   data-reveal[="depth"]   fade/rise (or perspective rise) when scrolled into view
 *   data-reveal-delay="120" optional stagger in ms
 *   data-parallax="0.12"    translateY relative to viewport centre (speed factor)
 *   data-tilt               3D pointer tilt on fine pointers (mouse / trackpad)
 *
 * Parallax and tilt write CSS variables directly — no React state, no
 * re-renders. Everything is skipped under prefers-reduced-motion.
 */
export default function MotionEffects() {
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- Reveal -----------------------------------------------------------
    const revealed = new WeakSet<Element>();
    const io = reduce
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              entry.target.classList.add("is-visible");
              io?.unobserve(entry.target);
            }
          },
          { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
        );

    const registerReveals = (scope: ParentNode) => {
      scope.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        if (revealed.has(el)) return;
        revealed.add(el);
        const delay = el.dataset.revealDelay;
        if (delay) el.style.setProperty("--reveal-delay", `${delay}ms`);
        if (io) io.observe(el);
        else el.classList.add("is-visible");
      });
    };

    // ---- Parallax ---------------------------------------------------------
    let parallaxEls: HTMLElement[] = [];
    const collectParallax = () => {
      parallaxEls = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    };
    let ticking = false;
    const updateParallax = () => {
      ticking = false;
      const vh = window.innerHeight;
      for (const el of parallaxEls) {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) continue;
        const speed = Number(el.dataset.parallax) || 0.1;
        const offset = (rect.top + rect.height / 2 - vh / 2) * -speed;
        el.style.setProperty("--parallax-y", `${offset.toFixed(1)}px`);
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateParallax);
      }
    };

    // ---- Tilt ---------------------------------------------------------------
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onPointerMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-tilt]");
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.classList.add("is-tilting");
      el.style.setProperty("--tilt-x", `${(-py * 6).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(px * 8).toFixed(2)}deg`);
    };
    const onPointerOut = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-tilt]");
      if (!el || el.contains(e.relatedTarget as Node | null)) return;
      el.classList.remove("is-tilting");
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
    };

    registerReveals(document);
    if (!reduce) {
      collectParallax();
      updateParallax();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      if (finePointer) {
        document.addEventListener("pointermove", onPointerMove, { passive: true });
        document.addEventListener("pointerout", onPointerOut, { passive: true });
      }
    }

    // Client-rendered content (gallery filters, tabs, route changes) adds new
    // opt-in elements later; pick them up without re-running everything.
    let pending = false;
    const mo = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        registerReveals(document);
        if (!reduce) {
          collectParallax();
          updateParallax();
        }
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    root.classList.add("motion-ready");
    return () => {
      io?.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerout", onPointerOut);
    };
  }, []);

  return null;
}
