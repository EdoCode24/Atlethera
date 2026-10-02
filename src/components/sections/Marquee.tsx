"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { gsap, MQ, ScrollTrigger } from "@/lib/gsap";
import { useDeferredGSAP } from "@/lib/use-deferred-gsap";

export interface MarqueeItem {
  text: string;
  /** Set for English terms on the Turkish page, so uppercasing keeps a dotless I. */
  lang?: string;
}

interface MarqueeProps {
  label: string;
  pauseLabel: string;
  playLabel: string;
  positions: MarqueeItem[];
  terms: MarqueeItem[];
}

function Row({ items, outline, copy }: { items: MarqueeItem[]; outline?: boolean; copy?: boolean }) {
  return (
    <ul aria-hidden={copy || undefined} className="flex shrink-0 items-center">
      {items.map((item, i) => (
        <li key={`${item.text}-${i}`} className="flex items-center">
          <span
            lang={item.lang}
            className={cn(
              "display px-[0.35em] leading-none whitespace-nowrap",
              outline
                ? "text-[clamp(2.4rem,1.6rem+3.2vw,4.6rem)] text-transparent [-webkit-text-stroke:1.2px_rgb(242_244_237/0.38)]"
                : "text-[clamp(3rem,2rem+4.4vw,6.4rem)] text-chalk",
            )}
          >
            {item.text}
          </span>
          <svg viewBox="0 0 12 12" aria-hidden="true" className={cn("mx-[0.6em] size-3 shrink-0", outline ? "text-mist/50" : "text-volt")}>
            <path d="M6 0 12 6 6 12 0 6Z" fill="currentColor" />
          </svg>
        </li>
      ))}
    </ul>
  );
}

/**
 * Two rows of real terms running in opposite directions. Scrolling speeds them up and
 * scrolling back reverses them. A visible button pauses them (WCAG 2.2.2).
 */
export function Marquee({ label, pauseLabel, playLabel, positions, terms }: MarqueeProps) {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const tweens = useRef<gsap.core.Tween[]>([]);

  useDeferredGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const tracks = gsap.utils.toArray<HTMLElement>("[data-track]", el);
        tweens.current = tracks.map((track, i) => {
          const duration = i % 2 ? 46 : 38;
          const tween = gsap.fromTo(track, { xPercent: i % 2 ? -50 : 0 }, { xPercent: i % 2 ? 0 : -50, duration, ease: "none", repeat: -1 });
          // Start far into the loop so scrolling back (negative timeScale) never runs out of room.
          return tween.totalTime(duration * 500);
        });
        let direction = 1;
        const trigger = ScrollTrigger.create({
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => tweens.current.forEach((t) => (self.isActive && !el.dataset.paused ? t.play() : t.pause())),
          onUpdate: (self) => {
            direction = self.direction;
            const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 350, 6);
            for (const t of tweens.current) {
              gsap.to(t, {
                timeScale: boost * direction,
                duration: 0.15,
                overwrite: true,
                onComplete: () => {
                  gsap.to(t, { timeScale: direction, duration: 1.2, ease: "power2.out" });
                },
              });
            }
          },
        });
        return () => {
          trigger.kill();
          tweens.current = [];
        };
      });
    },
    { scope: root },
  );

  const toggle = () => {
    const next = !paused;
    setPaused(next);
    if (root.current) root.current.dataset.paused = next ? "true" : "";
    for (const t of tweens.current) {
      if (next) t.pause();
      else t.play();
    }
  };

  return (
    <div ref={root} role="region" aria-label={label} className="marquee relative overflow-clip py-10 sm:py-14">
      <div className="flex w-max flex-col gap-3">
        <div data-track className="flex w-max">
          <Row items={positions} />
          <Row items={positions} copy />
        </div>
        <div data-track className="flex w-max">
          <Row items={terms} outline />
          <Row items={terms} outline copy />
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={paused}
        className="marquee-toggle absolute right-[var(--spacing-gutter)] bottom-3 grid size-9 place-items-center rounded-full bg-night-900/80 text-mist shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] transition-colors hover:text-chalk"
      >
        <span className="sr-only">{paused ? playLabel : pauseLabel}</span>
        {paused ? (
          <Icon name="play" className="size-3.5" />
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5">
            <path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </div>
  );
}
