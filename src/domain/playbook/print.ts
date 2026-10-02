/**
 * Printing: formats, their styles and settings, and the page maths. Everything here is in inches
 * and free of React, so the preview and the printed pages come from the same numbers.
 * docs/playbook-print-spec.md describes the formats.
 */
import { zoneCenter } from "./geometry";
import type { Category, Play, Playbook, PlayerSpot, PlaySide, Vec } from "./types";

export type PrintFormat = "wristband" | "wristbandList" | "callSheet" | "callSheetList" | "playbook" | "scout" | "routeTree";
export const PRINT_FORMATS: PrintFormat[] = ["wristband", "wristbandList", "callSheet", "callSheetList", "playbook", "scout", "routeTree"];

export type PaperSize = "a4" | "letter";
export type IconSize = "small" | "medium" | "large";
export type LineWeight = "thin" | "medium" | "thick";
export type LabelStyle = "prominent" | "compact";
/** What a diagram's label shows. */
export type PlayLabels = "both" | "name" | "number";
/** What a list row shows. */
export type ListLabels = "nameNumber" | "name";
export type ColorCoding = "auto" | "off";

/** One flat record per format; each format shows only its own keys (FORMAT_SETTINGS). */
export interface PrintSettings {
  style: string;
  /** Wristband card, inches. */
  width: number;
  height: number;
  /** Percent. */
  zoom: number;
  iconSize: IconSize;
  lineWeight: LineWeight;
  labelStyle: LabelStyle;
  labels: PlayLabels;
  listLabels: ListLabels;
  colorCoding: ColorCoding;
  copies: number;
  paper: PaperSize;
}

export type SettingKey = Exclude<keyof PrintSettings, "style">;

export const SETTING_OPTIONS: { readonly [K in SettingKey]: readonly PrintSettings[K][] } = {
  width: [3, 3.25, 3.5, 3.75, 4, 4.25, 4.5, 4.75, 5],
  height: [2, 2.25, 2.5, 2.75, 3, 3.5],
  zoom: [50, 75, 100, 125, 150],
  iconSize: ["small", "medium", "large"],
  lineWeight: ["thin", "medium", "thick"],
  labelStyle: ["prominent", "compact"],
  labels: ["both", "name", "number"],
  listLabels: ["nameNumber", "name"],
  colorCoding: ["auto", "off"],
  copies: Array.from({ length: 12 }, (_, i) => i + 1),
  paper: ["a4", "letter"],
};

export const FORMAT_SETTINGS: Record<PrintFormat, SettingKey[]> = {
  wristband: ["width", "height", "zoom", "iconSize", "lineWeight", "labelStyle", "labels", "colorCoding", "copies", "paper"],
  wristbandList: ["width", "height", "listLabels", "colorCoding", "copies", "paper"],
  callSheet: ["zoom", "iconSize", "lineWeight", "labelStyle", "labels", "colorCoding", "paper"],
  callSheetList: ["listLabels", "colorCoding", "paper"],
  playbook: ["labels", "paper"],
  scout: ["labels", "paper"],
  routeTree: ["paper"],
};

export interface PrintStyle {
  id: string;
  /** Plays across a card or page; for the list formats, the number of list columns. */
  cols: number;
  /** Plays down a card or page; 0 for the list formats, whose rows fill the space. */
  rows: number;
  /** Wristband "4 plays": the labels sit in a strip between the two columns. */
  strip?: boolean;
  /** Playbook pages: where the play and position notes print. */
  notes?: "below" | "side";
}

const grid = (id: string, cols: number, rows: number, extra: Partial<PrintStyle> = {}): PrintStyle => ({ id, cols, rows, ...extra });
const listStyles = (n: number) => Array.from({ length: n }, (_, i) => grid(`${i + 1}-col`, i + 1, 0));
const callSheetGrid = (id: string) => {
  const [cols, rows] = id.split("x").map(Number);
  return grid(id, cols, rows);
};

