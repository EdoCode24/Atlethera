"use client";

import { useRef, useState, type ReactNode } from "react";
import { FieldSvg, VIEWBOX_AF, VIEWBOX_COMPACT, VIEWBOX_FLAG, type FieldPlayer } from "@/components/field/FieldSvg";
import { scrollToTarget, useLenis } from "@/components/providers/SmoothScroll";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { SportId } from "@/domain/sports/types";
import { gsap, MQ, ScrollTrigger } from "@/lib/gsap";
import { useDeferredGSAP } from "@/lib/use-deferred-gsap";

export interface ModulePanelData {
  id: SportId;
  name: string;
}

interface ModulesStageProps {
  intro: ReactNode;
  legend: ReactNode;
  panels: ReactNode;
  tabsLabel: string;
  sports: ModulePanelData[];
  field: {
    players: FieldPlayer[];
    losX: number;
    labels: { afSize: string; flagSize: string; los: string; noRun: string; rushLine: string };
    groupLabels: { x: number; y: number; text: string }[];
    ariaLabel: string;
  };
}

const AF: SportId = "american-football";
const FLAG: SportId = "flag-football";

/**
 * One master timeline takes the field from American football to flag football:
 * the flag field draws itself at true scale inside the big one, the camera zooms in,
 * the players who have a flag equivalent walk to their spots and the rest leave.
 * Wide screens scrub it with the page; narrow screens and tab clicks play it.
 */
export function ModulesStage({ intro, legend, panels, tabsLabel, sports, field }: ModulesStageProps) {
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const activeRef = useRef<SportId>(AF);
  const [active, setActive] = useState<SportId>(AF);
  const lenisRef = useLenis();

  useDeferredGSAP(
    () => {
      const el = root.current;
      const svg = el?.querySelector<SVGSVGElement>("[data-field]");
      if (!el || !svg) return;
      const q = gsap.utils.selector(el);
      const mm = gsap.matchMedia();

      mm.add({ desktop: MQ.desktop, compact: MQ.compact, reduce: MQ.reduce }, (context) => {
        const { desktop, reduce } = context.conditions as { desktop: boolean; reduce: boolean };
        const wide = desktop || (reduce && window.matchMedia("(min-width: 1024px)").matches);

        gsap.set(svg, { attr: { viewBox: wide ? VIEWBOX_AF : VIEWBOX_COMPACT } });
        for (const p of field.players) gsap.set(q(`[data-player="${p.id}"]`), { x: p.x, y: p.y });
        gsap.set(q("[data-flag-lines] [data-draw]"), { drawSVG: "0%" });
        gsap.set(q("[data-no-run], [data-flag-caption], [data-no-run-caption], [data-rush], [data-rush-caption], .field-label-flag"), { autoAlpha: 0 });
        gsap.set(q(`[data-panel="${FLAG}"]`), { autoAlpha: 0, y: 12 });

        const kept = field.players.filter((p) => p.flag);
        const master = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });
        master
          .addLabel(AF, 0)
          .to(q("[data-flag-lines] [data-draw]"), { drawSVG: "100%", duration: 0.9, stagger: 0.08 }, 0.35)
          .to(q("[data-flag-caption]"), { autoAlpha: 1, duration: 0.3 }, 0.7)
          .to(q("[data-player]:not([data-keeps])"), { autoAlpha: 0, scale: 0, transformOrigin: "50% 50%", duration: 0.45, stagger: 0.015 }, 0.55)
          .to(q("[data-group-labels], [data-af-caption]"), { autoAlpha: 0, duration: 0.3 }, 0.55)
          .to(svg, { attr: { viewBox: wide ? VIEWBOX_FLAG : VIEWBOX_COMPACT }, duration: 1.2, ease: "power3.inOut" }, 1.2)
          .to(q("[data-af-lines]"), { autoAlpha: 0.1, duration: 0.8 }, 1.2)
          .to(q("[data-no-run]"), { autoAlpha: 1, duration: 0.5, stagger: 0.08 }, 1.5)
          .to(q("[data-no-run-caption]"), { autoAlpha: 1, duration: 0.3 }, 1.9)
          .to(q("[data-keeps] .field-label-af"), { autoAlpha: 0, duration: 0.3 }, 1.2)
          .to(q(".field-label-flag"), { autoAlpha: 1, duration: 0.4, stagger: 0.03 }, 2.1)
          .to(q("[data-rush]"), { autoAlpha: 1, duration: 0.3 }, 2.3)
          .to(q("[data-rush-caption]"), { autoAlpha: 1, duration: 0.3 }, 2.4)
          .to(q(`[data-panel="${AF}"]`), { autoAlpha: 0, y: -12, duration: 0.4 }, 1.25)
          .to(q(`[data-panel="${FLAG}"]`), { autoAlpha: 1, y: 0, duration: 0.5 }, 1.6);
        for (const p of kept) {
          master.to(q(`[data-player="${p.id}"]`), { x: p.flag!.x, y: p.flag!.y, duration: 1.1, ease: "power3.inOut" }, 1.25);
        }
        master.addLabel(FLAG, 2.8).to({}, { duration: 0.3 });

        const flagAt = master.labels[FLAG];
        master.eventCallback("onUpdate", () => {
          const next = master.time() >= flagAt / 2 ? FLAG : AF;
          if (next !== activeRef.current) {
            activeRef.current = next;
            setActive(next);
          }
        });
        tl.current = master;

        if (desktop) {
          trigger.current = ScrollTrigger.create({
            trigger: el,
            start: "top top",
            end: "+=190%",
            pin: true,
            scrub: 0.6,
            animation: master,
            snap: { snapTo: "labels", duration: { min: 0.3, max: 0.8 }, delay: 0.15, ease: "power1.inOut" },
          });
        } else if (!reduce) {
          // Narrow screens: play it once when the field comes into view.
          trigger.current = ScrollTrigger.create({
            trigger: svg,
            start: "top 55%",
            once: true,
            onEnter: () => {
              gsap.delayedCall(0.6, () => {
                if (activeRef.current === AF && master.time() === 0) master.tweenTo(FLAG, { duration: 2.2, ease: "power1.inOut" });
              });
            },
          });
        }

        return () => {
          trigger.current = null;
          tl.current = null;
          activeRef.current = AF;
          setActive(AF);
        };
      });
    },
    { scope: root },
  );

  const select = (id: SportId) => {
    const master = tl.current;
    if (!master) return;
    const st = trigger.current;
    if (st && st.pin) {
      const target = st.labelToScroll(id);
      scrollToTarget(lenisRef.current, target);
      return;
    }
    if (window.matchMedia(MQ.reduce).matches) master.seek(id);
    else master.tweenTo(id, { duration: 1.6, ease: "power2.inOut" });
  };

  return (
    <div ref={root} className="container-page flex flex-col justify-center py-20 lg:min-h-[100svh] lg:py-8">
      <div className="grid items-end gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">{intro}</div>
        <div className="lg:col-span-4 lg:flex lg:justify-end">
          <SegmentedControl label={tabsLabel} value={active} onChange={select} options={sports.map((s) => ({ value: s.id, label: s.name }))} size="lg" />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-8">
          <div className="relative aspect-[5/7] overflow-hidden rounded-[var(--radius-panel)] shadow-[0_0_0_1px_var(--color-hairline-strong),0_40px_100px_-40px_rgb(0_0_0/0.9)] lg:aspect-[2.25/1]">
            <FieldSvg {...field} />
          </div>
          {legend}
        </div>
        <div className="grid lg:col-span-4">{panels}</div>
      </div>
    </div>
  );
}
