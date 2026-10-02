import type { Locale } from "@/i18n/config";

export type L10n = Record<Locale, string>;

export type SportId = "american-football" | "flag-football";

export type Side = "offense" | "defense" | "special";

export interface StatDef {
  key: string;
  abbr: string;
  label: L10n;
}

export interface StatGroup {
  id: string;
  label: L10n;
  stats: StatDef[];
}

/** A position group as coaches talk about it (OL, not LT/LG/C/RG/RT). */
export interface PositionGroup {
  id: string;
  abbr: string;
  name: L10n;
  side: Side;
  /** Granular positions inside the group. */
  positions: string[];
  /** Ids into SportModule.statGroups that make up this group's stat sheet. */
  statGroups: string[];
}

export interface FieldSpec {
  /** Total length including both end zones, in yards. */
  lengthYd: number;
  widthYd: number;
  endZoneYd: number;
  /** Distance of inbound hash marks from each sideline (American football). */
  hashFromSidelineYd?: number;
  /** Line to gain at midfield (flag football). */
  midfieldYd?: number;
  /** No-run zones as [start, end] yard ranges from the left end line. */
  noRunZones?: ReadonlyArray<readonly [number, number]>;
  /** Rushers must start at least this far from the line of scrimmage. */
  rushLineYd?: number;
  /** Distance from the goal line for 1- and 2-point conversions. */
  conversionsYd?: { one: number; two: number };
}

export type LabelAnchor = "top" | "bottom" | "left" | "right";

export interface FormationPlayer {
  id: string;
  /** PositionGroup id. */
  group: string;
  label: string;
  side: "offense" | "defense";
  /** Yards from the left end line. */
  x: number;
  /** Yards from the top sideline. */
  y: number;
  labelAt?: LabelAnchor;
  /** Hidden in dense views; the group label speaks for it. */
  minorLabel?: boolean;
}

export interface Formation {
  name: L10n;
  losX: number;
  players: FormationPlayer[];
}

export interface SportModule {
  id: SportId;
  name: L10n;
  playersPerSide: number;
  field: FieldSpec;
  positionGroups: PositionGroup[];
  statGroups: StatGroup[];
  combine: string[];
  /** Tests shown as dashboard KPIs, in order. */
  kpis: string[];
  rules: L10n[];
  formation: Formation;
}
