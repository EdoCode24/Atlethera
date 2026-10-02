import { FIELD_WIDTHS, frontFormation } from "./formations";
import { FRONTS, type DefenseFront, type FrontPlayer } from "./fronts";
import { dist, mirrorPlayers, snapValue } from "./geometry";
import { templateRoute, type BreakSide } from "./routes";
import type { EndStyle, FieldSettings, Play, PlayerColor, PlayerSpot, Route, Vec } from "./types";

/**
 * The play editor as a pure state machine, so every rule from the reference recording is
 * testable without a browser:
 *  - a tap selects a player; the toolbar acts on the selected player only
 *  - while a player is selected, a tap (or press-and-drag, released) on the field adds a
 *    segment from the end of its route
 *  - the red button removes the last segment, one per press
 *  - line (zigzag / dashed), end style and corner buttons restyle the existing route and
 *    set the style for segments still to come
 *  - an action that changes nothing leaves no undo step
 *  - locking is not an edit: undo and redo never change it, and do nothing while the play is locked
 */

export type PlayContent = Pick<Play, "players" | "opponent" | "settings" | "locked">;

export interface EditorState {
  play: PlayContent;
  selectedId: string | null;
  past: PlayContent[];
  future: PlayContent[];
  /**
   * The play as the current gesture (a drag, a slider) found it. The gesture's first real change
   * puts it on the undo stack, so a press that moves nothing leaves no empty step.
   */
  gesture: PlayContent | null;
}

export const END_CYCLE: EndStyle[] = ["arrow", "block", "dot"];
export const DEFAULT_ZONE_RADIUS = 4;
export const ZONE_RADIUS_RANGE = { min: 2, max: 9 } as const;
export const GRID_STEP = 0.5;
const HISTORY_LIMIT = 100;

export type EditorAction =
  | { type: "select"; id: string | null }
  /** Without `commit` the move is a step of the gesture begun by beginGesture (a drag). */
  | { type: "movePlayer"; id: string; to: Vec; commit: boolean }
  | { type: "moveOpponent"; id: string; to: Vec; commit: boolean }
  /** Starts a gesture: its changes, however many, make one undo step, and none if it changes nothing. */
  | { type: "beginGesture" }
  | { type: "addPoint"; to: Vec }
  | { type: "removeLastPoint" }
  /** A step of a gesture (dragging a route corner): dispatch beginGesture first. */
  | { type: "movePoint"; index: number; to: Vec }
  | { type: "toggleZigzag" }
  | { type: "toggleDashed" }
  | { type: "cycleEnd" }
  | { type: "toggleCorners" }
  | { type: "applyTemplate"; id: string; fieldWidth: number; side?: BreakSide; maxY?: number }
  | { type: "toggleStar" }
  | { type: "toggleZone" }
  /** `commit: false` is a step of a gesture (dragging the slider after beginGesture); the default is its own undo step. */
  | { type: "setZoneRadius"; radius: number; commit?: boolean }
  /** A blank label is ignored, so a token never loses its letters. */
  | { type: "setPlayer"; patch: Partial<Pick<PlayerSpot, "label" | "color">> }
  | { type: "flip"; fieldWidth: number }
  | { type: "setSettings"; patch: Partial<FieldSettings> }
  | { type: "setLocked"; locked: boolean }
  | { type: "setFront"; front: DefenseFront; players?: PlayerSpot[]; opponent?: PlayerSpot[] }
  | { type: "reset"; play: PlayContent }
  | { type: "undo" }
  | { type: "redo" };

export function initEditor(play: PlayContent): EditorState {
  return { play, selectedId: null, past: [], future: [], gesture: null };
}

const emptyRoute = (): Route => ({ points: [], line: "solid", end: "arrow", corners: "sharp" });
const round = (n: number) => Math.round(n * 100) / 100;

function snapped(v: Vec, settings: FieldSettings): Vec {
  return settings.snap ? { x: snapValue(v.x, GRID_STEP), y: snapValue(v.y, GRID_STEP) } : { x: round(v.x), y: round(v.y) };
}

/** Equal as saved data: a key holding undefined counts as missing, as in JSON. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const list = b as unknown[];
    return a.length === list.length && a.every((v, i) => same(v, list[i]));
  }
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  return [...new Set([...Object.keys(x), ...Object.keys(y)])].every((k) => same(x[k], y[k]));
}

/** Pushes the current play onto the undo stack and applies a change to it. A change that changes nothing is no step. */
function commit(state: EditorState, next: PlayContent): EditorState {
  if (same(next, state.play)) return state;
  return { ...state, play: next, past: [...state.past, state.play].slice(-HISTORY_LIMIT), future: [], gesture: null };
}

/** A change inside a gesture: the first real one puts the play as the gesture found it onto the undo stack. */
function step(state: EditorState, next: PlayContent): EditorState {
  if (same(next, state.play)) return state;
  if (!state.gesture) return { ...state, play: next };
  return { ...state, play: next, past: [...state.past, state.gesture].slice(-HISTORY_LIMIT), future: [], gesture: null };
}