/** Styles in the order the picker lists them; the first is not always the default (DEFAULT_STYLE). */
export const FORMAT_STYLES: Record<PrintFormat, PrintStyle[]> = {
  wristband: [
    grid("8", 4, 2),
    grid("6", 3, 2),
    grid("4", 2, 2, { strip: true }),
    grid("4-columns", 4, 1),
    grid("3", 3, 1),
    grid("2", 2, 1),
    grid("1", 1, 1),
    grid("15", 5, 3),
    grid("12", 4, 3),
    grid("10", 5, 2),
    grid("9", 3, 3),
  ],
  wristbandList: listStyles(3),
  callSheet: ["4x6", "6x4", "3x6", "6x3", "4x4", "3x5", "5x3", "3x4", "4x3", "2x5", "5x2", "3x3", "2x4", "4x2"].map(callSheetGrid),
  callSheetList: listStyles(4),
  playbook: [
    grid("1", 1, 1),
    grid("1-notes-below", 1, 1, { notes: "below" }),
    grid("1-notes-side", 1, 1, { notes: "side" }),
    grid("2-top-bottom", 1, 2),
    grid("2-left-right", 2, 1),
    grid("4", 2, 2),
    grid("6", 3, 2),
    grid("9", 3, 3),
  ],
  scout: [grid("1", 1, 1), grid("2-top-bottom", 1, 2), grid("2-left-right", 2, 1)],
  routeTree: [grid("tree", 1, 1)],
};

const DEFAULT_STYLE: Record<PrintFormat, string> = {
  wristband: "8",
  wristbandList: "1-col",
  callSheet: "4x6",
  callSheetList: "1-col",
  playbook: "1",
  scout: "1",
  routeTree: "tree",
};

export const findStyle = (format: PrintFormat, id: string): PrintStyle => FORMAT_STYLES[format].find((s) => s.id === id) ?? FORMAT_STYLES[format][0];

/** Plays on one card or page for the grid formats. */
export const playsPerPage = (style: PrintStyle): number => style.cols * Math.max(1, style.rows);

/** Turkish coaches print on A4, American ones on Letter. */
export const defaultPaper = (locale: string): PaperSize => (locale === "en" ? "letter" : "a4");

export function defaultSettings(format: PrintFormat, paper: PaperSize): PrintSettings {
  return {
    style: DEFAULT_STYLE[format],
    width: 3,
    height: 2,
    zoom: 100,
    // A call sheet packs 24 plays on a page, so its players start small.
    iconSize: format === "callSheet" ? "small" : "medium",
    lineWeight: "medium",
    labelStyle: "prominent",
    labels: "both",
    listLabels: "nameNumber",
    colorCoding: "auto",
    copies: 1,
    paper,
  };
}

/** Stored settings, checked value by value: anything unknown or out of range falls back to the default. */
export function sanitizeSettings(format: PrintFormat, stored: unknown, paper: PaperSize): PrintSettings {
  const out = defaultSettings(format, paper);
  if (!stored || typeof stored !== "object") return out;
  const s = stored as Record<string, unknown>;
  if (typeof s.style === "string" && FORMAT_STYLES[format].some((x) => x.id === s.style)) out.style = s.style;
  for (const key of Object.keys(SETTING_OPTIONS) as SettingKey[]) {
    if ((SETTING_OPTIONS[key] as readonly unknown[]).includes(s[key])) (out as unknown as Record<SettingKey, unknown>)[key] = s[key];
  }
  return out;
}

// ── Play selection ──────────────────────────────────────────────────────────

/** "all" plays of the side, the "none" without a category, or one category id. */
export type PrintFilter = string;

export interface NumberedPlay {
  play: Play;
  /** The play's place within its side, as the playbook screen numbers it. */
  number: number;
}

export function sidePlays(book: Playbook, side: PlaySide): NumberedPlay[] {
  return book.plays.filter((p) => p.side === side).map((play, i) => ({ play, number: i + 1 }));
}

const matches = (play: Play, filter: PrintFilter) => (filter === "all" ? true : filter === "none" ? play.categoryIds.length === 0 : play.categoryIds.includes(filter));

/** The plays to print, in play-number order. */
export function selectPlays(book: Playbook, side: PlaySide, filter: PrintFilter): NumberedPlay[] {
  return sidePlays(book, side).filter((e) => matches(e.play, filter));
}

