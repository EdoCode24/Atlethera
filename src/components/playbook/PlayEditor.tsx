"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useCanEdit } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button, Choice, Dialog, IconButton } from "@/components/app/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { playbookRepo } from "@/data/playbooks";
import { useStored, write } from "@/data/store";
import { editorReducer, GRID_STEP, initEditor, PLAYER_COLORS, ZONE_RADIUS_RANGE, type PlayContent } from "@/domain/playbook/editor";
import { BALL_ON_OPTIONS, backfieldDepth, withFittedDepth } from "@/domain/playbook/factory";
import { defaultFormation, opponentFormation } from "@/domain/playbook/formations";
import { DEFENSE_FRONTS, FRONTS, type DefenseFront } from "@/domain/playbook/fronts";
import { dist, mirrorPlayers, snapValue } from "@/domain/playbook/geometry";
import { planPlayback, positionAt, YARDS_PER_SECOND } from "@/domain/playbook/playback";
import type { BreakSide } from "@/domain/playbook/routes";
import type { Backfield, FieldSettings, Play, Playbook, PlayerSpot, Route, Vec } from "@/domain/playbook/types";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/fill";
import { usePlaybookContext } from "./hooks";
import { PlayInfoDialog } from "./PlayDialogs";
import { PLAYER_FILL, PlayField, playerRadius, type ViewBox } from "./PlayField";
import { RouteTree } from "./RouteTree";

const SPEEDS = [0.5, 1, 2] as const;
/** Out-of-bounds turf shown beside each sideline, in yards. The tool rail takes the room on the left. */
const SIDE_MARGIN = 0.6;
/** Pixels per yard up to which players and strokes grow with the screen. */
const REFERENCE_PPY = 40;
/**
 * On tall screens the backfield takes at least this share of the height, so the formation is not
 * squeezed into a corner. A defense gets more: its coverage happens behind it.
 */
const BACKFIELD_SHARE: Record<"offense" | "defense", Record<Backfield, number>> = {
  offense: { less: 0.2, standard: 0.3, more: 0.4 },
  defense: { less: 0.35, standard: 0.45, more: 0.55 },
};
/** Yards always visible past the line of scrimmage. */
const MIN_UPFIELD = 4;
/** Up-field yards the "deep field" view shows, per sport. */
const DEEP_UPFIELD = { "flag-football": 20, "american-football": 25 } as const;
/**
 * The full-width board may narrow this much (to 88% of the width) to fit the team; anything that
 * still does not fit is cut at the edge, and the "deep field" view shows all of it.
 */
const FILL_MIN = 0.88;
/** Yards the backfield may grow once per drag when a player is pushed into the bottom edge. */
const EDGE_GROW = 3;
/** Special-teams token radius on screen, in pixels: the usual size, and the smallest a tight line gets. */
const SPECIAL_TOKEN_PX = 20;
const SPECIAL_TOKEN_MIN_PX = 9;

/** The shortest distance between two players, in yards (Infinity for fewer than two). */
function tightest(players: PlayerSpot[]): number {
  let min = Infinity;
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) min = Math.min(min, dist(players[i], players[j]));
  return min;
}
const DRAG_THRESHOLD = 0.2;
/** Style of a route a player does not have yet; the reducer starts new routes the same way. */
const NEW_ROUTE: Omit<Route, "points"> = { line: "solid", end: "arrow", corners: "sharp" };

type Gesture =
  /** `floor`: where the backfield grew to when he was pushed into the bottom edge (once per drag). */
  | { kind: "player"; id: string; offset: Vec; origin: Vec; moved: boolean; floor?: number }
  | { kind: "opponent"; id: string; offset: Vec; origin: Vec; moved: boolean }
  | { kind: "point"; index: number; moved: boolean }
  | { kind: "draw"; to: Vec; floor?: number };

interface Playback {
  t: number;
  playing: boolean;
  speed: (typeof SPEEDS)[number];
}

const content = (p: Play): PlayContent => {
  // Special-teams plays made before the board compressed their depth are fitted once, when opened
  // (the autosave then marks them fitted).
  const f = withFittedDepth(p);
  return { players: f.players, opponent: f.opponent, settings: f.settings, locked: f.locked };
};

/** The nearest token within `reach` of the pointer: on a tight line the first match could be the neighbour. */
function nearest(list: PlayerSpot[], p: Vec, reach: number): PlayerSpot | null {
  let best: PlayerSpot | null = null;
  let bestDist = reach;
  for (const q of list) {
    const d = dist(q, p);
    if (d <= bestDist) {
      bestDist = d;
      best = q;
    }
  }
  return best;
}

