"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import { gsap, MQ } from "@/lib/gsap";
import { useDeferredGSAP } from "@/lib/use-deferred-gsap";

interface FlowTrackProps {
  steps: string[];
  tone?: "volt" | "chalk";
  className?: string;
}

/** A package's workflow as a chain of steps that light up in order, like a drive. */
export function FlowTrack({ steps, tone = "chalk", className }: FlowTrackProps) {
  const root = useRef<HTMLOListElement>(null);

  useDeferredGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const items = gsap.utils.toArray<HTMLElement>("[data-step]", el);
        gsap
          .timeline({ scrollTrigger: { trigger: el, start: "top 82%", once: true } })
          .from(items, { autoAlpha: 0, y: 10, duration: 0.5, stagger: 0.11, ease: "power3.out" });
      });
    },
    { scope: root },
  );

  return (
    <ol ref={root} className={cn("flex flex-wrap items-center gap-2", className)}>
      {steps.map((step, i) => (
        <li key={step} className="flex items-center">
          <span
            data-step
            className={cn(
              "flex items-center gap-2 rounded-[0.6rem] py-1.5 pr-3 pl-1.5 text-[0.86rem] font-medium",
              tone === "volt" ? "bg-chalk/8 text-chalk" : "bg-chalk/5 text-chalk",
            )}
          >
            <span
              className={cn(
                "grid size-6 place-items-center rounded-[0.4rem] text-[0.7rem] font-semibold tabular",
                tone === "volt" ? "bg-volt text-night-950" : "bg-chalk/12 text-chalk-dim",
              )}
            >
              {i + 1}
            </span>
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}
