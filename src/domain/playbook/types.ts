import type { SportId } from "@/domain/sports/types";

/**
 * Playbook coordinates are yards. x runs across the field from the left sideline
 * (0 … fieldWidth). y is measured from the line of scrimmage: positive toward the
 * opponent, negative into our own backfield. The team that owns the play always stands
 * below the line and faces up, whether the play is offensive or defensive.
 */
import type { DefenseFront } from "./fronts";
import type { SpecialUnit } from "./special";

export interface Vec {
  x: number;
  y: number;
}

/** Special teams exist in American football only. */
export type PlaySide = "offense" | "defense" | "special";
/** "zigzag" marks pre-snap motion: only the first segment is drawn as a zigzag. */
export type LineStyle = "solid" | "dashed" | "zigzag";
/** The end-style button cycles arrow → block (T) → dot → arrow. */
export type EndStyle = "arrow" | "block" | "dot";
export type CornerStyle = "sharp" | "rounded";
export type Shape = "circle" | "square" | "triangle";
export type PlayerColor = "volt" | "ice" | "amber" | "signal" | "violet" | "teal" | "chalk" | "slate";
export type FieldLines = "five" | "fiveNumbered" | "none";
export type Backfield = "less" | "standard" | "more";

export interface Route {
  /** Points after the player's own spot, in order. */
  points: Vec[];
  line: LineStyle;
  end: EndStyle;
  corners: CornerStyle;
}

export interface Zone {
  /** Radius in yards. The zone sits where the route ends, or on the player without one. */
  radius: number;
}

export interface PlayerSpot {
  id: string;
  label: string;
  color: PlayerColor;
  shape: Shape;
  x: number;
  y: number;
  /** A starred player is drawn as a star (the primary read, a key defender…). */
  starred: boolean;
  route: Route | null;
  zone: Zone | null;
}

export interface FieldSettings {
  theme: "dark" | "light";
  snap: boolean;
  showOpponent: boolean;
  backfield: Backfield;
  /** Yards from the line of scrimmage to the goal line; null for the open field. */
  ballOn: number | null;
  /** American football: the defensive front (own players on defense, the ghosts on offense). */
  front?: DefenseFront;
  /** "fill" (default): the field fills the screen's width; "deep": more depth, turf beside the sidelines. */
  view?: "fill" | "deep";
}

export interface Play {
  id: string;
  side: PlaySide;
  /** Special teams: the unit this play is for (kickoff, punt return…). */
  unit?: SpecialUnit;
  name: string;
  categoryIds: string[];
  notes: string;
  /** Keyed by player id. */
  positionNotes: Record<string, string>;
  players: PlayerSpot[];
  /** The other side's players, shown as grey ghosts when the field option is on. */
  opponent: PlayerSpot[];
  settings: FieldSettings;
  locked: boolean;
  /**
   * Special teams: the depth is already fitted to the board (new plays are made fitted). Plays saved
   * before the board compressed special-teams depth lack it and are fitted once, when opened.
   */
  depthFitted?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Playbook {
  id: string;
  workspaceId: string;
  name: string;
  sport: SportId;
  playersPerSide: number;
  /** Field width in yards: 25 (IFAF) or 30 (NFL FLAG) for flag, 53⅓ for American football. */
  fieldWidth: number;
  fieldLines: FieldLines;
  /** Categories per side; playbooks saved before special teams have no `special` list. */
  categories: Record<"offense" | "defense", Category[]> & { special?: Category[] };
  plays: Play[];
  createdAt: string;
  updatedAt: string;
}
