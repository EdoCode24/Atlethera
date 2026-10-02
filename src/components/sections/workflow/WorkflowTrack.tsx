"use client";

import { useRef, type ReactNode } from "react";
import { gsap, MQ, type ScrollTrigger } from "@/lib/gsap";
import { useDeferredGSAP } from "@/lib/use-deferred-gsap";

/**
 * Wide screens: the section pins and the steps travel sideways with the scroll, each
 * panel animating its mock as it arrives. Narrow screens: a plain vertical list.
 */
export function WorkflowTrack({ intro, panels }: { intro: ReactNode; panels: ReactNode[] }) {
  const root = useRef<HTMLDivElement>(null);

  useDeferredGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const track = el.querySelector<HTMLElement>("[data-track]")!;
      const mm = gsap.matchMedia();

      const reveal = (panel: HTMLElement, trigger: ScrollTrigger.Vars) => {
        const tl = gsap.timeline({ scrollTrigger: { ...trigger, once: true } });
        const find = (selector: string) => {
          const found = panel.querySelectorAll(selector);
          return found.length > 0 ? found : null;
        };
        const items = find("[data-anim-item]");
        const lines = find("[data-line]");
        const rings = find("[data-ring]");
        const bars = find("[data-bar]");
        if (items) tl.from(items, { autoAlpha: 0, y: 14, duration: 0.5, stagger: 0.05, ease: "power3.out" }, 0);
        if (lines) tl.from(lines, { drawSVG: "0%", duration: 1.1, ease: "power2.inOut" }, 0);
        if (rings) tl.from(rings, { drawSVG: "0%", duration: 1, stagger: 0.12, ease: "power2.inOut" }, 0);
        if (bars) tl.from(bars, { scaleX: 0, transformOrigin: "left center", duration: 0.8, stagger: 0.06, ease: "power3.out" }, 0.1);
      };

      mm.add(MQ.desktop, () => {
        const distance = () => track.scrollWidth - el.clientWidth;
        const move = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: true,
            invalidateOnRefresh: true,
          },
        });
        gsap.to(el.querySelector("[data-rail]"), {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top top", end: () => `+=${distance()}`, scrub: true, invalidateOnRefresh: true },
        });
        for (const panel of gsap.utils.toArray<HTMLElement>("[data-panel]", el)) {
          reveal(panel, { trigger: panel, containerAnimation: move, start: "left 78%" });
        }
      });

      mm.add(MQ.compact, () => {
        for (const panel of gsap.utils.toArray<HTMLElement>("[data-panel]", el)) {
          reveal(panel, { trigger: panel, start: "top 78%" });
        }
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="relative overflow-hidden lg:flex lg:h-[100svh] lg:flex-col lg:justify-center">
      <div data-track className="flex flex-col gap-8 px-[var(--spacing-gutter)] py-20 lg:w-max lg:flex-row lg:items-stretch lg:gap-6 lg:py-0">
        <div className="shrink-0 lg:flex lg:w-[min(34rem,40vw)] lg:flex-col lg:justify-center lg:pr-10">{intro}</div>
        {panels}
      </div>
      <div aria-hidden="true" className="absolute inset-x-[var(--spacing-gutter)] bottom-10 hidden h-px bg-hairline lg:block">
        <span data-rail className="block h-full origin-left scale-x-0 bg-volt" />
      </div>
    </div>
  );
}