export function filterCount(book: Playbook, side: PlaySide, filter: PrintFilter): number {
  return book.plays.filter((p) => p.side === side && matches(p, filter)).length;
}

// ── Colour coding ───────────────────────────────────────────────────────────

export interface LabelColor {
  bg: string;
  fg: string;
}

/** Label ink when colour coding is off, and for plays without a category. */
export const INK: LabelColor = { bg: "#1b1f1c", fg: "#ffffff" };

/** One colour per category, in the side's category order; strong enough to hold white text (yellow takes dark). */
export const CATEGORY_COLORS: LabelColor[] = [
  { bg: "#c92a2a", fg: "#ffffff" },
  { bg: "#d9480f", fg: "#ffffff" },
  { bg: "#f2c200", fg: "#1b1f1c" },
  { bg: "#2b8a3e", fg: "#ffffff" },
  { bg: "#1864ab", fg: "#ffffff" },
  { bg: "#6741d9", fg: "#ffffff" },
  { bg: "#0b7285", fg: "#ffffff" },
  { bg: "#a61e4d", fg: "#ffffff" },
];

/**
 * The category a play is filed under on paper: the one being printed, or else its first category
 * in the side's order; null when it has none.
 */
export function primaryCategory(play: Play, categories: Category[], filter: PrintFilter): string | null {
  if (filter !== "all" && filter !== "none" && play.categoryIds.includes(filter)) return filter;
  return categories.find((c) => play.categoryIds.includes(c.id))?.id ?? null;
}

export function categoryColor(categoryId: string | null, categories: Category[], coding: ColorCoding): LabelColor {
  if (coding === "off" || categoryId === null) return INK;
  const i = categories.findIndex((c) => c.id === categoryId);
  return i < 0 ? INK : CATEGORY_COLORS[i % CATEGORY_COLORS.length];
}

export interface ListGroup<T> {
  /** Category id; null for plays without a category. */
  id: string | null;
  items: T[];
}

/**
 * Plays grouped by category for the call sheet list, in the side's category order: a play filed
 * under two categories shows in both (with its one number), so each group matches the sidebar
 * count. Plays without a category come last.
 */
export function groupPlays(plays: NumberedPlay[], categories: Category[], filter: PrintFilter): ListGroup<NumberedPlay>[] {
  if (filter === "none") return plays.length ? [{ id: null, items: plays }] : [];
  if (filter !== "all") return plays.length ? [{ id: filter, items: plays }] : [];
  const groups: ListGroup<NumberedPlay>[] = categories.map((c) => ({ id: c.id, items: plays.filter((e) => e.play.categoryIds.includes(c.id)) }));
  const known = new Set(categories.map((c) => c.id));
  groups.push({ id: null, items: plays.filter((e) => !e.play.categoryIds.some((id) => known.has(id))) });
  return groups.filter((g) => g.items.length > 0);
}

// ── Paper and pagination ────────────────────────────────────────────────────

export interface Size {
  w: number;
  h: number;
}

export const PAPER: Record<PaperSize, Size> = {
  a4: { w: 210 / 25.4, h: 297 / 25.4 },
  letter: { w: 8.5, h: 11 },
};

/** Blank edge on every sheet, inside the printer's reach. */
export const SHEET_MARGIN = 0.4;
/** A line of small print at the bottom of wristband sheets. */
export const FOOTER_H = 0.16;
/** Header on call sheets, playbook pages and the route tree, and the gap under it. */
export const HEADER_H = 0.5;
export const HEADER_GAP = 0.12;
/** Inset of a wristband card's content from its cut line. */
export const CARD_PAD = 0.04;
/** Row height of a wristband list and of a call sheet list. */
export const WRISTBAND_ROW = 0.2;
export const SHEET_ROW = 0.25;

export const innerSize = (paper: PaperSize): Size => ({ w: PAPER[paper].w - 2 * SHEET_MARGIN, h: PAPER[paper].h - 2 * SHEET_MARGIN });

