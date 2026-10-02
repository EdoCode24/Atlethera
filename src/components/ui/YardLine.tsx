import { cn } from "@/lib/cn";

interface YardLineProps {
  yard: number;
  /** Which goal line is nearer, as on a real field's direction arrows. Null at midfield. */
  toward: "up" | "down" | null;
  className?: string;
}

function Arrow({ toward }: { toward: "up" | "down" }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className={cn("size-[0.28em]", toward === "down" && "rotate-180")}>
      <path d="M5 1 9 9H1Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Each section starts on a painted yard line with its number at both sidelines.
 * Scrolling the page is a drive: 10 → 50 → 10, then the end zone.
 */
function Numeral({ yard, toward }: Pick<YardLineProps, "yard" | "toward">) {
  return (
    <span className="display flex flex-col items-center gap-[0.12em] text-[clamp(2.25rem,1.4rem+1.5vw,3.5rem)] leading-none text-chalk/[0.1]">
      {toward === "up" && <Arrow toward="up" />}
      <span className="[writing-mode:vertical-rl]">{yard}</span>
      {toward === "down" && <Arrow toward="down" />}
    </span>
  );
}

const flipped = { up: "down", down: "up" } as const;

export function YardLine({ yard, toward, className }: YardLineProps) {

  return (
    <div aria-hidden="true" className={cn("pointer-events-none relative", className)}>
      <div className="yard-line" />
      <div className="absolute inset-x-0 top-5 hidden justify-between px-2 min-[1360px]:flex">
        <Numeral yard={yard} toward={toward} />
        {/* The far sideline's numbers face the other way; its arrow still points at the same goal. */}
        <span className="rotate-180">
          <Numeral yard={yard} toward={toward && flipped[toward]} />
        </span>
      </div>
    </div>
  );
}
