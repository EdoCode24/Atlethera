import type { L10n } from "@/domain/sports/types";
import type { PlayerSpot, Route, Vec } from "./types";

export type BreakSide = "left" | "right";

export interface RouteTemplate {
  /** The number the coach calls; a string so two-digit calls fit next to single digits. */
  id: string;
  name: L10n;
  /** Offsets from the player in yards. x > 0 means "toward the middle of the field". */
  points: Vec[];
}

/**
 * The coach's route tree (rotalar/, drawn by the coach in the reference app, measured at 34 px
 * per yard against the 5-yard line). Offsets are from the player; x > 0 is toward the middle of
 * the field. 5, 6 and 66 stop and turn back a yard; 6 turns to the sideline, 5 and 66 inside.
 * The coach can send any route that breaks to the other side.
 */
export const ROUTE_TREE: RouteTemplate[] = [
  { id: "1", name: { tr: "Flat", en: "Flat" }, points: [{ x: -13, y: 4 }] },
  { id: "2", name: { tr: "Slant", en: "Slant" }, points: [{ x: 0, y: 2.5 }, { x: 10.5, y: 4.5 }] },
  { id: "3", name: { tr: "Out", en: "Out" }, points: [{ x: 0, y: 5 }, { x: -9, y: 5 }] },
  { id: "4", name: { tr: "In", en: "In" }, points: [{ x: 0, y: 7 }, { x: 11, y: 7 }] },
  { id: "5", name: { tr: "Hitch", en: "Hitch" }, points: [{ x: 0, y: 5 }, { x: 1, y: 4 }] },
  { id: "6", name: { tr: "Comeback", en: "Comeback" }, points: [{ x: 0, y: 8 }, { x: -1, y: 7 }] },
  { id: "66", name: { tr: "Curl", en: "Curl" }, points: [{ x: 0, y: 8 }, { x: 1, y: 7 }] },
  { id: "7", name: { tr: "Corner", en: "Corner" }, points: [{ x: 0, y: 7 }, { x: -8, y: 11 }] },
  { id: "8", name: { tr: "Post", en: "Post" }, points: [{ x: 0, y: 7 }, { x: 6, y: 12.5 }] },
  { id: "9", name: { tr: "Go", en: "Go" }, points: [{ x: 0, y: 12.5 }] },
];

export const findTemplate = (id: string): RouteTemplate | undefined => ROUTE_TREE.find((t) => t.id === id);

/** The way a template breaks in its own frame: 1 toward the middle, −1 toward the sideline, 0 straight. */
export function breakSign(t: RouteTemplate): -1 | 0 | 1 {
  const x = t.points.at(-1)?.x ?? 0;
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

/** The motion's end for a player with motion (a zigzag route), where he is at the snap. */
const motionEnd = (player: PlayerSpot): Vec | null => (player.route?.line === "zigzag" ? (player.route.points[0] ?? null) : null);

/** Where a template starts for this player: at the end of his motion, or on his spot. */
export function templateStart(player: PlayerSpot): Vec {
  const m = motionEnd(player);
  return m ? { x: m.x, y: m.y } : { x: player.x, y: player.y };
}

/** +1 when "toward the middle" is to the right of where the route starts. A start on the centre line counts as left. */
const inward = (player: PlayerSpot, fieldWidth: number) => (templateStart(player).x <= fieldWidth / 2 ? 1 : -1);

/** The side a template breaks to for this player when the coach has not picked one; null for straight routes. */
export function naturalSide(player: PlayerSpot, id: string, fieldWidth: number): BreakSide | null {
  const t = findTemplate(id);
  const sign = t ? breakSign(t) : 0;
  if (sign === 0) return null;
  return sign * inward(player, fieldWidth) > 0 ? "right" : "left";
}

/**
 * A template's corners relative to the player, facing the chosen way. Without a side it follows
 * the tree (odd out, even in, seen from where the player stands); with a side the break goes
 * that way, which is how a centre or a slot in the middle of the field gets a direction.
 */
export function templateOffsets(player: PlayerSpot, id: string, fieldWidth: number, side?: BreakSide): Vec[] {
  const t = findTemplate(id) ?? ROUTE_TREE[0];
  const sign = breakSign(t);
  const mirror = side && sign !== 0 ? (side === "right" ? 1 : -1) * sign : inward(player, fieldWidth);
  return t.points.map((o) => ({ x: o.x * mirror, y: o.y }));
}

/**
 * A template placed on a player, kept on the field. With `maxY` (the deepest yard the coach can
 * see) a route that would run past it is shrunk evenly, so it keeps its shape on screen.
 * A player with motion keeps it: the template runs from the motion's end as the route after the
 * snap. A template is never motion itself, so without motion a zigzag style turns solid.
 */
export function templateRoute(
  player: PlayerSpot,
  id: string,
  fieldWidth: number,
  keep?: Pick<Route, "line" | "end" | "corners">,
  side?: BreakSide,
  maxY?: number,
): Route {
  const motion = motionEnd(player);
  const from = templateStart(player);
  let offsets = templateOffsets(player, id, fieldWidth, side);
  const deepest = Math.max(...offsets.map((o) => o.y));
  if (maxY !== undefined && deepest > 0 && from.y + deepest > maxY) {
    const f = Math.max(0.3, (maxY - from.y) / deepest);
    offsets = offsets.map((o) => ({ x: o.x * f, y: o.y * f }));
  }
  const placed = offsets.map((o) => ({
    x: Math.round(Math.min(fieldWidth - 0.5, Math.max(0.5, from.x + o.x)) * 100) / 100,
    y: Math.round((from.y + o.y) * 100) / 100,
  }));
  const line = motion ? "zigzag" : keep?.line === "dashed" ? "dashed" : "solid";
  return { points: motion ? [motion, ...placed] : placed, line, end: keep?.end ?? "arrow", corners: keep?.corners ?? "sharp" };
}
