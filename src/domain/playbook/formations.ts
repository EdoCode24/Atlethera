import { americanFootball } from "@/domain/sports/american-football";
import type { FormationPlayer, SportId } from "@/domain/sports/types";
import { FRONTS, type DefenseFront } from "./fronts";
import { SPECIAL_TEAMS, type SpecialUnit } from "./special";
import type { PlayerColor, PlayerSpot, PlaySide, Shape } from "./types";

/** Reference field for the flag defaults below; other widths scale across. */
const FLAG_REFERENCE_WIDTH = 30;

interface Slot {
  label: string;
  x: number;
  y: number;
  color: PlayerColor;
  shape: Shape;
}

/**
 * Flag offense, in the order players are added as the side grows from 4 to 9.
 * The first five follow the 5v5 default of the reference app (30-yard field), with the
 * quarterback moved a yard closer to the centre so the drawing board has more room up-field.
 * The ninth, W, mirrors T on the other side of the centre (three on each side). Eight colours
 * serve nine players, so he shares Y's, the player furthest from him.
 */
const FLAG_OFFENSE: Slot[] = [
  { label: "C", x: 15, y: 0, color: "slate", shape: "square" },
  { label: "Q", x: 15, y: -3.3, color: "signal", shape: "circle" },
  { label: "X", x: 3.9, y: 0, color: "amber", shape: "circle" },
  { label: "Y", x: 26.1, y: 0, color: "violet", shape: "circle" },
  { label: "Z", x: 20.6, y: -1.75, color: "teal", shape: "circle" },
  { label: "H", x: 9.4, y: -1.75, color: "ice", shape: "circle" },
  { label: "R", x: 17.3, y: -5.5, color: "volt", shape: "circle" },
  { label: "T", x: 18.2, y: 0, color: "chalk", shape: "circle" },
  { label: "W", x: 11.8, y: 0, color: "violet", shape: "circle" },
];

/** Flag defense, own view: below the line, facing up. */
const FLAG_DEFENSE: Slot[] = [
  { label: "R", x: 9.4, y: -7.5, color: "signal", shape: "triangle" },
  { label: "LB", x: 15, y: -4.4, color: "slate", shape: "triangle" },
  { label: "C", x: 3.9, y: -3.5, color: "amber", shape: "triangle" },
  { label: "C", x: 26.1, y: -3.5, color: "violet", shape: "triangle" },
  { label: "S", x: 20.6, y: -9.3, color: "teal", shape: "triangle" },
  { label: "N", x: 9.4, y: -3.5, color: "ice", shape: "triangle" },
  { label: "LB", x: 21, y: -4.4, color: "chalk", shape: "triangle" },
  { label: "S", x: 9.4, y: -9.3, color: "volt", shape: "triangle" },
  { label: "D", x: 15, y: -12, color: "chalk", shape: "triangle" },
];

const AF_COLORS: Record<string, PlayerColor> = {
  qb: "signal",
  rb: "volt",
  x: "amber",
  z: "teal",
  slot: "ice",
  te: "violet",
  wlb: "ice",
  mlb: "slate",
  slb: "violet",
  cb1: "amber",
  cb2: "teal",
  fs: "signal",
  ss: "volt",
};

let counter = 0;
/** Ids only need to be unique inside one play. */
export function newId(prefix = "p"): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

function spot(slot: Slot): PlayerSpot {
  return { id: newId(), ...slot, starred: false, route: null, zone: null };
}

function flagSide(side: PlaySide, count: number, width: number): PlayerSpot[] {
  const scale = width / FLAG_REFERENCE_WIDTH;
  const slots = (side === "offense" ? FLAG_OFFENSE : FLAG_DEFENSE).slice(0, count);
  return slots.map((s) => spot({ ...s, x: round(s.x * scale) }));
}

/** Quarterback and running back depth in the playbook, a yard shallower than the module's shotgun. */
const AF_BACKS_DEPTH = 4.5;
const AF_BACKS = new Set(["qb", "rb"]);