function updateSelected(state: EditorState, fn: (p: PlayerSpot) => PlayerSpot, apply = commit): EditorState {
  const id = state.selectedId;
  if (!id || state.play.locked) return state;
  const players = state.play.players.map((p) => (p.id === id ? fn(p) : p));
  return apply(state, { ...state.play, players });
}

function withRoute(p: PlayerSpot, fn: (r: Route) => Route): PlayerSpot {
  return { ...p, route: fn(p.route ?? emptyRoute()) };
}

/** DL, LB or DB for every label a front uses: DE DT NT NG · S M W J · CB SS FS NB SP B. */
const GROUP: ReadonlyMap<string, FrontPlayer["group"]> = new Map(Object.values(FRONTS).flatMap((f) => f.players.map((p) => [p.label, p.group] as const)));

/** Fronts exist in American football only. */
const AF_WIDTH = FIELD_WIDTHS["american-football"][0];

/**
 * A zone on a player without a route moves with him when his new spot is this close (yards), so a
 * small shift draws no stub; further away the zone stays, with a drop to it.
 */
const ZONE_FOLLOWS = 1.5;

/**
 * Pairs the unpaired items of two lists, the closest pair first, among the pairs `fits` allows.
 * `match[i]` is the index in `b` of `a[i]`'s partner, or -1.
 */
function pairNearest(a: Vec[], b: Vec[], match: number[], fits: (i: number, j: number) => boolean): void {
  const taken = new Set(match.filter((j) => j >= 0));
  const pairs: [number, number, number][] = [];
  a.forEach((p, i) => {
    if (match[i] >= 0) return;
    b.forEach((q, j) => {
      if (!taken.has(j) && fits(i, j)) pairs.push([dist(p, q), i, j]);
    });
  });
  pairs.sort((u, v) => u[0] - v[0]);
  for (const [, i, j] of pairs) {
    if (match[i] >= 0 || taken.has(j)) continue;
    match[i] = j;
    taken.add(j);
  }
}

/**
 * The spot of its front each player was seated in: the one with his label, or for a player the
 * coach renamed, the free spot nearest him. The front is tried both ways round (it follows the
 * tight end) and the way the players stand closer to wins.
 */
function seats(players: PlayerSpot[], front: DefenseFront): (PlayerSpot | undefined)[] {
  const labels = new Set(FRONTS[front].players.map((p) => p.label));
  const straight = frontFormation(front, AF_WIDTH);
  const ways = [straight, mirrorPlayers(straight, AF_WIDTH)].map((slots) => {
    const match = players.map(() => -1);
    pairNearest(players, slots, match, (i, j) => players[i].label === slots[j].label);
    const cost = match.reduce((sum, j, i) => sum + (j >= 0 ? dist(players[i], slots[j]) : 0), 0);
    pairNearest(players, slots, match, (i) => !labels.has(players[i].label));
    return { slots, match, cost };
  });
  const best = ways[1].cost < ways[0].cost ? ways[1] : ways[0];
  return best.match.map((j) => (j >= 0 ? best.slots[j] : undefined));
}

/**
 * New spots for a new front. A player of the old front hands his id, star, zone and route to one
 * of the new front: first the same position (nearest spot, so the left corner stays the left
 * corner), then the same group (DL, LB, DB: the NT becomes the NG, the SS the Spur), nearest first.
 * The others start clean. A label or colour the coach chose stays. Routes keep their points, since
 * they end on field landmarks (a zone, a gap, the QB) a new front does not move; only their start
 * follows the new alignment. A zone on the player himself stays put too, with a drop to it.
 */
