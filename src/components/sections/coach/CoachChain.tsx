"use client";

import { useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { SampleBadge } from "@/components/ui/SampleBadge";
import type { Dictionary } from "@/i18n/dictionaries/tr";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/fill";
import { gsap, MQ } from "@/lib/gsap";
import { useDeferredGSAP } from "@/lib/use-deferred-gsap";
import { PlayDiagram } from "./PlayDiagram";

type CoachCopy = Dictionary["coach"];

const WR_GROUP = ["KD", "BY", "AT", "OK", "SE", "MU"];

function Connector() {
  return (
    <div aria-hidden="true" className="relative flex items-center justify-center py-2 lg:px-0 lg:py-0">
      <span data-connector className="block h-10 w-px bg-hairline-strong lg:h-px lg:w-full" />
      <span className="absolute grid size-6 place-items-center rounded-full bg-night-800 text-chalk-dim">
        <Icon name="arrowDown" className="size-3.5 lg:-rotate-90" />
      </span>
    </div>
  );
}

/** Game film to play to meeting: the three pieces a coach links together. */
export function CoachChain({ copy, sample }: { copy: CoachCopy; sample: string }) {
  const root = useRef<HTMLDivElement>(null);

  const drawRoutes = (scope: HTMLElement) => {
    const q = gsap.utils.selector(scope);
    return gsap
      .timeline()
      .fromTo(q("[data-route-line]"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, stagger: 0.22, ease: "power2.inOut" })
      .fromTo(q("[data-route-head]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, stagger: 0.22 }, 0.7);
  };

  useDeferredGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        gsap.set(q("[data-route-head]"), { autoAlpha: 0 });
        gsap.set(q("[data-route-line]"), { drawSVG: "0%" });
        const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 72%", once: true } });
        tl.from(q("[data-card='video']"), { y: 40, autoAlpha: 0, duration: 0.8, ease: "expo.out" })
          .fromTo(q("[data-annotation]"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, stagger: 0.15, ease: "power2.inOut" }, 0.4)
          .from(q("[data-marker]"), { scale: 0, transformOrigin: "50% 50%", duration: 0.4, ease: "back.out(2.5)" }, 0.9)
          .from(q("[data-connector]"), { scale: 0, duration: 0.5, stagger: 0.9, ease: "power2.out" }, 1)
          .from(q("[data-card='play']"), { y: 40, autoAlpha: 0, duration: 0.8, ease: "expo.out" }, 1.2)
          .add(drawRoutes(el), 1.5)
          .from(q("[data-card='meeting']"), { y: 40, autoAlpha: 0, duration: 0.8, ease: "expo.out" }, 2.2)
          .from(q("[data-avatar]"), { scale: 0, autoAlpha: 0, duration: 0.4, stagger: 0.05, ease: "back.out(2)" }, 2.5);
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="grid items-stretch gap-0 lg:grid-cols-[1fr_3.5rem_1fr_3.5rem_1fr]">
      <article data-card="video" className="flex flex-col rounded-[var(--radius-panel)] bg-night-900 p-4 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]">
        <header className="flex items-center justify-between px-1 pb-3">
          <p className="flex items-center gap-2 text-[0.9rem] font-semibold">
            <Icon name="video" className="size-4 text-volt" />
            {copy.video.title}
          </p>
          <span className="tabular rounded-md bg-chalk/8 px-2 py-0.5 text-[0.72rem] font-semibold text-chalk-dim">{copy.video.speed}</span>
        </header>
        <div className="relative min-h-[11rem] flex-1 overflow-hidden rounded-xl bg-[radial-gradient(120%_90%_at_50%_0%,var(--color-turf-700),var(--color-turf-950))]">
          <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
            {[20, 34, 50, 70].map((y, i) => (
              <line key={y} x1={40 - i * 14} x2={120 + i * 14} y1={y} y2={y} stroke="var(--color-chalk)" strokeWidth="0.5" opacity="0.25" />
            ))}
            {[
              [60, 44],
              [72, 42],
              [84, 43],
              [96, 45],
              [70, 58],
              [110, 40],
              [44, 40],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="2.2" fill={i < 4 ? "var(--color-chalk)" : "var(--color-night-950)"} stroke="var(--color-chalk)" strokeWidth="0.6" opacity="0.85" />
            ))}
            <circle data-annotation cx="110" cy="40" r="6.5" fill="none" stroke="var(--color-volt)" strokeWidth="1.2" />
            <path data-annotation d="M104 36 C88 24 64 24 50 30" fill="none" stroke="var(--color-volt)" strokeWidth="1.2" strokeLinecap="round" />
            <path data-annotation d="M54 26 L50 30 L55 32" fill="none" stroke="var(--color-volt)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="absolute left-2.5 top-2.5 rounded-md bg-night-950/75 px-2 py-0.5 text-[0.7rem] text-chalk-dim">{copy.video.clip}</span>
        </div>
        <div className="mt-3 px-1">
          <div className="relative h-1.5 rounded-full bg-chalk/10">
            <span className="absolute inset-y-0 left-0 w-[46%] rounded-full bg-chalk/35" />
            <span data-marker className="absolute top-1/2 left-[46%] -mt-1.5 -ml-1.5 size-3 rounded-full bg-volt" />
          </div>
          <p className="mt-2.5 flex items-center justify-between text-[0.74rem] text-mist">
            <span className="tabular">02:14</span>
            <span className="flex items-center gap-1.5 text-volt">
              <Icon name="pencil" className="size-3.5" />
              {copy.video.marker}
            </span>
          </p>
        </div>
      </article>

      <Connector />

      <article data-card="play" className="flex flex-col rounded-[var(--radius-panel)] bg-night-800 p-4 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]">
        <header className="flex items-center justify-between px-1 pb-3">
          <p className="flex items-center gap-2 text-[0.9rem] font-semibold">
            <Icon name="playbook" className="size-4 text-volt" />
            {copy.play.title}
          </p>
          <span className="rounded-md bg-chalk/8 px-2 py-0.5 text-[0.72rem] font-semibold text-chalk-dim">{copy.play.category}</span>
        </header>
        <div className="flex flex-1 items-center rounded-xl bg-turf-900 px-2 py-1.5 shadow-[inset_0_0_0_1px_var(--color-hairline)]">
          <PlayDiagram ariaLabel={copy.play.aria} />
        </div>
        <div className="mt-3 flex items-center justify-between px-1">
          <p lang="en" className="display text-[1.35rem] leading-none">
            {copy.play.name}
          </p>
          <button
            type="button"
            onClick={() => {
              if (root.current && window.matchMedia(MQ.motion).matches) drawRoutes(root.current);
            }}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.76rem] font-semibold text-chalk-dim shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] transition-colors hover:text-chalk"
          >
            <Icon name="replay" className="size-3.5" />
            {copy.play.replay}
          </button>
        </div>
      </article>

      <Connector />

      <article data-card="meeting" className="flex flex-col rounded-[var(--radius-panel)] bg-night-900 p-4 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]">
        <header className="flex items-center justify-between px-1 pb-3">
          <p className="flex items-center gap-2 text-[0.9rem] font-semibold">
            <Icon name="meeting" className="size-4 text-volt" />
            {copy.meeting.title}
          </p>
          <span className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-signal">
            <span className="size-1.5 animate-pulse rounded-full bg-signal" />
            REC
          </span>
        </header>
        <div className="rounded-xl bg-night-950/70 p-3 shadow-[inset_0_0_0_1px_var(--color-hairline)]">
          <p className="flex items-center gap-1.5 text-[0.72rem] text-mist">
            <Icon name="share" className="size-3.5" />
            {copy.meeting.share}
          </p>
          <div className="mt-2 rounded-lg bg-turf-900 px-1.5 py-1 opacity-80">
            <PlayDiagram />
          </div>
        </div>
        <div className="mt-3 px-1">
          <div className="flex items-baseline justify-between">
            <p className="font-semibold">{copy.meeting.name}</p>
            <p className="text-[0.76rem] text-mist">{fill(copy.meeting.people, { n: WR_GROUP.length })}</p>
          </div>
          <div className="mt-2 flex -space-x-1.5">
            {WR_GROUP.map((initials, i) => (
              <span
                key={initials}
                data-avatar
                className={cn(
                  "grid size-7 place-items-center rounded-full text-[0.62rem] font-bold ring-2 ring-night-900",
                  i === 0 ? "bg-volt text-night-950" : "bg-night-600 text-chalk-dim",
                )}
              >
                {initials}
              </span>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[0.76rem] text-chalk-dim">
            <Icon name="lock" className="size-3.5 text-volt" />
            {copy.meeting.access}
          </p>
        </div>
        <SampleBadge label={sample} className="mt-4 self-start" />
      </article>
    </div>
  );
}
