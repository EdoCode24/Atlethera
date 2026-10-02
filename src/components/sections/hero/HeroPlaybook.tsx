"use client";

import { useMemo, useRef, useState } from "react";
import type { Vec } from "@/domain/playbook/types";
import { PlayField, type ViewBox } from "@/components/playbook/PlayField";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { DEFAULT_SETTINGS } from "@/domain/playbook/factory";
import { planPlayback, positionAt } from "@/domain/playbook/playback";
import type { FieldSettings } from "@/domain/playbook/types";
import type { SportId } from "@/domain/sports/types";
import type { HeroPlay } from "@/content/hero-plays";
import { gsap, MQ, ScrollTrigger, useGSAP } from "@/lib/gsap";

export interface HeroPlaybookCopy {
  app: string;
  section: string;
  side: string;
  category: string;
  noteTitle: string;
  tools: string[];
  sample: string;
  label: string;
}

const ASPECT = 1.75;
const SETTINGS: FieldSettings = { ...DEFAULT_SETTINGS, showOpponent: true };
const TOOL_ICONS: IconName[] = ["template", "star", "zigzag", "dashed", "endArrow", "cornerRound"];
/** Players move by SVG transform; an empty map only puts the field in playback mode (dimmed routes, start dots). */
const RUNNING: Record<string, Vec> = {};

/** A frame at a fixed aspect that always shows the whole width and the deepest route. */
function heroView(width: number, sport: SportId): ViewBox {
  const back = 7;
  const up = sport === "american-football" ? 19 : 15;
  let w = width + 3;
  let h = back + up;
  if (w / h > ASPECT) h = w / ASPECT;
  else w = h * ASPECT;
  return { x: width / 2 - w / 2, y: -(h - back), w, h };
}

/**
 * The homepage preview: the real playbook field and playback engine drawing a play, running
 * it, holding, and starting again. With reduced motion it is a still, fully drawn play.
 */
export function HeroPlaybook({ sport, play, playName, note, copy }: { sport: SportId; play: HeroPlay; playName: string; note: string; copy: HeroPlaybookCopy }) {
  const root = useRef<HTMLDivElement>(null);
  const firstRun = useRef(true);
  const [running, setRunning] = useState(false);
  const plan = useMemo(() => planPlayback(play.players), [play.players]);
  const zigzagOn = play.players.some((p) => p.route?.line === "zigzag");

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const routes = el.querySelectorAll("[data-route] path");
        // Moving the player nodes directly keeps React out of the per-frame loop.
        const movers = plan.tracks.map((track) => ({
          track,
          home: positionAt(track, plan, 0),
          node: el.querySelector<SVGGElement>(`[data-player-id="${track.id}"]`),
        }));
        const place = (t: number) => {
          for (const { track, home, node } of movers) {
            const at = positionAt(track, plan, t);
            node?.setAttribute("transform", `translate(${(at.x - home.x).toFixed(3)} ${(home.y - at.y).toFixed(3)})`);
          }
        };
        const clock = { t: 0 };
        // The first run waits for the hero intro; after a sport switch the new play starts right away.
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5, delay: firstRun.current ? 1.6 : 0.25 });
        firstRun.current = false;
        tl.call(() => {
          setRunning(false);
          place(0);
        })
          .fromTo(routes, { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.1, stagger: 0.04, ease: "power2.inOut" })
          .addLabel("run", "+=0.35")
          .call(() => setRunning(true), undefined, "run")
          .fromTo(clock, { t: 0 }, { t: plan.duration, duration: plan.duration, ease: "none", onUpdate: () => place(clock.t) }, "run")
          .to({}, { duration: 1.6 })
          .to(routes, { opacity: 0, duration: 0.35 })
          .set(routes, { opacity: 1, drawSVG: "0%" });
        // Only run while the hero is on screen.
        const st = ScrollTrigger.create({ trigger: el, start: "top bottom", end: "bottom top", onToggle: (self) => (self.isActive ? tl.play() : tl.pause()) });
        return () => {
          st.kill();
          for (const { node } of movers) node?.removeAttribute("transform");
          setRunning(false);
        };
      });
    },
    { dependencies: [sport], scope: root, revertOnUpdate: true },
  );

  return (
    <div ref={root} className="relative">
      <div className="@container relative overflow-hidden rounded-[var(--radius-panel)] bg-night-850 text-left shadow-[0_0_0_1px_var(--color-hairline-strong),0_40px_120px_-30px_rgb(0_0_0/0.9)]">
        <div className="flex h-11 items-center gap-3 border-b border-hairline bg-night-900 px-4">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-night-600" />
            <span className="size-2.5 rounded-full bg-night-600" />
            <span className="size-2.5 rounded-full bg-night-600" />
          </span>
          <span className="text-[0.78rem] font-semibold text-chalk-dim">{copy.app}</span>
          <span className="rounded-md bg-chalk/8 px-2 py-0.5 text-[0.72rem] font-semibold text-chalk">{copy.section}</span>
          <SampleBadge label={copy.sample} className="ml-auto" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
          <p className="display text-[1.35rem] leading-none" lang="en">
            {playName}
          </p>
          <span className="rounded-md bg-chalk/8 px-2 py-0.5 text-[0.72rem] font-semibold text-chalk-dim">{copy.category}</span>
          <span className="ml-auto flex items-center gap-1.5 text-[0.75rem] font-semibold text-mist">
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3">
              <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            {copy.side}
          </span>
        </div>
        <div className="relative mx-3 mb-3 overflow-hidden rounded-xl shadow-[inset_0_0_0_1px_var(--color-hairline)]" style={{ aspectRatio: ASPECT }}>
          <PlayField
            sport={sport}
            fieldWidth={play.fieldWidth}
            fieldLines="five"
            settings={SETTINGS}
            players={play.players}
            opponent={play.opponent}
            view={heroView(play.fieldWidth, sport)}
            positions={running ? RUNNING : null}
            runningRouteOpacity={0.8}
            label={copy.label}
            className="absolute inset-0 size-full"
          />
        </div>
      </div>

      <div data-depth="2.3" className="absolute -bottom-9 left-3 hidden sm:block xl:-left-10">
        <div aria-hidden="true" className="flex items-center gap-0.5 rounded-2xl bg-night-800 p-1.5 shadow-[0_0_0_1px_var(--color-hairline-strong),0_24px_60px_-20px_rgb(0_0_0/0.9)]">
          <span className="grid size-9 place-items-center text-mist">
            <Icon name="grip" className="size-4" />
          </span>
          {TOOL_ICONS.map((icon, i) => {
            const active = (icon === "zigzag" && zigzagOn) || icon === "cornerRound";
            return (
              <span key={icon} title={copy.tools[i]} className={`grid size-9 place-items-center rounded-[0.6rem] ${active ? "bg-chalk text-night-950" : "text-chalk-dim"}`}>
                <Icon name={icon} className="size-[1.05rem]" />
              </span>
            );
          })}
          <span className="grid size-9 place-items-center text-signal">
            <Icon name="removeSegment" className="size-[1.05rem]" />
          </span>
        </div>
      </div>

      <div data-depth="1.6" className="absolute -right-3 -bottom-16 hidden w-60 xl:block xl:-right-10">
        <div className="rounded-2xl bg-night-800 p-4 shadow-[0_0_0_1px_var(--color-hairline-strong),0_24px_60px_-20px_rgb(0_0_0/0.9)]">
          <p className="text-[0.7rem] text-mist">{copy.noteTitle}</p>
          <p className="mt-1.5 text-[0.82rem] leading-snug text-chalk">{note}</p>
        </div>
      </div>
    </div>
  );
}
