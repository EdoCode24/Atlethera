/**
 * The hero field, drawn in yards and seen from behind the near end zone.
 * x runs across the field (0–53⅓), y runs away from the viewer: the near end line
 * sits at y = 100, the goal line at y = 90, so the plane shows 80 of these yards at once
 * and scrolling can advance it 20 more.
 *
 * Both markings share one turf. American football and flag football lines are separate
 * layers so the sport switch can cross-fade them.
 */

const W = 160 / 3;
const HASH = 70.75 / 3;
const GOAL = 90;
const END = 100;

function yardLabel(y: number) {
  const fromGoal = GOAL - y;
  return fromGoal <= 50 ? fromGoal : 100 - fromGoal;
}

function americanFootballLines() {
  const yardLines: number[] = [];
  for (let y = GOAL - 5; y >= 0; y -= 5) yardLines.push(y);

  let hashes = "";
  for (let n = 1; n < GOAL; n++) {
    if (n % 5 === 0) continue;
    const y = GOAL - n;
    hashes += `M0.35 ${y}h0.66M${HASH - 0.66} ${y}h0.66M${W - HASH} ${y}h0.66M${W - 1.01} ${y}h0.66`;
  }

  const numbers = yardLines.filter((y) => (GOAL - y) % 10 === 0);

  return (
    <g className="field-af">
      <path d={hashes} stroke="currentColor" strokeWidth="0.11" opacity="0.55" />
      {yardLines.map((y) => (
        <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="currentColor" strokeWidth="0.13" opacity="0.62" />
      ))}
      {numbers.map((y) => {
        const label = yardLabel(y);
        const towardNear = GOAL - y < 50;
        const arrowY = towardNear ? y + 2.1 : y - 2.1;
        const tip = towardNear ? 0.55 : -0.55;
        return (
          <g key={`n${y}`} fill="currentColor" opacity="0.38">
            <text x="10" y={y} transform={`rotate(90 10 ${y})`} textAnchor="middle" dominantBaseline="central" fontSize="2.1" className="field-numeral">
              {label}
            </text>
            <text x={W - 10} y={y} transform={`rotate(-90 ${W - 10} ${y})`} textAnchor="middle" dominantBaseline="central" fontSize="2.1" className="field-numeral">
              {label}
            </text>
            {label !== 50 && (
              <>
                <path d={`M11.4 ${arrowY - tip}l0.45 ${tip * 2}h-0.9Z`} />
                <path d={`M${W - 11.4} ${arrowY - tip}l0.45 ${tip * 2}h-0.9Z`} />
              </>
            )}
          </g>
        );
      })}
      <line x1="0" x2={W} y1={GOAL} y2={GOAL} stroke="currentColor" strokeWidth="0.24" opacity="0.85" />
      <rect x="0" y="0" width={W} height={END} fill="none" stroke="currentColor" strokeWidth="0.45" opacity="0.8" />
      <rect x="0" y={GOAL} width={W} height={END - GOAL} fill="url(#hero-hatch)" opacity="0.5" />
      {[0, W].flatMap((x) =>
        [GOAL, END].map((y) => <rect key={`${x}-${y}`} x={x - 0.3} y={y - 0.3} width="0.6" height="0.6" fill="var(--color-signal)" opacity="0.9" />),
      )}
    </g>
  );
}

function flagFootballLines() {
  const x0 = (W - 25) / 2;
  const x1 = x0 + 25;
  const farGoal = GOAL - 50;
  const farEnd = farGoal - 10;
  const mid = GOAL - 25;
  // No-run zones: the 5 yards before each goal line and on both sides of midfield.
  const zones = [
    [GOAL - 5, GOAL],
    [mid, mid + 5],
    [mid - 5, mid],
    [farGoal, farGoal + 5],
  ];
  const lines = [GOAL - 5, mid + 5, mid - 5, farGoal + 5];

  return (
    <g className="field-flag">
      {zones.map(([a, b]) => (
        <rect key={a} x={x0} y={a} width="25" height={b - a} fill="url(#hero-hatch)" opacity="0.8" />
      ))}
      {lines.map((y) => (
        <line key={y} x1={x0} x2={x1} y1={y} y2={y} stroke="currentColor" strokeWidth="0.12" strokeDasharray="0.6 0.5" opacity="0.6" />
      ))}
      <line x1={x0} x2={x1} y1={mid} y2={mid} stroke="currentColor" strokeWidth="0.22" opacity="0.8" />
      <line x1={x0} x2={x1} y1={GOAL} y2={GOAL} stroke="currentColor" strokeWidth="0.24" opacity="0.85" />
      <line x1={x0} x2={x1} y1={farGoal} y2={farGoal} stroke="currentColor" strokeWidth="0.24" opacity="0.85" />
      <rect x={x0} y={farEnd} width="25" height={END - farEnd} fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.85" />
      {[x0, x1].flatMap((x) =>
        [GOAL, END, farGoal, farEnd].map((y) => (
          <rect key={`${x}-${y}`} x={x - 0.3} y={y - 0.3} width="0.6" height="0.6" fill="var(--color-signal)" opacity="0.9" />
        )),
      )}
    </g>
  );
}

export function FieldPlane() {
  const stripes: number[] = [];
  for (let y = 0; y < GOAL; y += 5) stripes.push(y);

  return (
    <svg viewBox={`0 0 ${W} ${END}`} preserveAspectRatio="none" aria-hidden="true" className="block size-full text-chalk">
      <defs>
        <pattern id="hero-hatch" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="0.22" height="1.2" fill="currentColor" opacity="0.28" />
        </pattern>
        <linearGradient id="hero-turf" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="var(--color-turf-700)" />
          <stop offset="1" stopColor="var(--color-turf-900)" />
        </linearGradient>
      </defs>
      <rect x="-6" y="0" width={W + 12} height={END} fill="url(#hero-turf)" />
      {stripes.map((y, i) => (i % 2 === 0 ? <rect key={y} x="-6" y={y} width={W + 12} height="5" fill="#fff" opacity="0.018" /> : null))}
      {americanFootballLines()}
      {flagFootballLines()}
    </svg>
  );
}
