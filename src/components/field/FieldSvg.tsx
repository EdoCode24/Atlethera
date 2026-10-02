import type { LabelAnchor } from "@/domain/sports/types";

/**
 * Top-down fields in yards. The American football field fills the viewBox
 * (0–120 × 0–53⅓); the flag field is drawn at true scale inside it, centred, so a
 * viewBox tween can zoom from one to the other. Offense attacks to the right.
 */

export const AF_LENGTH = 120;
export const AF_WIDTH = 160 / 3;
const HASH = 70.75 / 3;

export const FLAG_LENGTH = 70;
export const FLAG_WIDTH = 25;
export const FLAG_OFFSET = { x: (AF_LENGTH - FLAG_LENGTH) / 2, y: (AF_WIDTH - FLAG_WIDTH) / 2 };

export const VIEWBOX_AF = `0 0 ${AF_LENGTH} ${AF_WIDTH.toFixed(3)}`;
/** The flag field plus a margin, at the same 2.25 aspect as the full field. */
export const VIEWBOX_FLAG = `22 ${(AF_WIDTH / 2 - 76 / 2.25 / 2).toFixed(3)} 76 ${(76 / 2.25).toFixed(3)}`;
/** A portrait crop around the line of scrimmage, used on narrow screens for both sports. */
export const VIEWBOX_COMPACT = `32 ${(AF_WIDTH / 2 - 21).toFixed(3)} 30 42`;

export interface FieldPlayer {
  id: string;
  side: "offense" | "defense";
  x: number;
  y: number;
  label: string;
  labelAt?: LabelAnchor;
  minorLabel?: boolean;
  /** Present when this player stays for the flag formation. */
  flag?: { x: number; y: number; label: string; labelAt?: LabelAnchor };
}

const LABEL_OFFSETS: Record<LabelAnchor, { dx: number; dy: number; anchor: "start" | "middle" | "end" }> = {
  top: { dx: 0, dy: -1.55, anchor: "middle" },
  bottom: { dx: 0, dy: 2.25, anchor: "middle" },
  left: { dx: -1.35, dy: 0.5, anchor: "end" },
  right: { dx: 1.35, dy: 0.5, anchor: "start" },
};

function Label({ text, at = "top", className, x = 0, y = 0 }: { text: string; at?: LabelAnchor; className?: string; x?: number; y?: number }) {
  const o = LABEL_OFFSETS[at];
  return (
    <text x={x + o.dx} y={y + o.dy} textAnchor={o.anchor} className={className}>
      {text}
    </text>
  );
}

function AmericanFootballMarkings() {
  const lines: number[] = [];
  for (let x = 15; x <= 105; x += 5) lines.push(x);
  let hashes = "";
  for (let x = 11; x < 110; x++) {
    if (x % 5 === 0) continue;
    hashes += `M${x} 0.35v0.66M${x} ${HASH - 0.66}v0.66M${x} ${AF_WIDTH - HASH}v0.66M${x} ${AF_WIDTH - 1.01}v0.66`;
  }
  const numbers = [20, 30, 40, 50, 60, 70, 80, 90, 100];

  return (
    <g data-af-lines>
      <rect x="0" y="0" width="10" height={AF_WIDTH} fill="url(#fld-hatch)" opacity="0.35" />
      <rect x="110" y="0" width="10" height={AF_WIDTH} fill="url(#fld-hatch)" opacity="0.35" />
      <path d={hashes} stroke="currentColor" strokeWidth="0.12" opacity="0.5" />
      {lines.map((x) => (
        <line key={x} x1={x} x2={x} y1="0" y2={AF_WIDTH} stroke="currentColor" strokeWidth="0.14" opacity={x % 10 === 0 ? 0.5 : 0.3} />
      ))}
      <line x1="10" x2="10" y1="0" y2={AF_WIDTH} stroke="currentColor" strokeWidth="0.3" opacity="0.8" />
      <line x1="110" x2="110" y1="0" y2={AF_WIDTH} stroke="currentColor" strokeWidth="0.3" opacity="0.8" />
      {numbers.map((x) => {
        const label = String(x <= 60 ? x - 10 : 110 - x);
        return (
          <g key={x} className="field-numeral" fill="currentColor" opacity="0.2" fontSize="2.3">
            <text x={x} y={AF_WIDTH - 9.6} textAnchor="middle">
              {label}
            </text>
            <text x={x} y={9.6} textAnchor="middle" transform={`rotate(180 ${x} ${8.85})`}>
              {label}
            </text>
          </g>
        );
      })}
      <rect data-draw x="0" y="0" width={AF_LENGTH} height={AF_WIDTH} fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.85" />
    </g>
  );
}