/** The area under a page header. */
export const bodySize = (paper: PaperSize): Size => {
  const inner = innerSize(paper);
  return { w: inner.w, h: inner.h - HEADER_H - HEADER_GAP };
};

export function chunk<T>(items: T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/** How many cards of this size tile one sheet (never rotated, at least one). */
export function cardGrid(paper: PaperSize, card: Size): { cols: number; rows: number } {
  const inner = innerSize(paper);
  const eps = 1e-6;
  return {
    cols: Math.max(1, Math.floor((inner.w + eps) / card.w)),
    rows: Math.max(1, Math.floor((inner.h - FOOTER_H + eps) / card.h)),
  };
}

/** Rows in one column of a wristband list card. */
export const wristbandListRows = (cardH: number): number => Math.max(1, Math.floor((cardH - 2 * CARD_PAD + 1e-6) / WRISTBAND_ROW));

/** Rows in one column of a call sheet list page (headers take a row each). */
export const sheetListRows = (paper: PaperSize): number => Math.max(2, Math.floor((bodySize(paper).h + 1e-6) / SHEET_ROW));

export interface CardPlan<T> {
  card: Size;
  /** Cards across and down a sheet. */
  grid: { cols: number; rows: number };
  /** Sheets → cards → plays. */
  sheets: T[][][];
  /** Distinct cards before copies. */
  cards: number;
}

/** Wristband cards: plays split into cards, each set repeated `copies` times (collated), tiled on sheets. */
export function planCards<T>(items: T[], perCard: number, copies: number, card: Size, paper: PaperSize): CardPlan<T> {
  const cards = chunk(items, perCard);
  const all = Array.from({ length: Math.max(1, copies) }, () => cards).flat();
  const g = cardGrid(paper, card);
  return { card, grid: g, sheets: chunk(all, g.cols * g.rows), cards: cards.length };
}

export type ListRow<T> = { kind: "header"; group: string | null; continued: boolean } | { kind: "item"; group: string | null; item: T };

/**
 * Flows grouped rows down columns and across pages. A group never starts on the last row of a
 * column, and a group that runs on into a new column repeats its header there.
 * Returns pages → columns → rows.
 */
export function flowList<T>(groups: ListGroup<T>[], columns: number, rowsPerColumn: number): ListRow<T>[][][] {
  const rows = Math.max(2, rowsPerColumn);
  const pages: ListRow<T>[][][] = [];
  let page: ListRow<T>[][] = [];
  let col: ListRow<T>[] = [];
  const nextColumn = () => {
    page.push(col);
    col = [];
    if (page.length === columns) {
      pages.push(page);
      page = [];
    }
  };
  for (const g of groups) {
    if (g.items.length === 0) continue;
    if (col.length > 0 && rows - col.length < 2) nextColumn();
    col.push({ kind: "header", group: g.id, continued: false });
    for (const item of g.items) {
      if (col.length === rows) {
        nextColumn();
        col.push({ kind: "header", group: g.id, continued: true });
      }
      col.push({ kind: "item", group: g.id, item });
    }
  }
  if (col.length) page.push(col);
  if (page.length) pages.push(page);
  return pages;
}

/** Page count for any format, for the summary line. */
export function pageCount(format: PrintFormat, settings: PrintSettings, plays: NumberedPlay[], groups: ListGroup<NumberedPlay>[]): number {
  const style = findStyle(format, settings.style);
  const card = { w: settings.width, h: settings.height };
  switch (format) {
    case "wristband":
      return planCards(plays, playsPerPage(style), settings.copies, card, settings.paper).sheets.length;
    case "wristbandList":
      return planCards(plays, style.cols * wristbandListRows(card.h), settings.copies, card, settings.paper).sheets.length;
    case "callSheetList":
      return flowList(groups, style.cols, sheetListRows(settings.paper)).length;
    case "routeTree":
      return 1;
    default:
      return chunk(plays, playsPerPage(style)).length;
  }
}

// ── Diagram cells ───────────────────────────────────────────────────────────

/** Width and height of each cell when a box is split into cols × rows with gaps between them. */
export function gridCell(box: Size, cols: number, rows: number, gap: number): Size {
  return { w: (box.w - gap * (cols - 1)) / cols, h: (box.h - gap * (rows - 1)) / rows };
}

/**
 * Height of a one-line label bar: a share of the cell's height, but never more than a fifth of its
 * width (a tall, narrow cell would otherwise get a big font with room for two letters), within
 * readable limits.
 */
export function labelBarHeight(cellW: number, cellH: number, style: LabelStyle): number {
  const prominent = Math.min(0.3, Math.max(0.12, Math.min(cellH * 0.16, cellW * 0.2)));
  return style === "prominent" ? prominent : Math.max(0.1, prominent * 0.72);
}

/** A label's name font as a share of the one-line bar. */
export const LABEL_FONT: Record<LabelStyle, number> = { prominent: 0.6, compact: 0.64 };
/** Average width of a character of a bold play name, in ems (an estimate for fitting, not a measure). */
export const NAME_EM = 0.56;
/** A two-line bar only where the diagram under it stays at most this wide for its height. */
export const TWO_LINE_MAX_ASPECT = 1.6;

/** Characters in the longest play name of a print job. */
export const longestName = (plays: NumberedPlay[]): number => plays.reduce((m, e) => Math.max(m, e.play.name.trim().length), 0);

export interface LabelLayout {
  /** Bar height, inches. */
  h: number;
  lines: 1 | 2;
  /** Name font size, inches. */
  font: number;
}

/**
 * The label bar for every cell of a print job, so bars line up across a card or sheet. The name
 * gets a second line when the longest name would not fit on one and the cell is tall enough that
 * the diagram loses only turf, not scale (a wide, shallow play is sized by the cell's width).
 */
export function labelLayout(cell: Size, style: LabelStyle, labels: PlayLabels, longest: number): LabelLayout {
  const one = labelBarHeight(cell.w, cell.h, style);
  const font = one * LABEL_FONT[style];
  if (labels === "number") return { h: one, lines: 1, font };
  // Room the number, divider and padding take (prominent), or the number cell (compact).
  const reserved = labels === "both" ? one * (style === "prominent" ? 1.45 : 1.5) : one * 0.56;
  const perLine = Math.max(1, Math.floor((cell.w - reserved) / (NAME_EM * font)));
  const two = one * 1.7;
  const roomy = cell.w / Math.max(1e-6, cell.h - two) <= TWO_LINE_MAX_ASPECT;
  return longest > perLine && roomy ? { h: two, lines: 2, font } : { h: one, lines: 1, font };
}

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Share of any extra height that goes up-field when a frame grows to a taller box. */
export const UPFIELD_SHARE = 0.65;
/**
 * The tallest shape (width / height) a diagram takes, unless the play itself is taller (a kickoff).
 * Wristband and call sheet cells are small, so they keep turf up to nearly square; a playbook page
 * stops much sooner and leaves the rest of the page blank instead of 50 yards of empty field.
 */
export const MIN_DIAGRAM_ASPECT = 0.75;
export const PLAYBOOK_MIN_ASPECT = 1.3;

/** What a zoomed-in frame must keep in view (SVG units, y down): an x-range, and up to `top`. */
export interface Keep {
  x0: number;
  x1: number;
  top: number;
}

/**
 * Grows a field frame (SVG units, y down) to a box's aspect ratio without cropping it: extra width
 * splits evenly, extra height goes mostly up-field. Then the zoom (percent) scales it around its
 * centre. Zooming in never lifts the bottom edge above the original frame's, so the backfield
 * stays whole and the far end of the routes gives way first; with `keep`, it also stops before
 * any player or the side of any route leaves the frame.
 */
export function fitFrame(f: Frame, aspect: number, zoom = 100, keep?: Keep): Frame {
  let w = f.w;
  let h = f.h;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  const full = w;
  w *= 100 / zoom;
  const bottom = f.y + f.h;
  const clamp = keep && zoom > 100;
  if (clamp) w = Math.min(full, Math.max(w, keep.x1 - keep.x0, (bottom - keep.top) * aspect));
  h = w / aspect;
  let x = f.x + f.w / 2 - w / 2;
  if (clamp) x = Math.min(Math.max(x, keep.x1 - w), keep.x0);
  let y = bottom + (h - f.h) * (1 - UPFIELD_SHARE) - h;
  if (y + h < bottom) y = bottom - h;
  return { x, y, w, h };
}

/** Turf kept beside the outermost player when a diagram closes in on a compact formation, in yards. */
export const CONTENT_PAD = 3;

/** Every point a diagram draws for these players: their spots, route corners and zone edges. */
export function diagramSpots(players: PlayerSpot[]): Vec[] {
  return players.flatMap((p) => {
    const zone = p.zone ? zoneCenter(p) : null;
    const edges = zone && p.zone ? [{ x: zone.x - p.zone.radius, y: zone.y }, { x: zone.x + p.zone.radius, y: zone.y }] : [];
    return [{ x: p.x, y: p.y }, ...(p.route?.points ?? []), ...edges];
  });
}

/** Room past the deepest route corner for its arrowhead, in yards. */
export const ROUTE_HEADROOM = 1.5;

/**
 * The field frame for a printed diagram (SVG units, y down): the play's depth (`depth`, from
 * staticView), reaching further up-field when a route runs past it, across the whole width plus
 * a sliver past each sideline, as the playbook thumbnails show it. A compact formation that uses
 * less than 80 % of that width (a punt or field-goal unit, a goal-line set) gets just its part of
 * the field, at least 40 % of it, so small units print larger. `players` with `margin` (their
 * printed token radius, yards) widen the frame so no token is cut at its edges.
 */
export function contentFrame(depth: { y: number; h: number }, fieldWidth: number, spots: Vec[], players: Vec[] = [], margin = 0): Frame {
  let bottom = depth.y + depth.h;
  let top = spots.length ? Math.min(depth.y, -(Math.max(...spots.map((p) => p.y)) + ROUTE_HEADROOM)) : depth.y;
  if (players.length) {
    top = Math.min(top, -(Math.max(...players.map((p) => p.y)) + margin));
    bottom = Math.max(bottom, -Math.min(...players.map((p) => p.y)) + margin);
  }
  const full = { x: -1.2, y: top, w: fieldWidth + 2.4, h: bottom - top };
  if (spots.length === 0) return full;
  const xs = spots.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  if (margin > 0) {
    const x0 = Math.min(full.x, minX - margin);
    full.w = Math.max(full.x + full.w, maxX + margin) - x0;
    full.x = x0;
  }
  const pad = Math.max(CONTENT_PAD, margin);
  const lo = minX - pad;
  const hi = maxX + pad;
  const w = Math.max(hi - lo, full.w * 0.4);
  if (w >= full.w * 0.8) return full;
  const x = Math.min(Math.max((lo + hi) / 2 - w / 2, full.x), full.x + full.w - w);
  return { ...full, x, w };
}

/**
 * The part of a box a diagram fills: all of it, unless the box is taller than `minAspect` (and
 * the play is not), where the diagram keeps that shape instead of showing acres of empty turf.
 */
export function diagramBox(box: Size, content: Frame, minAspect = MIN_DIAGRAM_ASPECT): Size {
  const min = Math.min(minAspect, content.w / content.h);
  return box.w / box.h >= min ? box : { w: box.w, h: box.w / min };
}

export const ICON_SCALE: Record<IconSize, number> = { small: 0.8, medium: 1, large: 1.25 };
export const STROKE_SCALE: Record<LineWeight, number> = { thin: 0.65, medium: 1, thick: 1.5 };

/**
 * Smallest printed token, inches across, at Medium (Small and Large scale it by ICON_SCALE). Players
 * drawn to scale in a 0.7 in wristband cell would be half a millimetre wide; below this size they
 * grow, and linemen may overlap like a chain, which still reads as the line.
 */
export const MIN_TOKEN_IN = 0.065;
/** Position letters smaller than this (inches, 3 pt) are left off: a clean dot reads better than a speck of text. */
export const MIN_LABEL_IN = 3 / 72;

/** The shortest distance between two players, in yards (Infinity for fewer than two). */
export function tightestSpacing(players: PlayerSpot[]): number {
  let min = Infinity;
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) min = Math.min(min, Math.hypot(players[i].x - players[j].x, players[i].y - players[j].y));
  return min;
}

