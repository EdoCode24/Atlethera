import type { CornerStyle, EndStyle, PlayerSpot, Route, Vec } from "./types";

/** Radius used to round a route corner, in yards, before clipping to the segment lengths. */
export const CORNER_RADIUS = 2.5;

export type Seg = { kind: "L"; to: Vec } | { kind: "Q"; c: Vec; to: Vec };

export interface PathShape {
  start: Vec;
  segs: Seg[];
}

export interface Sampled {
  pts: Vec[];
  /** Cumulative distance to each point. */
  cum: number[];
  length: number;
}

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

export function norm(v: Vec): Vec {
  const len = Math.hypot(v.x, v.y);
  return len === 0 ? { x: 0, y: 1 } : { x: v.x / len, y: v.y / len };
}

/** Left-hand normal of a direction. */
export const perp = (v: Vec): Vec => ({ x: -v.y, y: v.x });

export function routeVertices(start: Vec, route: Route): Vec[] {
  return [start, ...route.points];
}

/**
 * Straight segments for a sharp route; for a rounded one every inner corner becomes a
 * quadratic curve whose control point is the corner itself. `sharpFirst` keeps the first corner
 * sharp: a motion ends there, on the spot the coach set, and the route after the snap leaves it.
 */
export function buildPath(vertices: Vec[], corners: CornerStyle, sharpFirst = false): PathShape {
  const [start, ...rest] = vertices;
  if (corners === "sharp" || vertices.length < 3) {
    return { start, segs: rest.map((to) => ({ kind: "L", to })) };
  }
  const segs: Seg[] = [];
  for (let i = 1; i < vertices.length - 1; i++) {
    const prev = vertices[i - 1];
    const cur = vertices[i];
    const next = vertices[i + 1];
    if (i === 1 && sharpFirst) {
      segs.push({ kind: "L", to: cur });
      continue;
    }
    const d = Math.min(CORNER_RADIUS, 0.45 * dist(prev, cur), 0.45 * dist(cur, next));
    const a = sub(cur, scale(norm(sub(cur, prev)), d));
    const b = add(cur, scale(norm(sub(next, cur)), d));
    segs.push({ kind: "L", to: a }, { kind: "Q", c: cur, to: b });
  }
  segs.push({ kind: "L", to: vertices[vertices.length - 1] });
  return { start, segs };
}

/** SVG path data. `map` turns yards into drawing coordinates. */
export function toSvgD(shape: PathShape, map: (v: Vec) => Vec): string {
  const f = (v: Vec) => {
    const m = map(v);
    return `${m.x.toFixed(3)} ${m.y.toFixed(3)}`;
  };
  let d = `M${f(shape.start)}`;
  for (const s of shape.segs) d += s.kind === "L" ? `L${f(s.to)}` : `Q${f(s.c)} ${f(s.to)}`;
  return d;
}

export function polylineD(points: Vec[], map: (v: Vec) => Vec): string {
  return points
    .map((p, i) => {
      const m = map(p);
      return `${i === 0 ? "M" : "L"}${m.x.toFixed(3)} ${m.y.toFixed(3)}`;
    })
    .join("");
}

const quad = (p0: Vec, c: Vec, p1: Vec, t: number): Vec => {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y };
};

/** Points along the path, about `step` yards apart, with running distances. */
export function sample(shape: PathShape, step = 0.15): Sampled {
  const pts: Vec[] = [shape.start];
  let from = shape.start;
  for (const s of shape.segs) {
    if (s.kind === "L") {
      const n = Math.max(1, Math.ceil(dist(from, s.to) / step));
      for (let i = 1; i <= n; i++) pts.push(add(from, scale(sub(s.to, from), i / n)));
    } else {
      const approx = dist(from, s.c) + dist(s.c, s.to);
      const n = Math.max(2, Math.ceil(approx / step));
      for (let i = 1; i <= n; i++) pts.push(quad(from, s.c, s.to, i / n));
    }
    from = s.to;
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  return { pts, cum, length: cum[cum.length - 1] };
}

/** Position and heading at a distance along the path, clamped to its ends. */
export function pointAt(s: Sampled, d: number): { p: Vec; dir: Vec } {
  if (s.pts.length === 1) return { p: s.pts[0], dir: { x: 0, y: 1 } };
  const target = Math.max(0, Math.min(s.length, d));
  let lo = 0;
  let hi = s.cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (s.cum[mid] <= target) lo = mid;
    else hi = mid;
  }
  const span = s.cum[hi] - s.cum[lo] || 1;
  const t = (target - s.cum[lo]) / span;
  return { p: add(s.pts[lo], scale(sub(s.pts[hi], s.pts[lo]), t)), dir: norm(sub(s.pts[hi], s.pts[lo])) };
}

