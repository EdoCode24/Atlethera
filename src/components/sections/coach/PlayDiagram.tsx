/**
 * "Trips Right — Mesh" in yards: x across the field (0–53⅓), y down the page with the
 * line of scrimmage at y = 24 and the offense moving up. Arrowheads are separate paths
 * so they can appear when a route finishes drawing.
 *
 * This is a static diagram for now; the interactive playbook's drawing rules will
 * replace it once they are specified.
 */

type Point = [number, number];

interface Route {
  id: string;
  points: Point[];
  /** Cubic smoothing for curved routes. */
  curve?: boolean;
}

const LOS = 24;

const line: { id: string; x: number; center?: boolean }[] = [
  { id: "lt", x: 22.9 },
  { id: "lg", x: 24.8 },
  { id: "c", x: 26.67, center: true },
  { id: "rg", x: 28.55 },
  { id: "rt", x: 30.45 },
];

const skill: { id: string; label: string; x: number; y: number }[] = [
  { id: "x", label: "X", x: 5, y: LOS + 0.6 },
  { id: "y", label: "Y", x: 36.5, y: LOS + 1.8 },
  { id: "h", label: "H", x: 42.5, y: LOS + 1.8 },
  { id: "z", label: "Z", x: 49, y: LOS + 0.6 },
  { id: "qb", label: "QB", x: 26.67, y: LOS + 5.5 },
  { id: "rb", label: "RB", x: 29.2, y: LOS + 5.5 },
];

export const routes: Route[] = [
  { id: "x", points: [[5, LOS - 0.4], [6.5, 18.2], [40, 17.6]] },
  { id: "y", points: [[36.5, LOS + 0.8], [35, 19.2], [11, 18.8]] },
  { id: "h", points: [[42.5, LOS + 0.8], [39, 12.6], [37.2, 14]] },
  { id: "z", points: [[49, LOS - 0.4], [49, 13.5], [52, 7.5]] },
  { id: "rb", points: [[29.2, LOS + 5], [20, 27.5], [13, 24.8]], curve: true },
];

function toPath({ points, curve }: Route): string {
  const [first, ...rest] = points;
  if (curve && rest.length === 2) {
    const [c, end] = rest;
    return `M${first[0]} ${first[1]}Q${c[0]} ${c[1]} ${end[0]} ${end[1]}`;
  }
  return `M${first[0]} ${first[1]}` + rest.map(([x, y]) => `L${x} ${y}`).join("");
}

function arrowHead(route: Route): string {
  const pts = route.points;
  const [x2, y2] = pts[pts.length - 1];
  const [x1, y1] = pts[pts.length - 2];
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 1.3;
  const spread = 0.5;
  const a = [x2 - size * Math.cos(angle - spread), y2 - size * Math.sin(angle - spread)];
  const b = [x2 - size * Math.cos(angle + spread), y2 - size * Math.sin(angle + spread)];
  return `M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${x2} ${y2}L${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
}

export function PlayDiagram({ ariaLabel }: { ariaLabel?: string }) {
  const a11y = ariaLabel ? { role: "img", "aria-label": ariaLabel } : { "aria-hidden": true as const };
  return (
    <svg viewBox="0 4 53.33 30" {...a11y} className="block w-full">
      {[9, 14, 19].map((y) => (
        <line key={y} x1="0" x2="53.33" y1={y} y2={y} stroke="var(--color-chalk)" strokeWidth="0.08" opacity="0.14" />
      ))}
      <line x1="0" x2="53.33" y1={LOS} y2={LOS} stroke="var(--color-volt)" strokeWidth="0.14" strokeDasharray="0.6 0.5" opacity="0.7" />

      {routes.map((r) => (
        <g key={r.id} data-route={r.id}>
          <path data-route-line d={toPath(r)} fill="none" stroke="var(--color-volt)" strokeWidth="0.42" strokeLinecap="round" strokeLinejoin="round" />
          <path data-route-head d={arrowHead(r)} fill="none" stroke="var(--color-volt)" strokeWidth="0.42" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}

      {line.map((p) =>
        p.center ? (
          <rect key={p.id} data-player x={p.x - 0.75} y={LOS + 0.15} width="1.5" height="1.5" rx="0.15" fill="var(--color-night-950)" stroke="var(--color-chalk)" strokeWidth="0.25" />
        ) : (
          <circle key={p.id} data-player cx={p.x} cy={LOS + 0.9} r="0.75" fill="var(--color-night-950)" stroke="var(--color-chalk)" strokeWidth="0.25" />
        ),
      )}
      {skill.map((p) => (
        <g key={p.id} data-player>
          <circle cx={p.x} cy={p.y} r="0.85" fill="var(--color-night-950)" stroke="var(--color-volt)" strokeWidth="0.3" />
          <text x={p.x} y={p.y + 2.5} textAnchor="middle" className="field-player-label" style={{ fontSize: "1.25px" }}>
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
