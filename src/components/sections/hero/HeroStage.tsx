"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { HeroPlay } from "@/content/hero-plays";
import type { SportId } from "@/domain/sports/types";
import { fill } from "@/lib/fill";
import { gsap, MQ } from "@/lib/gsap";
import { useDeferredGSAP } from "@/lib/use-deferred-gsap";
import { FieldPlane } from "./FieldPlane";
import { HeroPlaybook, type HeroPlaybookCopy } from "./HeroPlaybook";
import { StadiumLights } from "./StadiumLights";

export interface HeroSportView {
  id: SportId;
  name: string;
  play: HeroPlay;
  playName: string;
  note: string;
}

export interface HeroStageCopy {
  sportLabel: string;
  switchHint: string;
  announce: string;
  preview: HeroPlaybookCopy;
}

interface HeroStageProps {
  children: ReactNode;
  copy: HeroStageCopy;
  views: HeroSportView[];
}

export function HeroStage({ children, copy, views }: HeroStageProps) {
  const [sport, setSport] = useState<SportId>(views[0].id);
  const root = useRef<HTMLDivElement>(null);
  const view = views.find((v) => v.id === sport) ?? views[0];

  // Pointer depth and the scroll-linked drive down the field.
  useDeferredGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const mover = el.querySelector("[data-field-mover]");
      gsap.set(mover, { yPercent: -20, y: 0 });

      const mm = gsap.matchMedia();

      mm.add(MQ.finePointer, () => {
        const tilt = el.querySelector("[data-tilt]");
        const rx = gsap.quickTo(tilt, "rotationX", { duration: 0.9, ease: "power3" });
        const ry = gsap.quickTo(tilt, "rotationY", { duration: 0.9, ease: "power3" });
        const layers = gsap.utils.toArray<HTMLElement>("[data-depth]", el).map((node) => {
          const depth = Number(node.dataset.depth ?? 1);
          return {
            depth,
            x: gsap.quickTo(node, "x", { duration: 1, ease: "power3" }),
            y: gsap.quickTo(node, "y", { duration: 1, ease: "power3" }),
          };
        });
        const move = (event: PointerEvent) => {
          const nx = event.clientX / window.innerWidth - 0.5;
          const ny = event.clientY / window.innerHeight - 0.5;
          ry(nx * 9);
          rx(-ny * 6);
          for (const layer of layers) {
            layer.x(nx * 22 * layer.depth);
            layer.y(ny * 16 * layer.depth);
          }
        };
        el.addEventListener("pointermove", move);
        return () => el.removeEventListener("pointermove", move);
      });

      mm.add(MQ.desktop, () => {
        gsap
          .timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true } })
          .to(mover, { yPercent: 0 }, 0)
          .to("[data-hero-copy]", { yPercent: -14, autoAlpha: 0.2 }, 0)
          .to("[data-mock-scroll]", { y: -90, rotationX: 8 }, 0)
          .to("[data-beams]", { autoAlpha: 0.35 }, 0);
      });

      mm.add(MQ.compact, () => {
        gsap.to(mover, { yPercent: 0, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true } });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} data-sport={sport} className="hero relative isolate flex min-h-[100svh] flex-col justify-center overflow-clip pt-28 pb-20 lg:pb-28">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-sky" />
        <div className="field-scene">
          <div className="field-plane">
            <div data-field-mover className="field-mover">
              <div className="field-enter size-full">
                <FieldPlane />
              </div>
            </div>
          </div>
        </div>
        <div className="hero-vignette" />
        <StadiumLights />
      </div>

      <div className="container-page grid items-center gap-x-10 gap-y-14 lg:grid-cols-12">
        <div data-hero-copy className="relative lg:col-span-6">
          {children}
        </div>

        <div className="relative lg:col-span-6">
          <div className="hero-fade mb-6 flex flex-col items-start gap-2.5" style={{ "--d": "0.85s" } as CSSProperties}>
            <SegmentedControl
              label={copy.sportLabel}
              value={sport}
              onChange={setSport}
              options={views.map((v) => ({ value: v.id, label: v.name }))}
            />
            <p className="text-[0.82rem] leading-snug text-mist">{copy.switchHint}</p>
          </div>
          <p aria-live="polite" className="sr-only">
            {fill(copy.announce, { sport: view.name })}
          </p>

          <div className="mock-stage">
            <div data-mock-scroll>
              <div data-tilt className="mock-tilt">
                <div className="mock-enter">
                  <div className="mock-rest">
                    <HeroPlaybook
                      sport={view.id}
                      play={view.play}
                      playName={view.playName}
                      note={view.note}
                      copy={{ ...copy.preview, label: fill(copy.preview.label, { play: view.playName }) }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