/** American football players from the sport module, turned so their side faces up. */
function afSide(side: PlaySide, width: number): PlayerSpot[] {
  const { losX, players } = americanFootball.formation;
  const own = players.filter((p) => p.side === side);
  return own.map((p: FormationPlayer) => {
    const offense = p.side === "offense";
    return spot({
      label: p.label,
      // Offense keeps its left; defense sees the field from the other end.
      x: round(offense ? p.y : width - p.y),
      y: round(offense ? (AF_BACKS.has(p.id) ? -AF_BACKS_DEPTH : p.x - losX) : -(p.x - losX)),
      color: AF_COLORS[p.id] ?? "slate",
      shape: offense ? (p.id === "c" ? "square" : "circle") : "triangle",
    });
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * An American football defense in one of the fronts, in its own view: the offense's strong (tight
 * end) side is on the defense's left, so a positive lateral lands left of the ball.
 */
export function frontFormation(front: DefenseFront, width: number): PlayerSpot[] {
  return FRONTS[front].players.map((p) =>
    spot({
      label: p.label,
      x: round(Math.min(width - 0.5, Math.max(0.5, width / 2 - p.lateral))),
      y: round(-p.depth),
      color: p.color,
      shape: "triangle",
    }),
  );
}

/**
 * A special-teams unit and the unit facing it, in own view: our unit below the ball (kicking or
 * receiving), theirs above it. Research coordinates put the kicking team behind the ball, so a
 * receiving unit of ours is turned half a circle.
 */
export function specialFormation(unit: SpecialUnit, width: number): { own: PlayerSpot[]; opponent: PlayerSpot[] } {
  const t = SPECIAL_TEAMS[unit];
  const place = (p: (typeof t.own)[number], flip: boolean) =>
    spot({
      label: p.label,
      x: round(Math.min(width - 0.5, Math.max(0.5, flip ? width - p.x : p.x))),
      y: round(flip ? -p.y : p.y),
      color: p.color,
      shape: p.shape,
    });
  // Kicking units are researched behind the ball (y <= 0), receiving units in front of it (y >= 0).
  const own = t.own.map((p) => place(p, !t.kicking));
  const opponent = t.opponent.map((p) => ({ ...place(p, !t.kicking), color: "slate" as const }));
  return fitSpecialDepth(own, opponent);
}

/** Yards of special-teams depth the board shows at true scale on each side of the ball. */
const TRUE_DEPTH = 6;
/** Total depth, both sides together, a special-teams unit and the one facing it may take. */
const SPECIAL_BOARD_DEPTH = 19;

/**
 * Special teams span up to 70 yards (a returner at his own 5), but the board is one full-width
 * screen of about 20 yards. Like a whiteboard diagram, depth stays true within TRUE_DEPTH of the
 * ball and is compressed beyond it by one factor for both teams, so the layers keep their order
 * and proportions. Routes and zones compress with their players. A unit that already fits is left
 * as it is. A coach may drag a player past the budget afterwards, so a play is fitted only once
 * (Play.depthFitted, withFittedDepth in factory.ts).
 */
export function fitSpecialDepth(own: PlayerSpot[], opponent: PlayerSpot[]): { own: PlayerSpot[]; opponent: PlayerSpot[] } {
  const all = [...own, ...opponent];
  const below = Math.max(0, ...all.map((p) => -p.y));
  const above = Math.max(0, ...all.map((p) => p.y));
  const excess = Math.max(0, below - TRUE_DEPTH) + Math.max(0, above - TRUE_DEPTH);
  const kept = Math.min(below, TRUE_DEPTH) + Math.min(above, TRUE_DEPTH);
  if (excess === 0 || kept + excess <= SPECIAL_BOARD_DEPTH) return { own, opponent };
  const c = Math.max(0, SPECIAL_BOARD_DEPTH - kept) / excess;
  const fy = (y: number) => {
    const d = Math.abs(y);
    return d <= TRUE_DEPTH ? y : round(Math.sign(y) * (TRUE_DEPTH + (d - TRUE_DEPTH) * c));
  };
  const fit = (p: PlayerSpot): PlayerSpot => ({
    ...p,
    y: fy(p.y),
    route: p.route && { ...p.route, points: p.route.points.map((pt) => ({ x: pt.x, y: fy(pt.y) })) },
  });
  return { own: own.map(fit), opponent: opponent.map(fit) };
}

/** The default players for one side of a new play, in own view. */
export function defaultFormation(sport: SportId, side: PlaySide, playersPerSide: number, width: number, front: DefenseFront = "4-3"): PlayerSpot[] {
  if (sport !== "american-football") return flagSide(side, playersPerSide, width);
  return side === "defense" ? frontFormation(front, width) : afSide(side, width);
}

/** The opponent as seen from our side: their own view turned half a circle. `front` is the defense's, when the opponent is the defense. */
export function opponentFormation(sport: SportId, side: PlaySide, playersPerSide: number, width: number, front?: DefenseFront): PlayerSpot[] {
  const other: PlaySide = side === "offense" ? "defense" : "offense";
  return defaultFormation(sport, other, playersPerSide, width, front).map((p) => ({
    ...p,
    x: round(width - p.x),
    y: round(-p.y),
    color: "slate" as const,
  }));
}

export const PLAYERS_PER_SIDE: Record<SportId, { min: number; max: number; default: number }> = {
  "flag-football": { min: 4, max: 9, default: 5 },
  "american-football": { min: 11, max: 11, default: 11 },
};

export const FIELD_WIDTHS: Record<SportId, number[]> = {
  "flag-football": [25, 30],
  "american-football": [160 / 3],
};
