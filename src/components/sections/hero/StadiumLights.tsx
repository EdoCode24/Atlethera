import type { CSSProperties } from "react";

const LAMPS = Array.from({ length: 15 }, (_, i) => i);

/**
 * The cone of light a bank throws, in units of the bank's width: 15 wide, 22 long. The cone
 * leaves the lamps exactly as wide as the bank (x 70–80) and opens toward the field. A soft
 * outer cone and a brighter core, both fading with distance and blurred at the edges.
 */
function Beam({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 150 220" preserveAspectRatio="none" aria-hidden="true" className="beam">
      <defs>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-flood)" stopOpacity="0.3" />
          <stop offset="0.35" stopColor="var(--color-flood)" stopOpacity="0.13" />
          <stop offset="1" stopColor="var(--color-flood)" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-soft`} x="-20%" y="-5%" width="140%" height="110%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      <g filter={`url(#${id}-soft)`}>
        <polygon points="70,0 80,0 142,220 8,220" fill={`url(#${id}-fade)`} opacity="0.75" />
        <polygon points="72,0 78,0 108,220 42,220" fill={`url(#${id}-fade)`} opacity="0.6" />
      </g>
    </svg>
  );
}

/**
 * A light tower: a bank of lamps and the light it throws. The beam is a child of the bank,
 * so it always starts at the lamp face and turns with it.
 */
function LampBank({ side }: { side: "left" | "right" }) {
  return (
    <div className={`lamp-bank lamp-bank--${side}`}>
      <div data-beams className="beam-wrap">
        <Beam id={`beam-${side}`} />
      </div>
      <div className="lamp-halo" />
      <div className="lamp-grid">
        {LAMPS.map((i) => (
          <span key={i} className="lamp" style={{ "--i": side === "left" ? i : 14 - i } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}

/** Two stadium light towers switching on, and the light they throw on the field. */
export function StadiumLights() {
  return (
    <>
      <LampBank side="left" />
      <LampBank side="right" />
    </>
  );
}