/**
 * Size factor for players and routes on paper. Special-teams diagrams span the whole field, so
 * their players grow toward half the tightest spacing (a kickoff line stands 4+ yards apart) or
 * shrink to it (a punt line stands a yard apart), within limits.
 */
export function tokenScale(icon: IconSize, special: boolean, spacing: number, radius: number): number {
  const base = ICON_SCALE[icon];
  if (!special || !Number.isFinite(spacing)) return base;
  return base * Math.min(2.4, Math.max(0.6, (0.5 * spacing) / radius));
}

export interface DiagramInput {
  /** The play's depth, from staticView. */
  depth: { y: number; h: number };
  fieldWidth: number;
  /** Everything drawn (diagramSpots of the players and any opponent shown). */
  spots: Vec[];
  /** Every token drawn, which zoom and framing never cut. */
  players: Vec[];
  /** Room for the diagram, inches. */
  box: Size;
  minAspect?: number;
  zoom?: number;
  /** Token radius at scale 1, yards (playerRadius). */
  radius: number;
  icon: IconSize;
  special: boolean;
  /** tightestSpacing of the tokens (special teams only). */
  spacing: number;
}

export interface DiagramLayout {
  /** The diagram's size inside the box, inches. */
  drawn: Size;
  /** Field frame for PlayField (SVG units). */
  view: Frame;
  /** PlayField sizeScale for tokens, routes and markers. */
  k: number;
  /** Position letters smaller than this (SVG units) are left off. */
  minLabel: number;
}

