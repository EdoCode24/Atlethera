import type { L10n } from "@/domain/sports/types";
import type { PlayerColor } from "./types";

/** American football defensive fronts the coach can line the defense up in. */
export type DefenseFront = "4-3" | "3-4" | "4-2-5" | "3-3-5" | "5-2";
export const DEFENSE_FRONTS: DefenseFront[] = ["4-3", "3-4", "4-2-5", "3-3-5", "5-2"];

export interface FrontPlayer {
  label: string;
  group: "DL" | "LB" | "DB";
  /** Yards from the ball, positive toward the offense's tight end (the strong side). */
  lateral: number;
  /** Yards off the line of scrimmage. */
  depth: number;
  color: PlayerColor;
}

/**
 * Standard alignments against a 2x2 offense with the tight end to its right (shotgun, backs at
 * 4.5 yards), researched from coaching sources and checked by a second reader. Techniques,
 * naming variants and sources are in docs/playbook-spec.md §6.
 */
export const FRONTS: Record<DefenseFront, { name: L10n; players: FrontPlayer[] }> = {
  "4-3": {
    name: { tr: "4-3", en: "4-3" },
    players: [
      { label: "DE", group: "DL", lateral: 4.3, depth: 1, color: "slate" },
      { label: "DT", group: "DL", lateral: 2.4, depth: 1, color: "slate" },
      { label: "NT", group: "DL", lateral: -0.6, depth: 1, color: "slate" },
      { label: "DE", group: "DL", lateral: -4.3, depth: 1, color: "slate" },
      { label: "S", group: "LB", lateral: 6.4, depth: 4, color: "violet" },
      { label: "M", group: "LB", lateral: 0.9, depth: 5, color: "chalk" },
      { label: "W", group: "LB", lateral: -2.4, depth: 4.5, color: "ice" },
      { label: "CB", group: "DB", lateral: 21, depth: 6, color: "teal" },
      { label: "CB", group: "DB", lateral: -21, depth: 6, color: "amber" },
      { label: "SS", group: "DB", lateral: 8, depth: 10, color: "volt" },
      { label: "FS", group: "DB", lateral: -8, depth: 12, color: "signal" },
    ],
  },
  "3-4": {
    name: { tr: "3-4", en: "3-4" },
    players: [
      { label: "DE", group: "DL", lateral: 4.3, depth: 1, color: "slate" },
      { label: "NT", group: "DL", lateral: 0, depth: 1, color: "slate" },
      { label: "DE", group: "DL", lateral: -4.3, depth: 1, color: "slate" },
      { label: "S", group: "LB", lateral: 6.6, depth: 1, color: "violet" },
      { label: "J", group: "LB", lateral: -5.6, depth: 1, color: "slate" },
      { label: "M", group: "LB", lateral: 1.8, depth: 4.5, color: "chalk" },
      { label: "W", group: "LB", lateral: -1.8, depth: 4.5, color: "ice" },
      { label: "CB", group: "DB", lateral: 21.1, depth: 7, color: "teal" },
      { label: "CB", group: "DB", lateral: -21.2, depth: 7, color: "amber" },
      { label: "SS", group: "DB", lateral: 8, depth: 10, color: "volt" },
      { label: "FS", group: "DB", lateral: -8, depth: 12, color: "signal" },
    ],
  },
  "4-2-5": {
    name: { tr: "4-2-5 (Nikel)", en: "4-2-5 (Nickel)" },
    players: [
      { label: "DE", group: "DL", lateral: 5.1, depth: 1, color: "slate" },
      { label: "DT", group: "DL", lateral: 2.4, depth: 1, color: "slate" },
      { label: "NT", group: "DL", lateral: -0.6, depth: 1, color: "slate" },
      { label: "DE", group: "DL", lateral: -4.3, depth: 1, color: "slate" },
      { label: "M", group: "LB", lateral: 1.8, depth: 5, color: "chalk" },
      { label: "W", group: "LB", lateral: -2.4, depth: 5, color: "ice" },
      { label: "NB", group: "DB", lateral: -8.7, depth: 5, color: "violet" },
      { label: "CB", group: "DB", lateral: 21.1, depth: 7, color: "teal" },
      { label: "CB", group: "DB", lateral: -21.2, depth: 7, color: "amber" },
      { label: "SS", group: "DB", lateral: 8, depth: 10, color: "volt" },
      { label: "FS", group: "DB", lateral: -8.5, depth: 12, color: "signal" },
    ],
  },
  "3-3-5": {
    name: { tr: "3-3-5 (Stack)", en: "3-3-5 (Stack)" },
    players: [
      { label: "DE", group: "DL", lateral: 3.6, depth: 1, color: "slate" },
      { label: "NT", group: "DL", lateral: 0, depth: 1, color: "slate" },
      { label: "DE", group: "DL", lateral: -3.6, depth: 1, color: "slate" },
      { label: "S", group: "LB", lateral: 3.6, depth: 4.5, color: "violet" },
      { label: "M", group: "LB", lateral: 0, depth: 5, color: "chalk" },
      { label: "W", group: "LB", lateral: -3.6, depth: 4.5, color: "ice" },
      { label: "SP", group: "DB", lateral: 9.6, depth: 4, color: "volt" },
      { label: "B", group: "DB", lateral: -7.6, depth: 4, color: "volt" },
      { label: "FS", group: "DB", lateral: 0, depth: 12, color: "signal" },
      { label: "CB", group: "DB", lateral: 21.1, depth: 8, color: "teal" },
      { label: "CB", group: "DB", lateral: -21.2, depth: 8, color: "amber" },
    ],
  },
  "5-2": {
    name: { tr: "5-2 (Okie)", en: "5-2 (Okie)" },
    players: [
      { label: "DE", group: "DL", lateral: 6.6, depth: 1, color: "slate" },
      { label: "DT", group: "DL", lateral: 3.6, depth: 1, color: "slate" },
      { label: "NG", group: "DL", lateral: 0, depth: 1, color: "slate" },
      { label: "DT", group: "DL", lateral: -3.6, depth: 1, color: "slate" },
      { label: "DE", group: "DL", lateral: -5.4, depth: 1, color: "slate" },
      { label: "M", group: "LB", lateral: 1.8, depth: 4, color: "chalk" },
      { label: "W", group: "LB", lateral: -1.8, depth: 4, color: "ice" },
      { label: "CB", group: "DB", lateral: 21, depth: 7, color: "teal" },
      { label: "CB", group: "DB", lateral: -21, depth: 7, color: "amber" },
      { label: "SS", group: "DB", lateral: 8.5, depth: 10, color: "volt" },
      { label: "FS", group: "DB", lateral: -9, depth: 12, color: "signal" },
    ],
  },
};
