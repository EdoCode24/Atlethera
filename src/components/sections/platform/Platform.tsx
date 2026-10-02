"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LogoMark } from "@/components/layout/Wordmark";
import { FieldTexture } from "@/components/ui/FieldTexture";
import { cn } from "@/lib/cn";
import { gsap, MQ } from "@/lib/gsap";
import { useDeferredGSAP } from "@/lib/use-deferred-gsap";

interface Tool {
  name: string;
  becomes: string;
}

interface PlatformProps {
  intro: ReactNode;
  tools: Tool[];
  counterFrom: string;
  counterTo: string;
  resultTitle: string;
  resultLine: string;
  resultBody: string;
  preview: TilePreviewData;
  faces: ToolFaces;
}

export interface TilePreviewData {
  week: string[];
  athlete: { initials: string; name: string; line: string };
  kcal: string;
  kcalUnit: string;
  macroShares: number[];
  clip: string;
}

/** Where each tool card sits around the profile on wide screens (percent of the stage). */
const scatter = [
  { x: -39, y: -33, r: -7 },
  { x: 38, y: -35, r: 6 },
  { x: -43, y: 5, r: 4 },
  { x: 42, y: 3, r: -5 },
  { x: -33, y: 38, r: -4 },
  { x: 34, y: 37, r: 7 },
];

const tileIcons: IconName[] = ["program", "athletes", "nutrition", "stats", "video", "playbook"];

export interface ToolFaces {
  sheetHead: string[];
  sheetRows: string[][];
  noteTitle: string;
  noteLines: string[];
  statsHead: string[];
  videoTitle: string;
}

const STAT_ROWS = [
  ["K. Demir", "6", "84", "1"],
  ["M. Aydın", "4", "52", "0"],
  ["E. Kaya", "3", "31", "1"],
];

/**
 * Each tool looks like the real thing a coach juggles today: its own colours, its own
 * chrome, nothing shared. The mismatch is the point; the Atlethera card that replaces them
 * is the one consistent surface.
 */