/**
 * How a play sits in a box on paper. The frame comes from contentFrame, shaped by diagramBox and
 * fitted and zoomed by fitFrame, which keeps every token and the sides of every route in view.
 * Tokens keep their size in yards (and the special-teams spacing rule) unless that prints them
 * smaller than MIN_TOKEN_IN; zoom asked beyond what the frame can give goes into the tokens and
 * lines, so 150 % always draws bigger without dropping a receiver.
 */
export function diagramLayout(d: DiagramInput): DiagramLayout {
  const zoom = d.zoom ?? 100;
  const base = tokenScale(d.icon, d.special, d.spacing, d.radius);
  const grow = Math.max(1, zoom / 100);
  const layout = (margin: number): DiagramLayout => {
    const content = contentFrame(d.depth, d.fieldWidth, d.spots, d.players, margin);
    const drawn = diagramBox(d.box, content, d.minAspect ?? MIN_DIAGRAM_ASPECT);
    const aspect = drawn.w / drawn.h;
    const xs = d.spots.map((p) => p.x);
    const keep: Keep | undefined = xs.length
      ? { x0: Math.min(...xs) - margin, x1: Math.max(...xs) + margin, top: d.players.length ? -(Math.max(...d.players.map((p) => p.y)) + margin) : content.y }
      : undefined;
    const unzoomed = fitFrame(content, aspect);
    const view = fitFrame(content, aspect, zoom, keep);
    const inPerYd = drawn.w / view.w;
    // The floor holds at 100 %; zooming in then scales tokens with everything else, zooming out stops at it.
    const floor = (MIN_TOKEN_IN * ICON_SCALE[d.icon]) / (2 * d.radius * (zoom > 100 ? drawn.w / unzoomed.w : inPerYd));
    // The part of the zoom the frame could not give (the frame is as tight as the players allow).
    const rest = Math.max(1, zoom / ((100 * unzoomed.w) / view.w));
    return { drawn, view, k: Math.max(base, floor) * rest, minLabel: MIN_LABEL_IN / inPerYd };
  };
  // First pass with room for tokens at their plain size; a second when they print bigger than that.
  const first = layout(d.radius * base * grow + 0.3);
  const need = d.radius * first.k * 1.15 + 0.3;
  return need > d.radius * base * grow + 0.3 ? layout(need) : first;
}