/** Keys typed into a text field or pressed with a dialog open belong there, not to the board. */
function boardKey(e: KeyboardEvent): boolean {
  if (document.querySelector("dialog[open]")) return false;
  const target = e.target as HTMLElement | null;
  if (!target) return true;
  if (target.isContentEditable || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return false;
  return !(target.tagName === "INPUT" && (target as HTMLInputElement).type !== "range");
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function PlayEditor({ playbookId, playId }: { playbookId: string; playId: string }) {
  const { t } = useApp();
  const href = useHref();
  const { user, workspace, books, formatDate } = usePlaybookContext();
  if (!user || !workspace) return null;
  const book = books.find((b) => b.id === playbookId);
  const play = book?.plays.find((p) => p.id === playId);
  if (!book || !play) {
    return (
      <div className="px-8 py-14">
        <p className="text-chalk-dim">{t.playbook.playNotFound}</p>
        <a href={href("/panel/playbook")} className="mt-4 inline-block font-semibold text-volt underline underline-offset-4">
          {t.playbook.title}
        </a>
      </div>
    );
  }
  return <Editor key={play.id} book={book} play={play} books={books} author={user.name} formatDate={formatDate} />;
}

/**
 * One fixed screen, like the reference app: the field fills the width, the team leans against the
 * bottom edge (more or less, by the backfield setting), and nothing scrolls. When the team does not
 * fit, the board narrows a little (FILL_MIN) and cuts the rest; the "deep field" view instead shows
 * DEEP_UPFIELD yards and everything drawn, with turf beside the sidelines. The backfield is measured
 * from `measure`, the players as they stand (frozen while something is being dragged, so the field
 * does not shift under the pointer). `ghosts` are the other side's players whose depth should fit
 * (special teams' facing unit, the offense's backfield on defense); `special` sizes tokens for
 * special teams.
 */
function useFieldView(
  sport: Playbook["sport"],
  side: Play["side"],
  fieldWidth: number,
  settings: FieldSettings,
  measure: PlayerSpot[],
  ghosts: PlayerSpot[],
  special: boolean,
) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 700 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const deep = settings.view === "deep";
  const fillScale = size.w / (fieldWidth + SIDE_MARGIN * 2);
  const base = playerRadius(sport);
  // Special teams: tokens keep a fixed size on screen and shrink toward half the tightest spacing,
  // since a punt or field-goal line stands a yard apart, but never below a readable size.
  const spacing = special ? Math.min(tightest(measure), tightest(ghosts)) : Infinity;
  const radiusAt = (s: number) =>
    special ? Math.max(SPECIAL_TOKEN_MIN_PX / s, Math.min(SPECIAL_TOKEN_PX / s, spacing * 0.5)) : base * Math.min(1, REFERENCE_PPY / s);
  // Up-field room: the ghosts to fit (plus room for a hint at the top), the deep view's yards, or MIN_UPFIELD.
  const far = ghosts.length ? Math.max(...ghosts.map((p) => p.y)) : 0;
  // Routes already drawn stay on screen when the backfield setting grows, and an end zone ahead is
  // shown whole when it can be.
  const drawnTop = Math.max(0, ...measure.flatMap((p) => p.route?.points.map((pt) => pt.y) ?? []));
  const endLine = settings.ballOn !== null && side === "offense" ? settings.ballOn + 10.3 : 0;
  const reachAt = (s: number) =>
    Math.max(deep ? DEEP_UPFIELD[sport] : MIN_UPFIELD, ghosts.length ? far + 1.2 + 44 / s : 0, drawnTop ? drawnTop + 0.8 + 24 / s : 0, endLine);
  const needAt = (s: number) => backfieldDepth(measure, radiusAt(s), "less") + reachAt(s) + 0.3;
  const floor = deep ? 0 : fillScale * FILL_MIN;
  // Two passes: the room and the tokens depend on the zoom.
  const fitAt = (s: number) => clamp(size.h / needAt(s), floor, fillScale);
  const scale = fitAt(fitAt(fillScale));
  const reach = reachAt(scale);
  /** Size factor for players and strokes, so they keep their size on screen. */
  const k = radiusAt(scale) / base;
  const w = size.w / scale;
  const h = size.h / scale;
  const r = base * k;
  const least = backfieldDepth(measure, r, "less");
  const share = BACKFIELD_SHARE[side === "defense" ? "defense" : "offense"][settings.backfield];
  const wanted = Math.max(backfieldDepth(measure, r, settings.backfield), h * share);
  // More backfield never pushes the line of scrimmage out of sight; the team itself comes first.
  const bottom = -Math.max(least, Math.min(wanted, h - reach));
  const view = useMemo<ViewBox>(() => ({ x: fieldWidth / 2 - w / 2, y: -(bottom + h), w, h }), [fieldWidth, w, h, bottom]);
  return { box, size, view, scale, k };
}

/** A toolbar button with a short caption under the icon; the full name is its accessible label. */
function ToolbarButton({
  icon,
  label,
  caption,
  active,
  danger,
  accent,
  disabled,
  onClick,
  children,
}: {
  icon?: IconName;
  label: string;
  caption: string;
  active?: boolean;
  danger?: boolean;
  accent?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-1 rounded-[0.8rem] px-1.5 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30 sm:h-14 sm:min-w-[3.6rem] md:w-full md:min-w-0",
        active ? "bg-chalk text-night-950" : danger ? "text-signal enabled:hover:bg-signal/12" : accent ? "text-volt enabled:hover:bg-volt/12" : "text-chalk-dim enabled:hover:bg-chalk/8 enabled:hover:text-chalk",
      )}
    >
      {children ?? (icon && <Icon name={icon} className="size-5" />)}
      <span className="hidden text-[0.64rem] leading-none font-semibold sm:block">{caption}</span>
    </button>
  );
}

function ToolButton({ icon, label, active, onClick, disabled }: { icon: IconName; label: string; active?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <IconButton label={label} active={active} onClick={onClick} disabled={disabled}>
      <Icon name={icon} className="size-5" />
    </IconButton>
  );
}

const Divider = () => <span aria-hidden="true" className="mx-1 h-8 w-px shrink-0 bg-hairline md:mx-auto md:my-1.5 md:h-px md:w-8" />;