export function reseat(old: PlayerSpot[], next: PlayerSpot[], oldFront: DefenseFront = "4-3"): PlayerSpot[] {
  const labels = new Set(FRONTS[oldFront].players.map((p) => p.label));
  const seat = seats(old, oldFront);
  const role = old.map((o, i) => seat[i]?.label ?? o.label);
  const match = old.map(() => -1);
  pairNearest(old, next, match, (i, j) => role[i] === next[j].label);
  pairNearest(old, next, match, (i, j) => GROUP.has(role[i]) && GROUP.get(role[i]) === GROUP.get(next[j].label));
  const from = new Map(match.flatMap((j, i) => (j >= 0 ? [[j, i] as const] : [])));
  return next.map((n, j) => {
    const i = from.get(j);
    if (i === undefined) return n;
    const o = old[i];
    const home = seat[i];
    let route = o.route;
    if (o.zone && !route?.points.length && dist(o, n) > ZONE_FOLLOWS) {
      const style = route ?? emptyRoute();
      route = { ...style, line: style.line === "zigzag" ? "solid" : style.line, points: [{ x: o.x, y: o.y }] };
    } else if (o.zone && route?.points.length === 1 && dist(route.points[0], n) < 0.5) {
      // Back on the spot an earlier front's drop led to: the drop goes, the zone sits on him again.
      route = null;
    }
    return {
      ...n,
      id: o.id,
      label: labels.has(o.label) ? n.label : o.label,
      color: home && o.color !== home.color ? o.color : n.color,
      starred: o.starred,
      zone: o.zone,
      route,
    };
  });
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { play } = state;
  switch (action.type) {
    case "select":
      return { ...state, selectedId: action.id };

    case "beginGesture":
      // A drag writes many intermediate positions; keep one undo step for the whole gesture.
      return play.locked ? state : { ...state, gesture: play };

    case "movePlayer": {
      if (play.locked) return state;
      const to = snapped(action.to, play.settings);
      const players = play.players.map((p) => {
        if (p.id !== action.id) return p;
        const dx = to.x - p.x;
        const dy = to.y - p.y;
        // The route travels with its player.
        const route = p.route && { ...p.route, points: p.route.points.map((pt) => ({ x: round(pt.x + dx), y: round(pt.y + dy) })) };
        return { ...p, x: to.x, y: to.y, route };
      });
      return (action.commit ? commit : step)(state, { ...play, players });
    }

    case "moveOpponent": {
      if (play.locked) return state;
      const to = snapped(action.to, play.settings);
      const opponent = play.opponent.map((p) => (p.id === action.id ? { ...p, x: to.x, y: to.y } : p));
      return (action.commit ? commit : step)(state, { ...play, opponent });
    }

    case "addPoint":
      return updateSelected(state, (p) => withRoute(p, (r) => ({ ...r, points: [...r.points, snapped(action.to, play.settings)] })));

    case "removeLastPoint":
      return updateSelected(state, (p) => (p.route && p.route.points.length > 0 ? withRoute(p, (r) => ({ ...r, points: r.points.slice(0, -1) })) : p));

    case "movePoint":
      return updateSelected(
        state,
        (p) => withRoute(p, (r) => ({ ...r, points: r.points.map((pt, i) => (i === action.index ? snapped(action.to, play.settings) : pt)) })),
        step,
      );

    case "toggleZigzag":
      return updateSelected(state, (p) => withRoute(p, (r) => ({ ...r, line: r.line === "zigzag" ? "solid" : "zigzag" })));

    case "toggleDashed":
      return updateSelected(state, (p) => withRoute(p, (r) => ({ ...r, line: r.line === "dashed" ? "solid" : "dashed" })));

    case "cycleEnd":
      return updateSelected(state, (p) =>
        withRoute(p, (r) => ({ ...r, end: END_CYCLE[(END_CYCLE.indexOf(r.end) + 1) % END_CYCLE.length] })),
      );

    case "toggleCorners":
      return updateSelected(state, (p) => withRoute(p, (r) => ({ ...r, corners: r.corners === "rounded" ? "sharp" : "rounded" })));

    case "applyTemplate":
      return updateSelected(state, (p) => ({ ...p, route: templateRoute(p, action.id, action.fieldWidth, p.route ?? undefined, action.side, action.maxY) }));

    case "toggleStar":
      return updateSelected(state, (p) => ({ ...p, starred: !p.starred }));

    case "toggleZone":
      return updateSelected(state, (p) => ({ ...p, zone: p.zone ? null : { radius: DEFAULT_ZONE_RADIUS } }));

    case "setZoneRadius": {
      const radius = Math.min(ZONE_RADIUS_RANGE.max, Math.max(ZONE_RADIUS_RANGE.min, action.radius));
      return updateSelected(state, (p) => ({ ...p, zone: { radius } }), action.commit === false ? step : commit);
    }

    case "setPlayer": {
      const { label, ...rest } = action.patch;
      const patch = label !== undefined && label.trim() !== "" ? { ...rest, label } : rest;
      return updateSelected(state, (p) => ({ ...p, ...patch }));
    }

    case "flip":
      if (play.locked) return state;
      return commit(state, {
        ...play,
        players: mirrorPlayers(play.players, action.fieldWidth),
        opponent: mirrorPlayers(play.opponent, action.fieldWidth),
      });

    case "setSettings":
      return commit(state, { ...play, settings: { ...play.settings, ...action.patch } });

    case "setFront": {
      if (play.locked) return state;
      return commit(state, {
        ...play,
        players: action.players ? reseat(play.players, action.players, play.settings.front ?? "4-3") : play.players,
        opponent: action.opponent ?? play.opponent,
        // Picking the opponent's front on offense shows it.
        settings: { ...play.settings, front: action.front, showOpponent: action.opponent ? true : play.settings.showOpponent },
      });
    }

    case "setLocked":
      // Not an edit: the lock stays out of the undo history.
      return {
        ...state,
        play: play.locked === action.locked ? play : { ...play, locked: action.locked },
        selectedId: action.locked ? null : state.selectedId,
        gesture: null,
      };

    case "reset":
      return initEditor(action.play);

    case "undo": {
      const prev = state.past[state.past.length - 1];
      if (!prev || play.locked) return state;
      return { ...state, play: { ...prev, locked: play.locked }, past: state.past.slice(0, -1), future: [play, ...state.future], gesture: null };
    }

    case "redo": {
      const next = state.future[0];
      if (!next || play.locked) return state;
      return { ...state, play: { ...next, locked: play.locked }, past: [...state.past, play], future: state.future.slice(1), gesture: null };
    }
  }
}

export const PLAYER_COLORS: PlayerColor[] = ["volt", "ice", "amber", "signal", "violet", "teal", "chalk", "slate"];