function ToolFace({ index, faces }: { index: number; faces: ToolFaces }) {
  switch (index) {
    case 0:
      // Spreadsheet: formula bar, lettered columns, a selected cell.
      return (
        <div className="overflow-hidden rounded-md bg-[#eef1ea] text-[0.58rem] text-[#1d2420]" aria-hidden="true">
          <div className="flex items-center gap-1.5 border-b border-[#cfd6cc] bg-[#dfe6dc] px-1.5 py-0.5 font-mono text-[0.55rem] text-[#3d4a42]">
            <span className="font-semibold italic">fx</span>
            <span>=C3*0,8</span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#1f6f43] text-[#f2f7f0]">
                <th className="w-3 border-r border-[#2d8656]" />
                {faces.sheetHead.map((h) => (
                  <th key={h} className="border-r border-[#2d8656] px-1 py-0.5 text-left font-semibold last:border-r-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {faces.sheetRows.map((row, r) => (
                <tr key={r} className="border-t border-[#cfd6cc]">
                  <td className="border-r border-[#cfd6cc] bg-[#dfe6dc] px-0.5 text-center text-[#5b6a60]">{r + 1}</td>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className={cn(
                        "border-r border-[#cfd6cc] px-1 py-0.5 last:border-r-0",
                        c > 0 && "tabular text-right",
                        r === 0 && c === 2 && "outline-[1.5px] -outline-offset-1 outline-[#1f6f43] outline",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 1:
      // Notes app: a yellow page with a handwritten-looking list.
      return (
        <div className="rounded-md bg-[#f6e7a6] px-2.5 py-2 text-[#3a3212]" aria-hidden="true">
          <p className="text-[0.62rem] font-bold">{faces.noteTitle}</p>
          <ul className="mt-1 space-y-0.5 text-[0.58rem] leading-snug">
            {faces.noteLines.map((line, i) => (
              <li key={line} className="flex items-center gap-1.5">
                <span className={cn("grid size-2.5 shrink-0 place-items-center rounded-[2px] border border-[#8a7a35]", i === 0 && "bg-[#8a7a35]")}>
                  {i === 0 && <Icon name="check" className="size-2 text-[#f6e7a6]" />}
                </span>
                <span className={cn(i === 0 && "line-through opacity-60")}>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case 2:
      // Calorie calculator: a display and a keypad.
      return (
        <div className="rounded-md bg-[#17191d] p-1.5" aria-hidden="true">
          <div className="rounded-[4px] bg-[#0b0c0e] px-2 py-1 text-right">
            <span className="tabular text-[0.85rem] font-semibold text-[#f5f6f8]">2.450</span>
            <span className="ml-1 text-[0.5rem] text-[#8c9098]">kcal</span>
          </div>
          <div className="mt-1 grid grid-cols-4 gap-[3px] text-center text-[0.55rem] font-semibold">
            {["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "="].map((k) => (
              <span key={k} className={cn("rounded-[3px] py-[2px]", /[÷×=]/.test(k) ? "bg-[#f08a24] text-white" : "bg-[#2b2e34] text-[#e6e8ec]")}>
                {k}
              </span>
            ))}
          </div>
        </div>
      );
    case 3:
      // Stats sheet: a plain table of numbers.
      return (
        <table className="w-full overflow-hidden rounded-md bg-[#f4f5f7] text-[0.56rem] text-[#20242b]" aria-hidden="true">
          <thead>
            <tr className="bg-[#2f4b8f] text-white">
              {faces.statsHead.map((h, i) => (
                <th key={h} className={cn("px-1 py-0.5 font-semibold", i === 0 ? "text-left" : "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STAT_ROWS.map((row) => (
              <tr key={row[0]} className="border-t border-[#dde1e8] odd:bg-white">
                {row.map((cell, i) => (
                  <td key={i} className={cn("px-1 py-0.5", i === 0 ? "text-left" : "tabular text-right")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 4:
      // Video player: a frame from the game, a scrubber and a clock.
      return (
        <div className="overflow-hidden rounded-md bg-black" aria-hidden="true">
          <div className="relative h-14 bg-[linear-gradient(180deg,#2e5a33,#1c3b21)]">
            <svg viewBox="0 0 120 42" preserveAspectRatio="none" className="absolute inset-0 size-full">
              {[10, 22, 34].map((y, i) => (
                <line key={y} x1={18 - i * 8} x2={102 + i * 8} y1={y} y2={y} stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.8" />
              ))}
              {[40, 50, 60, 70, 80].map((x, i) => (
                <circle key={x} cx={x} cy={22 + (i % 2) * 2} r="1.8" fill={i < 3 ? "#f2f2f2" : "#b33a3a"} />
              ))}
            </svg>
            <span className="absolute top-1 left-1.5 text-[0.5rem] font-semibold text-white/85">{faces.videoTitle}</span>
            <span className="absolute inset-0 m-auto grid size-5 place-items-center rounded-full bg-black/55">
              <Icon name="play" className="size-2.5 text-white" />
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-1.5 py-1">
            <span className="relative h-[3px] flex-1 rounded-full bg-white/25">
              <span className="absolute inset-y-0 left-0 w-[38%] rounded-full bg-white" />
            </span>
            <span className="tabular text-[0.5rem] text-white/70">18:22 / 48:30</span>
          </div>
        </div>
      );
    default:
      // Tactics whiteboard: marker Xs and Os, arrows in red.
      return (
        <svg viewBox="0 0 120 56" className="w-full rounded-md bg-[#f3f4f0]" aria-hidden="true">
          <line x1="4" y1="34" x2="116" y2="34" stroke="#9aa19a" strokeWidth="0.8" strokeDasharray="3 2.5" />
          {[
            [28, 40],
            [46, 40],
            [60, 40],
            [74, 40],
            [96, 40],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="3.4" fill="none" stroke="#1b1e22" strokeWidth="1.5" />
          ))}
          {[
            [34, 22],
            [60, 18],
            [90, 24],
          ].map(([x, y]) => (
            <path key={x} d={`M${x - 3} ${y - 3} l6 6 m0 -6 l-6 6`} stroke="#1b1e22" strokeWidth="1.6" strokeLinecap="round" />
          ))}
          <path d="M28 36 V14 H58" fill="none" stroke="#d23b2f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M55 11 L59 14 L55 17" fill="none" stroke="#d23b2f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M96 36 V22 L108 9" fill="none" stroke="#d23b2f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M60 36 C60 26 52 22 44 24" fill="none" stroke="#2750b8" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2.5 2" />
        </svg>
      );
  }
}

const weekColor: Record<string, string> = {
  strength: "bg-volt",
  speed: "bg-ice",
  conditioning: "bg-amber",
  recovery: "bg-chalk/25",
  rest: "bg-chalk/8",
};
const weekHeight: Record<string, string> = { strength: "h-9", speed: "h-7", conditioning: "h-8", recovery: "h-4", rest: "h-2" };
const macroColor = ["bg-volt", "bg-ice", "bg-amber"];

function TilePreview({ index, data }: { index: number; data: TilePreviewData }) {
  switch (index) {
    case 0:
      return (
        <div className="flex h-9 items-end gap-1" aria-hidden="true">
          {data.week.map((kind, i) => (
            <span key={i} className={`flex-1 rounded-[3px] ${weekColor[kind]} ${weekHeight[kind]}`} />
          ))}
        </div>
      );
    case 1:
      return (
        <div className="flex items-center gap-2">
          <span className="display grid size-8 shrink-0 place-items-center rounded-full bg-volt text-[0.8rem] text-night-950">{data.athlete.initials}</span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[0.74rem] font-semibold">{data.athlete.name}</span>
            <span className="block truncate text-[0.66rem] text-mist">{data.athlete.line}</span>
          </span>
        </div>
      );
    case 2:
      return (
        <div>
          <p className="display tabular text-[1.4rem] leading-none">
            {data.kcal}
            <span className="ml-1 font-sans text-[0.62rem] font-medium normal-case text-mist">{data.kcalUnit}</span>
          </p>
          <div className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {data.macroShares.map((share, i) => (
              <span key={i} className={macroColor[i]} style={{ flexGrow: share }} />
            ))}
          </div>
        </div>
      );
    case 3:
      return (
        <div className="flex h-9 items-end gap-1" aria-hidden="true">
          {[0.45, 0.6, 0.5, 0.75, 0.7, 0.95].map((h, i) => (
            <span key={i} className={`flex-1 rounded-t-[3px] ${i === 5 ? "bg-volt" : "bg-chalk/25"}`} style={{ height: `${h * 100}%` }} />
          ))}
        </div>
      );
    case 4:
      return (
        <div>
          <div className="relative h-1.5 rounded-full bg-chalk/12" aria-hidden="true">
            <span className="absolute inset-y-0 left-0 w-[46%] rounded-full bg-chalk/40" />
            <span className="absolute top-1/2 left-[46%] -mt-1 -ml-1 size-2 rounded-full bg-volt" />
          </div>
          <p className="mt-2 truncate text-[0.66rem] text-mist">{data.clip}</p>
        </div>
      );
    default:
      return (
        <svg viewBox="0 0 120 44" className="h-9 w-full" aria-hidden="true">
          <line x1="0" y1="30" x2="120" y2="30" stroke="rgb(242 244 237 / 0.25)" strokeDasharray="3 3" />
          {[26, 46, 60, 74, 94].map((x) => (
            <circle key={x} cx={x} cy="33" r="3.2" fill="var(--color-night-950)" stroke="var(--color-chalk)" strokeWidth="1.3" />
          ))}
          <path d="M26 30 V14 H70" fill="none" stroke="var(--color-volt)" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M94 30 V16 L110 6" fill="none" stroke="var(--color-volt)" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M60 30 C60 20 50 16 40 18" fill="none" stroke="var(--color-chalk)" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
  }
}

export function Platform({ intro, tools, counterFrom, counterTo, resultTitle, resultLine, resultBody, preview, faces }: PlatformProps) {
  const root = useRef<HTMLDivElement>(null);

  useDeferredGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const stage = el.querySelector<HTMLElement>("[data-stage]")!;
      const cards = gsap.utils.toArray<HTMLElement>("[data-tool]", el);
      const result = el.querySelector<HTMLElement>("[data-result]");
      const tiles = gsap.utils.toArray<HTMLElement>("[data-tile]", el);
      const count = el.querySelector<HTMLElement>("[data-count]");
      const mm = gsap.matchMedia();

      mm.add(MQ.desktop, () => {
        const proxy = { n: 6 };
        gsap.set(cards, { rotation: (i) => scatter[i].r });
        gsap.set(result, { clipPath: "inset(46% 44% 46% 44% round 22px)", scale: 0.9, autoAlpha: 0 });
        gsap.set(tiles, { autoAlpha: 0, y: 8 });
        gsap.set("[data-count-from]", { autoAlpha: 1 });
        gsap.set("[data-count-to]", { autoAlpha: 0 });

        gsap
          .timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: el,
              start: "top top",
              end: "+=110%",
              pin: true,
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          })
          .to(
            cards,
            {
              x: (_, card: HTMLElement) => stage.offsetWidth / 2 - (card.offsetLeft + card.offsetWidth / 2),
              y: (_, card: HTMLElement) => stage.offsetHeight / 2 - (card.offsetTop + card.offsetHeight / 2),
              rotation: 0,
              scale: 0.32,
              ease: "power2.in",
              duration: 0.5,
              stagger: 0.035,
            },
            0,
          )
          .to(cards, { autoAlpha: 0, duration: 0.08, stagger: 0.035 }, 0.44)
          .set(result, { autoAlpha: 1 }, 0.44)
          .to(result, { clipPath: "inset(0% 0% 0% 0% round 22px)", scale: 1, ease: "power3.out", duration: 0.32 }, 0.46)
          .to(tiles, { autoAlpha: 1, y: 0, duration: 0.08, stagger: 0.03 }, 0.5)
          .to(
            proxy,
            {
              n: 1,
              duration: 0.62,
              onUpdate: () => {
                if (count) count.textContent = String(Math.round(proxy.n));
              },
            },
            0,
          )
          .to("[data-count-from]", { autoAlpha: 0, duration: 0.05 }, 0.6)
          .to("[data-count-to]", { autoAlpha: 1, duration: 0.05 }, 0.62)
          .to({}, { duration: 0.15 });

        return () => {
          if (count) count.textContent = "1";
        };
      });

      mm.add(MQ.compact, () => {
        gsap.from(cards, {
          y: 30,
          autoAlpha: 0,
          duration: 0.8,
          stagger: 0.06,
          scrollTrigger: { trigger: stage, start: "top 80%", once: true },
        });
        gsap.from(result, {
          clipPath: "inset(30% 20% 30% 20% round 22px)",
          duration: 1.1,
          ease: "expo.out",
          scrollTrigger: { trigger: result, start: "top 85%", once: true },
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="container-page relative grid min-h-[100svh] items-center gap-x-10 gap-y-14 py-24 lg:grid-cols-12 lg:py-16">
      <div aria-hidden="true" className="platform-ground pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden">
        <FieldTexture />
      </div>
      <div className="lg:col-span-5">
        {intro}
        <div className="mt-10 flex items-end gap-4" aria-hidden="true">
          <span data-count className="display tabular text-[clamp(5rem,3rem+6vw,8.5rem)] leading-[0.8] text-volt">
            1
          </span>
          <span className="relative mb-2 block text-[0.95rem] text-chalk-dim">
            <span data-count-from className="absolute bottom-0 left-0 whitespace-nowrap opacity-0">
              {counterFrom}
            </span>
            <span data-count-to className="whitespace-nowrap">
              {counterTo}
            </span>
          </span>
        </div>
      </div>

      <div className="lg:col-span-7">
        <div data-stage className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 lg:block lg:h-[40rem]">
          {tools.map((tool, i) => (
            <div
              key={tool.name}
              data-tool
              className="platform-tool rounded-[var(--radius-card)] bg-night-800 p-4 shadow-[0_0_0_1px_var(--color-hairline-strong),0_20px_40px_-20px_rgb(0_0_0/0.9)]"
              style={{ "--x": `${scatter[i].x}%`, "--y": `${scatter[i].y}%` } as CSSProperties}
            >
              <p className="mb-2.5 text-[0.76rem] font-semibold text-chalk-dim">{tool.name}</p>
              <ToolFace index={i} faces={faces} />
            </div>
          ))}

          <div className="col-span-2 mt-4 sm:col-span-3 lg:pointer-events-none lg:absolute lg:inset-0 lg:mt-0 lg:flex lg:items-center lg:justify-center">
          <div
            data-result
            className="rounded-[1.4rem] bg-night-800 p-5 shadow-[0_0_0_1px_var(--color-hairline-strong),0_40px_80px_-30px_rgb(0_0_0/0.9)] sm:p-6 lg:pointer-events-auto lg:w-[min(38rem,100%)]"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-night-950 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]">
                <LogoMark className="size-7" />
              </span>
              <div>
                <p className="display text-[1.35rem] leading-none tracking-[0.03em]">{resultTitle}</p>
                <p className="mt-1 text-[0.8rem] text-mist">{resultLine}</p>
              </div>
            </div>
            <p className="mt-4 text-[0.85rem] text-chalk-dim">{resultBody}</p>
            <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {tools.map((tool, i) => (
                <li key={tool.becomes} data-tile className="flex min-h-[8rem] flex-col rounded-xl bg-night-900 p-3 shadow-[inset_0_0_0_1px_var(--color-hairline)]">
                  <p className="flex items-center gap-1.5 text-[0.76rem] font-semibold">
                    <Icon name={tileIcons[i]} className="size-4 text-volt" />
                    {tool.becomes}
                  </p>
                  <div className="mt-auto pt-3">
                    <TilePreview index={i} data={preview} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
