import type { SportId } from "@/domain/sports/types";
import { defaultFormation, newId, opponentFormation } from "./formations";
import type { DefenseFront } from "./fronts";
import { fitSpecialDepth, specialFormation } from "./formations";
import { SPECIAL_TEAMS, type SpecialUnit } from "./special";
import { zoneCenter } from "./geometry";
import type { Backfield, Category, FieldLines, FieldSettings, Play, Playbook, PlayerSpot, PlaySide } from "./types";

export const DEFAULT_SETTINGS: FieldSettings = {
  theme: "dark",
  snap: false,
  showOpponent: false,
  backfield: "less",
  ballOn: null,
};

/**
 * Depth shown behind the line for each option, in yards. A defense lines up deeper than
 * an offense (safeties sit 9+ yards off), so its own side gets more room.
 */
/** Turf left behind the deepest player for each "backfield" setting, in yards. */
export const BACKFIELD_ROOM: Record<Backfield, number> = { less: 0, standard: 2.5, more: 6 };

/**
 * How far behind the line of scrimmage the lowest token reaches, for players drawn with radius
 * `r`: stars reach further than circles, triangles a little less.
 */
export function formationExtent(players: PlayerSpot[], r: number): number {
  let deepest = r;
  for (const p of players) deepest = Math.max(deepest, -p.y + r * (p.starred ? 1.45 : p.shape === "triangle" ? 0.9 : 1));
  return deepest;
}

/**
 * Yards from the line of scrimmage to the bottom edge of a view. "Less" leans the team against
 * the edge (the deepest token plus a sliver of turf, or the deepest route corner or zone edge);
 * the other settings leave more behind it.
 */
export function backfieldDepth(players: PlayerSpot[], r: number, backfield: Backfield): number {
  let drawn = 0;
  for (const p of players) {
    // Route corners sit half a yard above the edge at most (the editor keeps them there).
    for (const pt of p.route?.points ?? []) drawn = Math.max(drawn, -pt.y + 0.5);
    if (p.zone) drawn = Math.max(drawn, -zoneCenter(p).y + p.zone.radius + 0.2);
  }
  return Math.max(formationExtent(players, r) + 0.2 + r * 0.25, drawn) + BACKFIELD_ROOM[backfield];
}

/**
 * New offensive plays lean on the bottom edge; defensive ones keep room behind for zone drops, and so
 * do receiving special-teams units (kick return, punt return, field goal block), whose deepest men
 * drift or bail backwards. Kicking units lean on the edge like an offense.
 */
export const defaultBackfield = (side: PlaySide, unit?: SpecialUnit): Backfield =>
  side === "defense" || (side === "special" && !!unit && !SPECIAL_TEAMS[unit].kicking) ? "standard" : "less";

/** The sides a playbook of this sport has: special teams only in American football. */
export const sidesFor = (sport: SportId): PlaySide[] => (sport === "american-football" ? ["offense", "defense", "special"] : ["offense", "defense"]);

/** "Ball on" choices, as yards to the goal line. */
export const BALL_ON_OPTIONS = [null, 10, 5, 4, 3, 2, 1] as const;

export interface NewPlaybookInput {
  workspaceId: string;
  name: string;
  sport: SportId;
  playersPerSide: number;
  fieldWidth: number;
  fieldLines: FieldLines;
  /** Default category names in the user's language. */
  categoryNames: Record<PlaySide, string[]>;
}

export function newPlaybook(input: NewPlaybookInput, now = new Date()): Playbook {
  const stamp = now.toISOString();
  const cats = (side: PlaySide): Category[] => input.categoryNames[side].map((name) => ({ id: newId("c"), name }));
  return {
    id: newId("pb"),
    workspaceId: input.workspaceId,
    name: input.name.trim(),
    sport: input.sport,
    playersPerSide: input.playersPerSide,
    fieldWidth: input.fieldWidth,
    fieldLines: input.fieldLines,
    categories: { offense: cats("offense"), defense: cats("defense"), special: input.sport === "american-football" ? cats("special") : [] },
    plays: [],
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export interface NewPlayInput {
  side: PlaySide;
  name: string;
  categoryIds: string[];
  notes: string;
  author: string;
  /** American football: the defensive front (own players on defense, the ghosts on offense). */
  front?: DefenseFront;
  /** Special teams: the unit (kickoff, punt return…). */
  unit?: SpecialUnit;
}

export function newPlay(playbook: Playbook, input: NewPlayInput, now = new Date()): Play {
  const stamp = now.toISOString();
  const { sport, playersPerSide, fieldWidth } = playbook;
  const unit = input.side === "special" ? (input.unit ?? "kickoff") : null;
  const special = unit && sport === "american-football" ? { unit, ...specialFormation(unit, fieldWidth) } : null;
  return {
    id: newId("play"),
    side: input.side,
    name: input.name.trim(),
    categoryIds: input.categoryIds,
    notes: input.notes,
    positionNotes: {},
    // New units are fitted to the board already; the flag keeps the editor from fitting them again.
    ...(special ? { unit: special.unit, depthFitted: true } : {}),
    players: special ? special.own : defaultFormation(sport, input.side, playersPerSide, fieldWidth, input.front),
    opponent: special ? special.opponent : opponentFormation(sport, input.side, playersPerSide, fieldWidth, input.front),
    settings: {
      ...DEFAULT_SETTINGS,
      backfield: defaultBackfield(input.side, special?.unit),
      // A special-teams diagram is about both units, so the other one shows from the start.
      showOpponent: !!special,
      ...(sport === "american-football" && !special ? { front: input.front ?? "4-3" } : {}),
    },
    locked: false,
    createdAt: stamp,
    updatedAt: stamp,
    updatedBy: input.author,
  };
}

/**
 * A special-teams play saved before the board compressed special-teams depth, fitted once and
 * flagged; any other play is returned as it is. A fitted play is never squeezed again, so a
 * returner the coach drags deep stays where he was dropped.
 */
export function withFittedDepth(play: Play): Play {
  if (play.side !== "special" || play.depthFitted) return play;
  const { own, opponent } = fitSpecialDepth(play.players, play.opponent);
  return { ...play, players: own, opponent, depthFitted: true };
}

/** A copy with fresh ids, for "Copy" and "Copy to". */
export function clonePlay(play: Play, overrides: Partial<Play> = {}, now = new Date()): Play {
  const stamp = now.toISOString();
  const ids = new Map(play.players.map((p) => [p.id, newId()]));
  return {
    ...structuredClone(play),
    id: newId("play"),
    players: play.players.map((p) => ({ ...structuredClone(p), id: ids.get(p.id)! })),
    opponent: play.opponent.map((p) => ({ ...structuredClone(p), id: newId() })),
    positionNotes: Object.fromEntries(Object.entries(play.positionNotes).flatMap(([k, v]) => (ids.has(k) ? [[ids.get(k)!, v]] : []))),
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  };
}