function FlagMarkings() {
  const { x: ox, y: oy } = FLAG_OFFSET;
  const zones = [
    [10, 15],
    [30, 35],
    [35, 40],
    [55, 60],
  ];
  return (
    <g data-flag-lines>
      {zones.map(([a, b]) => (
        <rect key={a} data-no-run x={ox + a} y={oy} width={b - a} height={FLAG_WIDTH} fill="url(#fld-hatch-volt)" />
      ))}
      <line data-draw x1={ox + 10} x2={ox + 10} y1={oy} y2={oy + FLAG_WIDTH} stroke="currentColor" strokeWidth="0.3" />
      <line data-draw x1={ox + 60} x2={ox + 60} y1={oy} y2={oy + FLAG_WIDTH} stroke="currentColor" strokeWidth="0.3" />
      <line data-draw x1={ox + 35} x2={ox + 35} y1={oy} y2={oy + FLAG_WIDTH} stroke="currentColor" strokeWidth="0.26" />
      <rect data-draw x={ox} y={oy} width={FLAG_LENGTH} height={FLAG_WIDTH} fill="none" stroke="var(--color-volt)" strokeWidth="0.45" />
    </g>
  );
}

interface FieldSvgProps {
  players: FieldPlayer[];
  losX: number;
  labels: { afSize: string; flagSize: string; los: string; noRun: string; rushLine: string };
  groupLabels: { x: number; y: number; text: string }[];
  ariaLabel: string;
}

export function FieldSvg({ players, losX, labels, groupLabels, ariaLabel }: FieldSvgProps) {
  const { x: ox, y: oy } = FLAG_OFFSET;
  const rushX = losX + 7;

  return (
    <svg data-field viewBox={VIEWBOX_AF} role="img" aria-label={ariaLabel} className="block size-full text-chalk" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="fld-hatch" width="1.1" height="1.1" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="0.2" height="1.1" fill="currentColor" opacity="0.4" />
        </pattern>
        <pattern id="fld-hatch-volt" width="1.1" height="1.1" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="0.26" height="1.1" fill="var(--color-volt)" opacity="0.28" />
        </pattern>
        <linearGradient id="fld-turf" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--color-turf-800)" />
          <stop offset="1" stopColor="var(--color-turf-900)" />
        </linearGradient>
      </defs>

      <rect x="-40" y="-40" width={AF_LENGTH + 80} height={AF_WIDTH + 80} fill="var(--color-night-900)" />
      <rect x="0" y="0" width={AF_LENGTH} height={AF_WIDTH} fill="url(#fld-turf)" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={10 * i} y="0" width="5" height={AF_WIDTH} fill="#fff" opacity="0.018" />
      ))}

      <AmericanFootballMarkings />
      <FlagMarkings />

      <line data-los x1={losX} x2={losX} y1="0" y2={AF_WIDTH} stroke="var(--color-volt)" strokeWidth="0.22" strokeDasharray="0.8 0.6" opacity="0.8" />
      <line data-rush x1={rushX} x2={rushX} y1={oy} y2={oy + FLAG_WIDTH} stroke="var(--color-signal)" strokeWidth="0.2" strokeDasharray="0.6 0.5" />

      <g className="field-caption" fontSize="1.5" fill="currentColor">
        <text data-af-caption x="11" y="2.4" opacity="0.7">
          {labels.afSize}
        </text>
        <text data-flag-caption x={ox + 0.4} y={oy - 1} fill="var(--color-volt)">
          {labels.flagSize}
        </text>
        <text data-rush-caption x={rushX} y={oy + FLAG_WIDTH + 1.7} textAnchor="middle" fill="var(--color-signal)" fontSize="1.2">
          {labels.rushLine}
        </text>
        <text data-no-run-caption x={ox + 35} y={oy - 1} textAnchor="middle" fontSize="1.2" fill="var(--color-volt)" opacity="0.8">
          {labels.noRun}
        </text>
      </g>

      <g data-group-labels className="field-caption" fontSize="1.35" fill="currentColor" opacity="0.75">
        {groupLabels.map((g) => (
          <text key={g.text} x={g.x} y={g.y} textAnchor="middle">
            {g.text}
          </text>
        ))}
      </g>

      {players.map((p) => (
        <g key={p.id} data-player={p.id} data-keeps={p.flag ? "true" : undefined} transform={`translate(${p.x} ${p.y})`}>
          <circle
            r="0.85"
            fill={p.side === "offense" ? "var(--color-volt)" : "var(--color-night-950)"}
            stroke={p.side === "offense" ? "none" : "var(--color-chalk)"}
            strokeWidth="0.28"
          />
          {!p.minorLabel && <Label text={p.label} at={p.labelAt} className="field-player-label field-label-af" />}
          {p.flag && <Label text={p.flag.label} at={p.flag.labelAt} className="field-player-label field-label-flag" />}
        </g>
      ))}
    </svg>
  );
}