function Editor({ book, play, books, author, formatDate }: { book: Playbook; play: Play; books: Playbook[]; author: string; formatDate: (iso: string) => string }) {
  const { t, locale } = useApp();
  const href = useHref();
  const router = useRouter();
  // Players study the play: it opens locked, can be played back, and is never saved.
  const readOnly = !useCanEdit();
  const [state, dispatch] = useReducer(editorReducer, readOnly ? { ...content(play), locked: true } : content(play), initEditor);
  const { players, opponent, settings, locked } = state.play;
  const selected = players.find((p) => p.id === state.selectedId) ?? null;
  /** Both teams as they stood when a drag began; the view measures these until it ends, so it never moves under the pointer. */
  const [frozen, setFrozen] = useState<Pick<PlayContent, "players" | "opponent"> | null>(null);
  const measured = frozen ?? state.play;
  const special = play.side === "special";
  // Depth to fit from the other side: the facing unit on special teams, the offense's backfield
  // (up to 8 yards) on defense, nothing on offense (routes go there).
  const ghosts = !settings.showOpponent || play.side === "offense" ? [] : special ? measured.opponent : measured.opponent.filter((p) => p.y <= 8);
  const { box, size, view, scale, k } = useFieldView(book.sport, play.side, book.fieldWidth, settings, measured.players, ghosts, special);
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [guide, setGuide] = useState<Vec | null>(null);
  /** The end of the segment being drawn, shown as part of the route until the finger lifts. */
  const [live, setLive] = useState<Vec | null>(null);
  const [panel, setPanel] = useState<"none" | "template" | "player">("none");
  const [templates, setTemplates] = useState<Record<string, { id: string | null; side: BreakSide | null }>>({});
  const [dialog, setDialog] = useState<"none" | "info" | "field">("none");
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [lockedHint, setLockedHint] = useState(false);
  const [menu, setMenu] = useState(false);
  /** One-time hints: once the coach has selected a player / drawn a segment, they stay away. */
  const hintsSeen = useStored<{ select?: boolean; draw?: boolean }>("hints.editor", {});
  const seeHint = (key: "select" | "draw") => {
    if (!hintsSeen[key]) write("hints.editor", { ...hintsSeen, [key]: true });
  };
  const sliderDrag = useRef(false);
  const [labelDraft, setLabelDraft] = useState<string | null>(null);
  const r = playerRadius(book.sport) * k;
  const tb = t.playbook.toolbar;
  const ed = t.playbook.editor;

  // ── Autosave: debounce while editing, flush when leaving.
  const [savedPlay, setSavedPlay] = useState(state.play);
  const pending = useRef<Partial<Play> | null>(null);
  // A special-teams play is saved as fitted, so it is never compressed again.
  const fitted = play.side === "special";
  useEffect(() => {
    if (readOnly || state.play === savedPlay) return;
    const patch = { ...state.play, ...(fitted ? { depthFitted: true } : {}) };
    pending.current = patch;
    const id = window.setTimeout(() => {
      playbookRepo.updatePlay(book.workspaceId, book.id, play.id, patch, author);
      pending.current = null;
      setSavedPlay(state.play);
    }, 300);
    return () => window.clearTimeout(id);
  }, [state.play, savedPlay, fitted, book.workspaceId, book.id, play.id, author, readOnly]);
  useEffect(() => {
    const flush = () => {
      if (pending.current) playbookRepo.updatePlay(book.workspaceId, book.id, play.id, pending.current, author);
      pending.current = null;
    };
    // Closing or reloading the tab within the debounce must not lose the last change.
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [book.workspaceId, book.id, play.id, author]);
  const saved = state.play === savedPlay;

  // ── Playback clock.
  const plan = useMemo(() => planPlayback(players), [players]);
  useEffect(() => {
    if (!playback?.playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPlayback((pb) => {
        if (!pb) return pb;
        const next = pb.t + dt * pb.speed;
        return next >= plan.duration ? { ...pb, t: plan.duration, playing: false } : { ...pb, t: next };
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playback?.playing, plan.duration]);
  const positions = useMemo(() => {
    if (!playback) return null;
    return Object.fromEntries(plan.tracks.map((tr) => [tr.id, positionAt(tr, plan, playback.t, YARDS_PER_SECOND)]));
  }, [playback, plan]);

  // ── Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!boardKey(e)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      } else if (e.key === "Escape") {
        dispatch({ type: "select", id: null });
        setPanel("none");
      } else if (e.key === "Backspace" || e.key === "Delete") {
        dispatch({ type: "removeLastPoint" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Pointer input on the field.
  const toYards = (e: ReactPointerEvent<SVGSVGElement>): Vec => {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: pt.x, y: -pt.y };
  };
  // With a player selected, other tokens are hit only close to their centre, so short steps next to
  // a teammate on a tight line still draw.
  const hitOwn = (p: Vec) => nearest(players, p, r * (selected ? 1.1 : 1.35));
  /**
   * A block, a rush, a man-coverage line or a special-teams assignment aimed at a grey player lands
   * on him (Shift keeps the free angle). Offensive routes are not pulled onto defenders.
   */
  const snapsToGhost = play.side !== "offense" || selected?.route?.end === "block";
  const onGhost = (p: Vec) => (settings.showOpponent && snapsToGhost ? nearest(opponent, p, r * 1.35) : null);
  const routeEnd = (p: PlayerSpot): Vec => p.route?.points.at(-1) ?? { x: p.x, y: p.y };
  const clampToView = (v: Vec): Vec => ({
    x: clamp(v.x, -0.5, book.fieldWidth + 0.5),
    y: clamp(v.y, -(view.y + view.h) + 0.5, -view.y - 0.5),
  });
  /** A dragged token stays whole on screen: it reaches a star tip or its drop shadow past its centre. */
  const clampToken = (v: Vec, p: PlayerSpot | undefined): Vec => {
    const reach = r * (p?.starred ? 1.45 : p?.shape === "triangle" ? 1.25 : 1) + 0.16 * k;
    return {
      x: clamp(v.x, Math.max(-0.5, view.x + reach), Math.min(book.fieldWidth + 0.5, view.x + view.w - reach)),
      y: clamp(v.y, -(view.y + view.h) + reach, -view.y - reach),
    };
  };
  /** Where a new segment ends: on the pointer, at a 45° step with Shift, on the grid when snapping. */
  const segmentEnd = (p: Vec, shift: boolean): Vec => {
    const ghost = shift ? null : onGhost(p);
    if (ghost) return { x: ghost.x, y: ghost.y };
    let to = clampToView(p);
    if (shift && selected) {
      const from = routeEnd(selected);
      const step = Math.PI / 4;
      const a = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / step) * step;
      const d = dist(from, to);
      to = clampToView({ x: from.x + Math.cos(a) * d, y: from.y + Math.sin(a) * d });
    }
    return settings.snap ? { x: snapValue(to.x, GRID_STEP), y: snapValue(to.y, GRID_STEP) } : to;
  };
  const endGesture = () => {
    gesture.current = null;
    setLive(null);
    setGuide(null);
    setFrozen(null);
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (playback) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = toYards(e);
    if (locked) {
      setLockedHint(true);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setFrozen({ players, opponent });
    const own = hitOwn(p);
    if (own) {
      if (own.id !== state.selectedId) {
        dispatch({ type: "select", id: own.id });
        setPanel("none");
        seeHint("select");
      }
      gesture.current = { kind: "player", id: own.id, offset: { x: own.x - p.x, y: own.y - p.y }, origin: p, moved: false };
      setGuide({ x: own.x, y: own.y });
      return;
    }
    if (selected?.route) {
      const index = selected.route.points.findIndex((pt) => dist(pt, p) <= 0.7 * k);
      if (index >= 0) {
        // The undo step starts when the corner actually moves, so a tap on it changes nothing.
        gesture.current = { kind: "point", index, moved: false };
        setGuide(p);
        return;
      }
    }
    // Grey players are moved only when nobody is selected; with a player selected, a tap on them draws.
    if (!selected && settings.showOpponent) {
      const opp = nearest(opponent, p, r * 1.35);
      if (opp) {
        gesture.current = { kind: "opponent", id: opp.id, offset: { x: opp.x - p.x, y: opp.y - p.y }, origin: p, moved: false };
        setGuide({ x: opp.x, y: opp.y });
        return;
      }
    }
    if (selected) {
      // The segment appears the moment the field is pressed; dragging moves its end.
      const to = segmentEnd(p, e.shiftKey);
      gesture.current = { kind: "draw", to };
      setLive(to);
      setGuide(to);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (playback) return;
    const g = gesture.current;
    if (!g) return;
    const p = toYards(e);
    if (g.kind === "player" || g.kind === "opponent") {
      if (!g.moved && dist(p, g.origin) < DRAG_THRESHOLD) return;
      if (!g.moved) {
        g.moved = true;
        dispatch({ type: "beginGesture" });
      }
      const token = (g.kind === "player" ? players : opponent).find((q) => q.id === g.id);
      const want = { x: p.x + g.offset.x, y: p.y + g.offset.y };
      const to = clampToken(want, token);
      if (g.kind === "player" && g.floor === undefined && want.y < to.y - 0.05) {
        // Pushed into the bottom edge: the backfield grows once, by a fixed step, and the view stays
        // put after that. (Following the pointer would feed back: the grown view maps the same pixel
        // deeper on every move.)
        const floor = to.y - EDGE_GROW;
        g.floor = floor;
        setFrozen((f) => f && { ...f, players: f.players.map((q) => (q.id === g.id ? { ...q, y: Math.min(q.y, floor) } : q)) });
      }
      dispatch({ type: g.kind === "player" ? "movePlayer" : "moveOpponent", id: g.id, to, commit: false });
      setGuide(to);
    } else if (g.kind === "point") {
      if (!g.moved) {
        g.moved = true;
        dispatch({ type: "beginGesture" });
      }
      const to = clampToView(p);
      dispatch({ type: "movePoint", index: g.index, to });
      setGuide(to);
    } else {
      const lowest = -(view.y + view.h) + 0.5;
      if (selected && g.floor === undefined && p.y < lowest) {
        // Pushing a segment into the bottom edge: the backfield grows once, by a fixed step, so a drop
        // or a path behind the formation can be drawn.
        const floor = lowest - EDGE_GROW;
        g.floor = floor;
        const reachDown = { x: p.x, y: floor };
        setFrozen((f) => f && { ...f, players: f.players.map((q) => (q.id === selected.id ? { ...q, route: { ...NEW_ROUTE, ...q.route, points: [...(q.route?.points ?? []), reachDown] } } : q)) });
      }
      g.to = segmentEnd(p, e.shiftKey);
      setLive(g.to);
      setGuide(g.to);
    }
  };

  const onPointerUp = () => {
    const g = gesture.current;
    if (g?.kind === "draw") {
      dispatch({ type: "addPoint", to: g.to });
      seeHint("draw");
    }
    endGesture();
  };

  const toggleLock = () => {
    if (readOnly) return;
    dispatch({ type: "setLocked", locked: !locked });
    setLockedHint(false);
  };

  const flip = () => {
    dispatch({ type: "flip", fieldWidth: book.fieldWidth });
    // Remembered template sides flip with the play.
    setTemplates((all) =>
      Object.fromEntries(Object.entries(all).map(([id, v]) => [id, { ...v, side: v.side === "left" ? "right" : v.side === "right" ? "left" : null }])),
    );
  };

  const startPlayback = () => {
    dispatch({ type: "select", id: null });
    setPanel("none");
    setPlayback({ t: 0, playing: true, speed: 1 });
  };

  // ── Route templates: the last one placed on each player, and the side its break goes.
  const tpl = selected ? (templates[selected.id] ?? { id: null, side: null }) : null;
  const applyTemplate = (id: string, side: BreakSide | null) => {
    if (!selected) return;
    // Keep the whole route on the screen, a yard under the top edge, and inside the end zone.
    const maxY = Math.min(-view.y - 1.2, settings.ballOn !== null ? settings.ballOn + 9.5 : Infinity);
    dispatch({ type: "applyTemplate", id, fieldWidth: book.fieldWidth, side: side ?? undefined, maxY });
    setTemplates((all) => ({ ...all, [selected.id]: { id, side } }));
  };
  const chooseSide = (side: BreakSide) => {
    if (!selected || !tpl) return;
    if (tpl.id) applyTemplate(tpl.id, side);
    else setTemplates((all) => ({ ...all, [selected.id]: { id: null, side } }));
  };

  // The selected route with the segment still being drawn, so the end marker sits on its tip.
  const shown = useMemo(() => {
    if (!live || !selected) return players;
    return players.map((p) => (p.id === selected.id ? { ...p, route: { ...NEW_ROUTE, ...p.route, points: [...(p.route?.points ?? []), live] } } : p));
  }, [players, live, selected]);

  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const readout =
    live && selected
      ? {
          left: clamp((live.x - view.x) * scale, 70, size.w - 70),
          top: clamp((-live.y - view.y) * scale - 52, 12, size.h - 40),
          segment: fill(ed.segment, { n: nf.format(Math.round(dist(routeEnd(selected), live) * 2) / 2) }),
          depth: special && Math.abs(live.y) > 6 ? "" : fill(live.y >= 0 ? ed.depth : ed.behind, { n: nf.format(Math.round(Math.abs(live.y) * 2) / 2) }),
        }
      : null;

  const route = selected?.route;
  const hasPoints = !!route && route.points.length > 0;
  const tools = !!selected && !playback && !locked;
  // Panels open on the side of the field away from the selected player.
  const panelSide = selected && selected.x <= book.fieldWidth / 2 ? "md:right-3" : "md:left-3";
  const endStyle = route?.end ?? "arrow";
  const corners = route?.corners ?? "sharp";
  const endIcon: IconName = endStyle === "arrow" ? "endArrow" : endStyle === "block" ? "endBlock" : "endDot";

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-night-950">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-hairline bg-night-900 px-2 sm:px-3">
        <a
          href={href(`/panel/playbook/${book.id}`)}
          onClick={(e) => {
            e.preventDefault();
            router.push(href(`/panel/playbook/${book.id}`));
          }}
          aria-label={ed.back}
          title={ed.back}
          className="grid size-11 shrink-0 place-items-center rounded-[0.7rem] text-chalk-dim hover:bg-chalk/8 hover:text-chalk"
        >
          <Icon name="chevronLeft" className="size-5" />
        </a>
        <button type="button" onClick={() => setDialog("info")} className="min-w-0 max-w-[14rem] shrink truncate rounded-md px-1 text-left">
          <span className="block truncate text-[0.95rem] font-semibold">{play.name}</span>
          <span className="block truncate text-[0.75rem] text-mist">
            {book.name}, {t.playbook.sides[play.side]}
          </span>
        </button>
        <div className="mx-auto flex items-center gap-0.5">
          {/* Phones keep Play in the bar and move the rest into the menu. */}
          <div className="hidden items-center gap-0.5 sm:flex">
            <ToolButton icon="info" label={ed.info} onClick={() => setDialog("info")} />
            {!readOnly && <ToolButton icon={locked ? "lock" : "unlock"} label={locked ? ed.unlock : ed.lock} active={locked} onClick={toggleLock} />}
            <ToolButton icon="field" label={ed.fieldOptions} onClick={() => setDialog("field")} />
            {!readOnly && <ToolButton icon="flip" label={ed.flip} onClick={flip} disabled={locked} />}
          </div>
          <ToolButton icon="play" label={ed.play} active={playback !== null} onClick={startPlayback} />
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {!readOnly && (
            <>
              <ToolButton icon="undo" label={ed.undo} onClick={() => dispatch({ type: "undo" })} disabled={locked || state.past.length === 0} />
              <span className="hidden sm:contents">
                <ToolButton icon="redo" label={ed.redo} onClick={() => dispatch({ type: "redo" })} disabled={locked || state.future.length === 0} />
              </span>
              <span role="status" className="hidden w-24 text-right text-[0.78rem] text-mist sm:block">
                {saved ? t.common.saved : t.common.saving}
              </span>
            </>
          )}
          <div className="relative sm:hidden">
            <ToolButton icon="more" label={ed.more} active={menu} onClick={() => setMenu(!menu)} />
            {menu && (
              <div role="menu" className="absolute top-12 right-0 z-50 w-56 rounded-[1rem] bg-night-850 p-1.5 shadow-[0_0_0_1px_var(--color-hairline-strong),0_24px_60px_-20px_rgb(0_0_0/0.9)]">
                {(
                  [
                    ["info", ed.info, () => setDialog("info"), false],
                    ...(readOnly
                      ? []
                      : [
                          [locked ? "lock" : "unlock", locked ? ed.unlock : ed.lock, toggleLock, false],
                          ["field", ed.fieldOptions, () => setDialog("field"), false],
                          ["flip", ed.flip, flip, locked],
                          ["redo", ed.redo, () => dispatch({ type: "redo" }), locked || state.future.length === 0],
                        ]),
                    ...(readOnly ? [["field", ed.fieldOptions, () => setDialog("field"), false]] : []),
                  ] as [IconName, string, () => void, boolean][]
                ).map(([icon, label, act, off]) => (
                  <button
                    key={label}
                    type="button"
                    role="menuitem"
                    disabled={off}
                    onClick={() => {
                      setMenu(false);
                      act();
                    }}
                    className="flex h-11 w-full items-center gap-3 rounded-[0.7rem] px-3 text-left text-[0.9rem] text-chalk-dim hover:bg-chalk/8 hover:text-chalk disabled:opacity-35"
                  >
                    <Icon name={icon} className="size-5" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      {/* Field */}
      <div ref={box} className="relative order-1 min-h-0 flex-1 overflow-hidden md:order-2">
        <PlayField
          svgRef={svgRef}
          sport={book.sport}
          fieldWidth={book.fieldWidth}
          fieldLines={book.fieldLines}
          settings={settings}
          players={shown}
          opponent={opponent}
          view={view}
          sizeScale={k}
          selectedId={playback ? null : state.selectedId}
          positions={positions}
          guide={guide}
          showHandles={!playback && !locked}
          label={ed.canvas}
          goalBehind={play.side === "defense"}
          compressBeyond={special ? 6 : null}
          compressedLabel={special ? ed.compressed : undefined}
          className="play-canvas absolute inset-0 size-full"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={endGesture}
        />

        {readout && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-[6] flex -translate-x-1/2 items-baseline gap-2 rounded-full bg-night-950/85 px-3 py-1.5 whitespace-nowrap shadow-[0_0_0_1px_var(--color-hairline-strong)] backdrop-blur-sm"
            style={{ left: readout.left, top: readout.top }}
          >
            <span className="tabular text-[0.85rem] font-semibold text-chalk">{readout.segment}</span>
            <span className="text-[0.72rem] text-mist">{readout.depth}</span>
          </div>
        )}

        {/* Hints */}
        {!playback && !selected && (locked || lockedHint || !hintsSeen.select) && (
          <p className="pointer-events-none absolute top-3 left-1/2 z-[5] w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-night-950/80 px-4 py-2 text-center text-[0.82rem] text-chalk-dim">
            {readOnly ? ed.viewOnly : locked || lockedHint ? ed.locked : ed.hintSelect}
          </p>
        )}
        {!playback && book.sport === "american-football" && size.w < 520 && size.h > size.w && (
          <p className="pointer-events-none absolute right-2 bottom-2 left-2 z-[5] rounded-[0.8rem] bg-night-950/85 px-3 py-2 text-center text-[0.78rem] text-chalk-dim">
            {ed.rotate}
          </p>
        )}
        {!playback && selected && !hasPoints && !live && panel === "none" && !hintsSeen.draw && (
          <p className="pointer-events-none absolute top-3 left-1/2 z-[5] w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-night-950/80 px-4 py-2 text-center text-[0.82rem] text-chalk-dim">
            {ed.hintDraw}
            <span className="hidden text-mist [@media(pointer:fine)]:inline"> {ed.hintShift}</span>
          </p>
        )}

        {/* Panels: a flyout beside the field on tablets and desktops, a bottom sheet on phones. */}
        {tools && panel !== "none" && (
          <div
            style={{ "--sheet-max": `${Math.max(120, -view.y * scale - 20)}px` } as CSSProperties}
            className={cn(
              "absolute inset-x-2 top-2 z-10 max-h-[var(--sheet-max)] overflow-y-auto overscroll-contain rounded-[1.2rem] bg-night-850/95 shadow-[0_0_0_1px_var(--color-hairline-strong),0_24px_60px_-20px_rgb(0_0_0/0.9)] backdrop-blur-md",
              // Tablets and desktops: a slim column at the edge of the field away from the player.
              "md:inset-x-auto md:top-3 md:max-h-[calc(100%-1.5rem)] md:w-[12.5rem]",
              panelSide,
            )}
          >
            {panel === "template" && tpl && (
              <RouteTree
                layout={size.w >= 700 ? "column" : "row"}
                room={-view.y - 1.2 - selected.y}
                player={selected}
                fieldWidth={book.fieldWidth}
                activeId={tpl.id}
                side={tpl.side}
                onApply={(id) => applyTemplate(id, tpl.side)}
                onSide={chooseSide}
              />
            )}

            {panel === "player" && (
              <div className="flex flex-wrap items-center gap-3 p-3 md:flex-col md:items-stretch">
                <label className="flex items-center gap-2 text-[0.82rem] text-mist">
                  {tb.playerLabel}
                  <input
                    key={selected.id}
                    value={labelDraft ?? selected.label}
                    maxLength={3}
                    onChange={(e) => {
                      // A blank label is kept as a draft only; the token keeps its letters until new ones are typed.
                      const next = e.target.value.toLocaleUpperCase(locale);
                      setLabelDraft(next);
                      if (next.trim()) dispatch({ type: "setPlayer", patch: { label: next } });
                    }}
                    onBlur={() => setLabelDraft(null)}
                    onKeyDown={(e) => e.key === "Escape" && (e.currentTarget as HTMLInputElement).blur()}
                    className="h-10 w-16 rounded-[0.55rem] bg-night-950/70 px-2 text-center font-semibold text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]"
                  />
                </label>
                <div role="group" aria-label={tb.playerColor} className="flex flex-wrap gap-1.5">
                  {PLAYER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={tb.colors[c]}
                      title={tb.colors[c]}
                      aria-pressed={selected.color === c}
                      onClick={() => dispatch({ type: "setPlayer", patch: { color: c } })}
                      className={cn("size-9 rounded-full", selected.color === c && "ring-2 ring-chalk ring-offset-2 ring-offset-night-850")}
                      style={{ background: PLAYER_FILL[c].fill }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Tool rail: the empty strip left of the field on tablets and desktops, a bar under it on phones. */}
      <div
        role="toolbar"
        aria-label={playback ? t.playbook.playback.label : tb.label}
        aria-orientation="vertical"
        className="order-2 flex shrink-0 items-center gap-0.5 overflow-x-auto border-t border-hairline bg-night-900 p-1.5 md:order-1 md:w-[4.75rem] md:flex-col md:items-stretch md:overflow-x-hidden md:overflow-y-auto md:border-t-0 md:border-r md:px-2 md:py-2.5"
      >
        {playback ? (
          // Playback controls live in the rail, so nothing covers the players while they run.
          <>
            <ToolbarButton
              label={`${t.playbook.playback.speed}: ${playback.speed}×`}
              caption={t.playbook.playback.speed}
              onClick={() => setPlayback({ ...playback, speed: SPEEDS[(SPEEDS.indexOf(playback.speed) + 1) % SPEEDS.length] })}
            >
              <span className="tabular text-[0.95rem] font-semibold">{playback.speed}×</span>
            </ToolbarButton>
            <ToolbarButton icon="restart" label={t.playbook.playback.restart} caption={t.playbook.playback.restart} onClick={() => setPlayback({ ...playback, t: 0, playing: false })} />
            <ToolbarButton
              icon={playback.playing ? "pause" : "play"}
              label={playback.playing ? t.playbook.playback.pause : t.playbook.playback.play}
              caption={playback.playing ? t.playbook.playback.pause : t.playbook.playback.play}
              active
              onClick={() => setPlayback({ ...playback, playing: !playback.playing, t: playback.t >= plan.duration ? 0 : playback.t })}
            />
            <ToolbarButton icon="replay" label={t.playbook.playback.replay} caption={t.playbook.playback.replay} onClick={() => setPlayback({ ...playback, t: 0, playing: true })} />
            <span aria-hidden="true" className="hidden md:block md:flex-1" />
            <div className="sticky right-0 bottom-0 z-[1] -my-1.5 flex shrink-0 bg-night-900 py-1.5 pl-1 md:my-0 md:pt-1 md:pb-0 md:pl-0">
              <ToolbarButton icon="done" label={t.playbook.playback.done} caption={t.playbook.playback.done} accent onClick={() => setPlayback(null)} />
            </div>
          </>
        ) : (
          <>
        <ToolbarButton label={tb.player} caption={selected ? tb.short.player : "—"} active={tools && panel === "player"} disabled={!tools} onClick={() => setPanel(panel === "player" ? "none" : "player")}>
          {selected ? (
            <span className="grid size-6 place-items-center rounded-full text-[0.7rem] font-bold" style={{ background: PLAYER_FILL[selected.color].fill, color: PLAYER_FILL[selected.color].text }}>
              {selected.label.slice(0, 2)}
            </span>
          ) : (
            <span aria-hidden="true" className="size-6 rounded-full border-2 border-dashed border-mist/60" />
          )}
        </ToolbarButton>
        {play.side === "offense" && (
          <ToolbarButton icon="template" label={tb.template} caption={tb.short.template} active={tools && panel === "template"} disabled={!tools} onClick={() => setPanel(panel === "template" ? "none" : "template")} />
        )}
        <ToolbarButton icon="star" label={tb.star} caption={tb.short.star} active={tools && !!selected?.starred} disabled={!tools} onClick={() => dispatch({ type: "toggleStar" })} />
        {play.side === "defense" && (
          <>
            <ToolbarButton icon="zone" label={tb.zone} caption={tb.short.zone} active={tools && !!selected?.zone} disabled={!tools} onClick={() => dispatch({ type: "toggleZone" })} />
            <input
              type="range"
              aria-label={tb.zoneRadius}
              min={ZONE_RADIUS_RANGE.min}
              max={ZONE_RADIUS_RANGE.max}
              step={0.5}
              disabled={!tools || !selected?.zone}
              value={selected?.zone?.radius ?? ZONE_RADIUS_RANGE.min}
              onPointerDown={() => {
                sliderDrag.current = true;
                dispatch({ type: "beginGesture" });
              }}
              onPointerUp={() => (sliderDrag.current = false)}
              onChange={(e) => dispatch({ type: "setZoneRadius", radius: Number(e.target.value), commit: !sliderDrag.current })}
              className="mx-1 w-16 shrink-0 accent-[var(--color-chalk)] disabled:opacity-30 sm:w-28 md:mx-auto md:my-1 md:h-24 md:w-6 md:[direction:rtl] md:[writing-mode:vertical-lr]"
            />
          </>
        )}
        <Divider />
        <ToolbarButton icon="zigzag" label={tb.zigzag} caption={tb.short.zigzag} active={tools && route?.line === "zigzag"} disabled={!tools} onClick={() => dispatch({ type: "toggleZigzag" })} />
        <ToolbarButton icon="dashed" label={tb.dashed} caption={tb.short.dashed} active={tools && route?.line === "dashed"} disabled={!tools} onClick={() => dispatch({ type: "toggleDashed" })} />
        <ToolbarButton icon={endIcon} label={fill(tb.end, { style: tb.ends[endStyle] })} caption={tb.endShort[endStyle]} disabled={!tools} onClick={() => dispatch({ type: "cycleEnd" })} />
        <ToolbarButton
          icon={corners === "rounded" ? "cornerRound" : "cornerSharp"}
          label={fill(tb.corners, { style: tb.cornerStyles[corners] })}
          caption={tb.cornerShort[corners]}
          active={tools && corners === "rounded"}
          disabled={!tools}
          onClick={() => dispatch({ type: "toggleCorners" })}
        />
        <Divider />
        <ToolbarButton icon="removeSegment" label={tb.removeSegment} caption={tb.short.remove} danger disabled={!tools || !hasPoints} onClick={() => dispatch({ type: "removeLastPoint" })} />
        <span aria-hidden="true" className="hidden md:block md:flex-1" />
        {/* Pinned to the end of the rail, so it stays in reach when the rail has to scroll. */}
        <div className="sticky right-0 bottom-0 z-[1] -my-1.5 flex shrink-0 bg-night-900 py-1.5 pl-1 md:my-0 md:pt-1 md:pb-0 md:pl-0">
          <ToolbarButton
            icon="done"
            label={tb.done}
            caption={tb.short.done}
            accent
            disabled={!tools}
            onClick={() => {
              dispatch({ type: "select", id: null });
              setPanel("none");
            }}
          />
        </div>
          </>
        )}
      </div>
      </div>

      {dialog === "field" && (
        <Dialog
          open
          onClose={() => setDialog("none")}
          title={t.playbook.field.title}
          footer={<Button onClick={() => setDialog("none")}>{t.common.done}</Button>}
        >
          <FieldOptions
            settings={settings}
            sport={book.sport}
            side={play.side}
            locked={locked}
            onChange={(patch) => dispatch({ type: "setSettings", patch })}
            onFront={(front) => {
              if (front === (settings.front ?? "4-3")) return;
              // Fronts set to the offense's tight end. Find him as the play stands (flipped or dragged
              // across) and mirror the front when he is on the other side.
              const mid = book.fieldWidth / 2;
              const te = (play.side === "defense" ? opponent : players).find((p) => p.label === "TE");
              const mirrored = te ? (play.side === "defense" ? te.x > mid : te.x < mid) : false;
              const side = (list: PlayerSpot[]) => (mirrored ? mirrorPlayers(list, book.fieldWidth) : list);
              dispatch(
                play.side === "defense"
                  ? { type: "setFront", front, players: side(defaultFormation(book.sport, "defense", book.playersPerSide, book.fieldWidth, front)) }
                  : { type: "setFront", front, opponent: side(opponentFormation(book.sport, "offense", book.playersPerSide, book.fieldWidth, front)) },
              );
            }}
          />
        </Dialog>
      )}
      {dialog === "info" && (
        <PlayInfoDialog
          book={book}
          play={play}
          books={books}
          author={author}
          formatDate={formatDate}
          onClose={() => setDialog("none")}
          onDeleted={() => router.replace(href(`/panel/playbook/${book.id}`))}
        />
      )}
    </div>
  );
}

function FieldOptions({
  settings,
  sport,
  side,
  locked,
  onChange,
  onFront,
}: {
  settings: FieldSettings;
  sport: Playbook["sport"];
  side: Play["side"];
  locked: boolean;
  onChange: (patch: Partial<FieldSettings>) => void;
  onFront: (front: DefenseFront) => void;
}) {
  const { t, locale } = useApp();
  const f = t.playbook.field;
  return (
    <div className="space-y-6">
      <div>
        <Choice
          label={f.view}
          value={settings.view ?? "fill"}
          onChange={(view: "fill" | "deep") => onChange({ view })}
          options={[
            { value: "fill", label: f.viewFill },
            { value: "deep", label: f.viewDeep },
          ]}
        />
        <p className="mt-2 text-[0.8rem] text-mist">{f.viewHint}</p>
      </div>
      {sport === "american-football" && side !== "special" && (
        <fieldset disabled={locked} className="disabled:opacity-50">
          <Choice
            label={f.front}
            value={settings.front ?? "4-3"}
            onChange={onFront}
            options={DEFENSE_FRONTS.map((front) => ({ value: front, label: FRONTS[front].name[locale] }))}
          />
          <p className="mt-2 text-[0.8rem] text-mist">{side === "defense" ? f.frontHintDefense : f.frontHintOffense}</p>
        </fieldset>
      )}
      <Choice label={f.theme} value={settings.theme} onChange={(theme) => onChange({ theme })} options={[{ value: "dark", label: f.dark }, { value: "light", label: f.light }]} />
      <Choice
        label={f.snap}
        value={settings.snap ? "on" : "off"}
        onChange={(v) => onChange({ snap: v === "on" })}
        options={[
          { value: "off", label: f.snapOff },
          { value: "on", label: f.snapOn },
        ]}
      />
      <Choice
        label={f.opponent}
        value={settings.showOpponent ? "show" : "hide"}
        onChange={(v) => onChange({ showOpponent: v === "show" })}
        options={[
          { value: "hide", label: f.hide },
          { value: "show", label: f.show },
        ]}
      />
      <Choice
        label={f.backfield}
        value={settings.backfield}
        onChange={(backfield: Backfield) => onChange({ backfield })}
        options={(["less", "standard", "more"] as Backfield[]).map((b) => ({ value: b, label: f.backfieldOptions[b] }))}
      />
      {/* A special-teams board is compressed beyond 6 yards, so a true-scale end zone would mislead. */}
      {side !== "special" && (
        <Choice
          label={side === "defense" ? f.ballOnDefense : f.ballOn}
          value={settings.ballOn}
          onChange={(ballOn) => onChange({ ballOn })}
          options={BALL_ON_OPTIONS.map((n) => ({
            value: n,
            label: n === null ? f.openField : sport === "flag-football" && n === 5 ? fill(f.noRun, { n }) : fill(f.yardsToGoal, { n }),
          }))}
        />
      )}
    </div>
  );
}
