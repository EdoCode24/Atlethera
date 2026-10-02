"use client";

import Lenis from "lenis";
import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { setupsReady } from "@/lib/deferred";
import { gsap, MQ, ScrollTrigger } from "@/lib/gsap";

const HEADER_OFFSET = -88;

const LenisContext = createContext<RefObject<Lenis | null> | null>(null);

/** The live Lenis instance, or null under reduced motion. Read it in handlers, not during render. */
export function useLenis(): RefObject<Lenis | null> {
  const ref = useContext(LenisContext);
  if (!ref) throw new Error("useLenis must be used inside <SmoothScroll>");
  return ref;
}

export function scrollToTarget(lenis: Lenis | null, target: HTMLElement | number, immediate = false) {
  if (lenis) {
    lenis.scrollTo(target, { offset: typeof target === "number" ? 0 : HEADER_OFFSET, immediate });
    return;
  }
  const top = typeof target === "number" ? target : target.getBoundingClientRect().top + window.scrollY + HEADER_OFFSET;
  window.scrollTo({ top, behavior: "auto" });
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia(MQ.reduce);
    let stop: (() => void) | null = null;

    const start = () => {
      const lenis = new Lenis({ autoRaf: false, lerp: 0.1, anchors: { offset: HEADER_OFFSET } });
      const tick = (time: number) => lenis.raf(time * 1000);
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      lenisRef.current = lenis;
      return () => {
        gsap.ticker.remove(tick);
        gsap.ticker.lagSmoothing(500, 33);
        lenis.destroy();
        lenisRef.current = null;
      };
    };

    const sync = () => {
      stop?.();
      stop = reduce.matches ? null : start();
    };

    sync();
    reduce.addEventListener("change", sync);
    return () => {
      reduce.removeEventListener("change", sync);
      stop?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([document.fonts.ready, setupsReady()]).then(() => {
      if (cancelled) return;
      ScrollTrigger.refresh();
      // Pin spacers move sections after the browser's own anchor jump; land on the hash again.
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (target) scrollToTarget(lenisRef.current, target, true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <LenisContext value={lenisRef}>{children}</LenisContext>;
}
