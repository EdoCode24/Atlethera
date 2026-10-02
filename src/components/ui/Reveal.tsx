"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { gsap, MQ, SplitText, useGSAP } from "@/lib/gsap";

interface RevealProps {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  id?: string;
}

/**
 * Line-by-line mask reveal for section headings. The server HTML is the finished heading;
 * motion only runs when the reader allows it, and plays once.
 */
export function Reveal({ as: Tag = "h2", className, children, id }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    (_context, contextSafe) => {
      const el = ref.current;
      if (!el || !contextSafe || !window.matchMedia(MQ.motion).matches) return;
      // Splitting measures layout; do it only for headings about to be seen.
      const setup = contextSafe(() => {
        let played = false;
        const split = SplitText.create(el, {
          type: "lines",
          mask: "lines",
          linesClass: "reveal-line",
          autoSplit: true,
          onSplit(self) {
            if (played) return;
            return gsap.from(self.lines, {
              yPercent: 112,
              duration: 1.15,
              stagger: 0.09,
              scrollTrigger: { trigger: el, start: "top 86%", once: true, onEnter: () => (played = true) },
            });
          },
        });
        return () => split.revert();
      });
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          observer.disconnect();
          setup();
        },
        { rootMargin: "0px 0px 35% 0px" },
      );
      observer.observe(el);
      return () => observer.disconnect();
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} id={id} className={className}>
      {children}
    </Tag>
  );
}
