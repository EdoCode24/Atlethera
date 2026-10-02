"use client";

import { useRef, type ReactNode } from "react";
import { gsap, MQ } from "@/lib/gsap";
import { useDeferredGSAP } from "@/lib/use-deferred-gsap";

/** Three devices at different depths; scrolling moves them at different speeds. */
export function DevicesMotion({ laptop, tablet, phone }: { laptop: ReactNode; tablet: ReactNode; phone: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useDeferredGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add({ desktop: MQ.desktop, compact: MQ.compact }, (ctx) => {
        const scale = ctx.conditions?.desktop ? 1 : 0.4;
        const scroll = { trigger: el, start: "top bottom", end: "bottom top", scrub: true };
        gsap.fromTo("[data-layer='laptop']", { y: 30 * scale }, { y: -30 * scale, ease: "none", scrollTrigger: scroll });
        gsap.fromTo("[data-layer='tablet']", { y: 90 * scale }, { y: -50 * scale, ease: "none", scrollTrigger: scroll });
        gsap.fromTo("[data-layer='phone']", { y: 160 * scale }, { y: -90 * scale, ease: "none", scrollTrigger: scroll });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="relative mt-16 grid grid-cols-12 items-end gap-4 lg:mt-24">
      <div data-layer="laptop" className="col-span-12 opacity-90 sm:col-span-6 lg:col-span-5 lg:col-start-1 lg:-mr-24">
        {laptop}
      </div>
      <div data-layer="tablet" className="relative z-10 col-span-12 sm:col-span-8 sm:col-start-3 lg:col-span-5 lg:col-start-5">
        {tablet}
      </div>
      <div data-layer="phone" className="relative z-20 col-span-6 col-start-4 sm:col-span-3 lg:col-span-2 lg:col-start-10 lg:ml-2">
        {phone}
      </div>
    </div>
  );
}