/**
 * A zigzag laid over the path, used to mark pre-snap motion. It stops `tail` yards short of
 * the end and finishes straight, so the end marker sits on a clean line.
 */
export function zigzag(s: Sampled, amplitude = 0.42, wavelength = 1.1, tail = 1.1): Vec[] {
  if (s.length <= tail + wavelength / 2) return [s.pts[0], s.pts[s.pts.length - 1]];
  const out: Vec[] = [s.pts[0]];
  const half = wavelength / 2;
  let side = 1;
  for (let d = half; d < s.length - tail; d += half) {
    const { p, dir } = pointAt(s, d);
    out.push(add(p, scale(perp(dir), amplitude * side)));
    side = -side;
  }
  out.push(pointAt(s, s.length - tail).p, s.pts[s.pts.length - 1]);
  return out;
}

/** Length of an arrowhead at size 1, in yards. */
const ARROW_LENGTH = 0.95;
/** The longest share of the last leg an arrowhead may cover before it shrinks (so a hitch still reads as a hook). */
const TIP_SHARE = 0.42;
/** The smallest end marker, as a share of the normal one. */
const MIN_TIP_SCALE = 0.45;

/**
 * The marker at the end of a route: an open arrowhead, a T bar (block / stop) or a small
 * ring (dot). Returned as polylines, plus a ring centre for the dot.
 */
export function endMarker(end: EndStyle, tip: Vec, dir: Vec, size = 1): { lines: Vec[][]; ring: Vec | null } {
  const n = perp(dir);
  if (end === "arrow") {
    const back = sub(tip, scale(dir, ARROW_LENGTH * size));
    return { lines: [[add(back, scale(n, 0.6 * size)), tip, sub(back, scale(n, 0.6 * size))]], ring: null };
  }
  if (end === "block") return { lines: [[add(tip, scale(n, 0.75 * size)), sub(tip, scale(n, 0.75 * size))]], ring: null };
  return { lines: [], ring: tip };
}

export interface RouteGeometry {
  sampled: Sampled;
  /** Distance along the path where the first segment (the motion, for zigzag routes) ends. */
  firstSegmentEnd: number;
  /** Polyline drawn as a zigzag (motion); empty unless the route is a zigzag route. */
  zigzag: Vec[];
  /** Polyline drawn with the route's normal stroke (solid or dashed). */
  body: Vec[];
  tip: Vec;
  dir: Vec;
  /**
   * Multiplies the end marker's size: 1 normally, smaller when the last leg is short (a hitch or
   * a comeback turning back about a yard), so the arrowhead does not swallow the leg. Never below 0.45.
   */
  tipScale: number;
}

/**
 * Everything needed to draw or animate one player's route. `size` scales the zigzag with the
 * drawing (1 = the reference size), so it keeps the same look when a big screen zooms in.
 * A motion (zigzag) route keeps the corner where the motion ends sharp, so the zigzag ends on it.
 */
export function routeGeometry(start: Vec, route: Route, size = 1): RouteGeometry | null {
  if (route.points.length === 0) return null;
  const vertices = routeVertices(start, route);
  const sampled = sample(buildPath(vertices, route.corners, route.line === "zigzag"));
  const lastLeg = dist(vertices[vertices.length - 2], vertices[vertices.length - 1]);
  const tipScale = Math.min(1, Math.max(MIN_TIP_SCALE, (TIP_SHARE * lastLeg) / (ARROW_LENGTH * size)));
  const first = route.points[0];
  let split = 0;
  let best = Infinity;
  for (let i = 0; i < sampled.pts.length; i++) {
    const d = dist(sampled.pts[i], first);
    if (d < best) {
      best = d;
      split = i;
    }
  }
  const firstSegmentEnd = route.points.length === 1 ? sampled.length : sampled.cum[split];
  const end = pointAt(sampled, sampled.length);
  // The heading at the tip, measured over the last half yard so curves point the right way.
  const before = pointAt(sampled, Math.max(0, sampled.length - 0.5)).p;
  const dir = norm(sub(end.p, before));

  if (route.line !== "zigzag") return { sampled, firstSegmentEnd, zigzag: [], body: sampled.pts, tip: end.p, dir, tipScale };

  const motion = subPath(sampled, 0, firstSegmentEnd);
  const onlyOne = route.points.length === 1;
  const zig = zigzag(motion, 0.42 * size, 1.1 * size, (onlyOne ? 1.1 : 0.2) * size);
  const body = onlyOne ? [] : sampled.pts.slice(split);
  return { sampled, firstSegmentEnd, zigzag: zig, body, tip: end.p, dir, tipScale };
}

/** The stretch of a sampled path between two distances, re-sampled on its own. */
export function subPath(s: Sampled, from: number, to: number): Sampled {
  const pts: Vec[] = [pointAt(s, from).p];
  for (let i = 0; i < s.pts.length; i++) if (s.cum[i] > from && s.cum[i] < to) pts.push(s.pts[i]);
  pts.push(pointAt(s, to).p);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  return { pts, cum, length: cum[cum.length - 1] };
}

export const snapValue = (v: number, step: number) => Math.round(v / step) * step;

export function clampToField(v: Vec, width: number, yMin: number, yMax: number): Vec {
  return { x: Math.min(width, Math.max(0, v.x)), y: Math.min(yMax, Math.max(yMin, v.y)) };
}

/**
 * Labels that name a side of the field, each with its other side: the line (LT, LG), the special-teams
 * lanes and wings (L1…L9, LW, LU, LE) and the block unit's gaps (EL, CL, BL, AL, SL). Anything else
 * (PR, KR2, LB, LS, X…) names a role, not a side.
 */
const SIDE_LABELS: Record<string, string> = Object.fromEntries(
  [
    ...[..."TGEWU"].map((c) => [`L${c}`, `R${c}`]),
    ...[..."123456789"].map((c) => [`L${c}`, `R${c}`]),
    ...[..."ECBAS"].map((c) => [`${c}L`, `${c}R`]),
  ].flatMap(([l, r]) => [
    [l, r],
    [r, l],
  ]),
);

/** The side colours of the special-teams lanes: amber for L1…L9, violet for R1…R9. */
const LANE_COLOR = { L: "amber", R: "violet" } as const;

/**
 * A player standing on the other side after a flip: a side-coded label names the new side, and a
 * lane player in his side's colour takes the other side's colour with it.
 */
function otherSide(p: PlayerSpot): PlayerSpot {
  const label = SIDE_LABELS[p.label];
  if (!label) return p;
  const lane = /^[LR][1-9]$/.test(p.label) && p.color === LANE_COLOR[p.label[0] as "L" | "R"];
  return { ...p, label, color: lane ? LANE_COLOR[label[0] as "L" | "R"] : p.color };
}

/**
 * Left and right swap: X goes where Y was, every route mirrors with it. Labels that name a side
 * (LT, L1, EL…) swap too, so the man on the left is still the left tackle.
 */
export function mirrorPlayers(players: PlayerSpot[], width: number): PlayerSpot[] {
  const m = (x: number) => Math.round((width - x) * 100) / 100;
  return players.map((p) =>
    otherSide({
      ...p,
      x: m(p.x),
      route: p.route && { ...p.route, points: p.route.points.map((pt) => ({ x: m(pt.x), y: pt.y })) },
    }),
  );
}

/** Where a player's zone sits: at the end of the route, or on the player. */
export function zoneCenter(p: PlayerSpot): Vec {
  const pts = p.route?.points;
  return pts && pts.length > 0 ? pts[pts.length - 1] : { x: p.x, y: p.y };
}
