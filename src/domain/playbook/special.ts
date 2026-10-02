import type { L10n } from "@/domain/sports/types";
import type { PlayerColor, Shape } from "./types";

/** American football special-teams units, each with the unit it faces. */
export type SpecialUnit = "kickoff" | "kickReturn" | "punt" | "puntReturn" | "fieldGoal" | "fieldGoalBlock";
export const SPECIAL_UNITS: SpecialUnit[] = ["kickoff", "kickReturn", "punt", "puntReturn", "fieldGoal", "fieldGoalBlock"];

export interface SpecialPlayer {
  label: string;
  /** Yards from the kicking team's left sideline. */
  x: number;
  /** Yards from the ball: the kicking unit stands behind it (y <= 0), the receiving unit in front (y >= 0). */
  y: number;
  color: PlayerColor;
  shape: Shape;
}

/**
 * Standard alignments (NCAA / IFAF rules: kickoff from the 35, 10-yard neutral zone), researched
 * from coaching sources and checked by a special-teams reader; docs/playbook-spec.md §7.
 * `own` is the unit the play is for, `opponent` the one facing it. Names match the default
 * special-teams categories, so a new play lands in its unit's category. Side-coded labels (L1,
 * LW, EL…) name the side from the unit's own view, in both diagrams it appears in.
 */
export const SPECIAL_TEAMS: Record<SpecialUnit, { name: L10n; kicking: boolean; ball: string; own: SpecialPlayer[]; opponent: SpecialPlayer[] }> = {
  kickoff: {
    name: { tr: "Kickoff", en: "Kickoff" },
    kicking: true,
    ball: "Kicking team's own 35 on a tee (x=26.67, y=0). The receiving team's restraining line is the kicking team's 45 (y=+10). Kicking players line up at their own 30 (y=-5), the most the rules allow.",
    own: [
      { label: "L1", x: 4, y: -5, color: "amber", shape: "circle" },
      { label: "L2", x: 8.5, y: -5, color: "amber", shape: "circle" },
      { label: "L3", x: 13, y: -5, color: "amber", shape: "circle" },
      { label: "L4", x: 17.5, y: -5, color: "amber", shape: "circle" },
      { label: "L5", x: 22, y: -5, color: "amber", shape: "circle" },
      { label: "K", x: 24.67, y: -8, color: "signal", shape: "circle" },
      { label: "R5", x: 31.33, y: -5, color: "violet", shape: "circle" },
      { label: "R4", x: 35.83, y: -5, color: "violet", shape: "circle" },
      { label: "R3", x: 40.33, y: -5, color: "violet", shape: "circle" },
      { label: "R2", x: 44.83, y: -5, color: "violet", shape: "circle" },
      { label: "R1", x: 49.33, y: -5, color: "violet", shape: "circle" },
    ],
    opponent: [
      { label: "RT", x: 10, y: 12, color: "slate", shape: "triangle" },
      { label: "RG", x: 20, y: 15, color: "slate", shape: "triangle" },
      { label: "C", x: 26.67, y: 12, color: "slate", shape: "triangle" },
      { label: "LG", x: 33.33, y: 15, color: "slate", shape: "triangle" },
      { label: "LT", x: 43.33, y: 12, color: "slate", shape: "triangle" },
      { label: "RW", x: 14, y: 30, color: "ice", shape: "triangle" },
      { label: "LW", x: 39.33, y: 30, color: "ice", shape: "triangle" },
      { label: "RU", x: 18, y: 45, color: "chalk", shape: "triangle" },
      { label: "LU", x: 35.33, y: 45, color: "chalk", shape: "triangle" },
      { label: "KR", x: 20, y: 60, color: "volt", shape: "triangle" },
      { label: "KR2", x: 33.33, y: 60, color: "volt", shape: "triangle" },
    ],
  },
  kickReturn: {
    name: { tr: "Kickoff dönüşü", en: "Kickoff return" },
    kicking: false,
    ball: "Ball on the kicking team's 35 tee (x=26.67, y=0). The return team's restraining line is 10 yds away at the kicking team's 45 (y=10). The front line is 12-15 yds away (kicking team's 47 to midfield), the wings are at their own 35 (y=30), the upbacks at their own 20 (y=45) and the returners at their own 5 (y=60). The goal line is at y=65.",
    own: [
      { label: "RT", x: 10, y: 12, color: "slate", shape: "triangle" },
      { label: "RG", x: 20, y: 15, color: "slate", shape: "triangle" },
      { label: "C", x: 26.67, y: 12, color: "slate", shape: "triangle" },
      { label: "LG", x: 33.33, y: 15, color: "slate", shape: "triangle" },
      { label: "LT", x: 43.33, y: 12, color: "slate", shape: "triangle" },
      { label: "RW", x: 14, y: 30, color: "ice", shape: "triangle" },
      { label: "LW", x: 39.33, y: 30, color: "ice", shape: "triangle" },
      { label: "RU", x: 18, y: 45, color: "chalk", shape: "triangle" },
      { label: "LU", x: 35.33, y: 45, color: "chalk", shape: "triangle" },
      { label: "KR", x: 20, y: 60, color: "volt", shape: "triangle" },
      { label: "KR2", x: 33.33, y: 60, color: "volt", shape: "triangle" },
    ],
    opponent: [
      { label: "L1", x: 4, y: -5, color: "amber", shape: "circle" },
      { label: "L2", x: 8.5, y: -5, color: "amber", shape: "circle" },
      { label: "L3", x: 13, y: -5, color: "amber", shape: "circle" },
      { label: "L4", x: 17.5, y: -5, color: "amber", shape: "circle" },
      { label: "L5", x: 22, y: -5, color: "amber", shape: "circle" },
      { label: "K", x: 24.67, y: -8, color: "signal", shape: "circle" },
      { label: "R5", x: 31.33, y: -5, color: "violet", shape: "circle" },
      { label: "R4", x: 35.83, y: -5, color: "violet", shape: "circle" },
      { label: "R3", x: 40.33, y: -5, color: "violet", shape: "circle" },
      { label: "R2", x: 44.83, y: -5, color: "violet", shape: "circle" },
      { label: "R1", x: 49.33, y: -5, color: "violet", shape: "circle" },
    ],
  },
  punt: {
    name: { tr: "Punt", en: "Punt" },
    kicking: true,
    ball: "LOS: the ball is on the ground under the long snapper, in the middle of the field (x = 26.67). The punter catches the snap about 14 yds deep (y = -14) and kicks about 12-13 yds deep, never closer than 10 yds to the LOS.",
    own: [
      { label: "LS", x: 26.67, y: -0.5, color: "slate", shape: "square" },
      { label: "LG", x: 25.47, y: -1, color: "slate", shape: "circle" },
      { label: "RG", x: 27.87, y: -1, color: "slate", shape: "circle" },
      { label: "LT", x: 24.27, y: -1, color: "slate", shape: "circle" },
      { label: "RT", x: 29.07, y: -1, color: "slate", shape: "circle" },
      { label: "LW", x: 23.27, y: -2, color: "ice", shape: "circle" },
      { label: "RW", x: 30.07, y: -2, color: "ice", shape: "circle" },
      { label: "PP", x: 27.27, y: -5, color: "chalk", shape: "circle" },
      { label: "P", x: 26.67, y: -14, color: "signal", shape: "circle" },
      { label: "GUN", x: 13.67, y: -0.5, color: "teal", shape: "circle" },
      { label: "GUN", x: 39.67, y: -0.5, color: "teal", shape: "circle" },
    ],
    opponent: [
      { label: "PR", x: 26.67, y: 40, color: "volt", shape: "triangle" },
      { label: "JAM", x: 14.67, y: 5, color: "teal", shape: "triangle" },
      { label: "JAM", x: 38.67, y: 5, color: "teal", shape: "triangle" },
      { label: "R3", x: 22.37, y: 1, color: "violet", shape: "triangle" },
      { label: "R2", x: 23.87, y: 1, color: "violet", shape: "triangle" },
      { label: "R1", x: 25.07, y: 1, color: "violet", shape: "triangle" },
      { label: "L1", x: 28.27, y: 1, color: "amber", shape: "triangle" },
      { label: "L2", x: 29.47, y: 1, color: "amber", shape: "triangle" },
      { label: "L3", x: 30.97, y: 1, color: "amber", shape: "triangle" },
      { label: "LB", x: 24.67, y: 5, color: "chalk", shape: "triangle" },
      { label: "LB", x: 28.67, y: 5, color: "chalk", shape: "triangle" },
    ],
  },
  puntReturn: {
    name: { tr: "Punt dönüşü", en: "Punt return" },
    kicking: false,
    ball: "LOS: the ball is at y = 0 in the middle of the field. The front is 1 yd off the ball, the jammers and hold-up players are 5 yds off, and the punt returner is about 40 yds downfield (y = +40).",
    own: [
      { label: "PR", x: 26.67, y: 40, color: "volt", shape: "triangle" },
      { label: "JAM", x: 14.67, y: 5, color: "teal", shape: "triangle" },
      { label: "JAM", x: 38.67, y: 5, color: "teal", shape: "triangle" },
      { label: "R3", x: 22.37, y: 1, color: "violet", shape: "triangle" },
      { label: "R2", x: 23.87, y: 1, color: "violet", shape: "triangle" },
      { label: "R1", x: 25.07, y: 1, color: "violet", shape: "triangle" },
      { label: "L1", x: 28.27, y: 1, color: "amber", shape: "triangle" },
      { label: "L2", x: 29.47, y: 1, color: "amber", shape: "triangle" },
      { label: "L3", x: 30.97, y: 1, color: "amber", shape: "triangle" },
      { label: "LB", x: 24.67, y: 5, color: "chalk", shape: "triangle" },
      { label: "LB", x: 28.67, y: 5, color: "chalk", shape: "triangle" },
    ],
    opponent: [
      { label: "LS", x: 26.67, y: -0.5, color: "slate", shape: "square" },
      { label: "LG", x: 25.47, y: -1, color: "slate", shape: "circle" },
      { label: "RG", x: 27.87, y: -1, color: "slate", shape: "circle" },
      { label: "LT", x: 24.27, y: -1, color: "slate", shape: "circle" },
      { label: "RT", x: 29.07, y: -1, color: "slate", shape: "circle" },
      { label: "LW", x: 23.27, y: -2, color: "ice", shape: "circle" },
      { label: "RW", x: 30.07, y: -2, color: "ice", shape: "circle" },
      { label: "PP", x: 27.27, y: -5, color: "chalk", shape: "circle" },
      { label: "P", x: 26.67, y: -14, color: "signal", shape: "circle" },
      { label: "GUN", x: 13.67, y: -0.5, color: "teal", shape: "circle" },
      { label: "GUN", x: 39.67, y: -0.5, color: "teal", shape: "circle" },
    ],
  },
  fieldGoal: {
    name: { tr: "Field goal / PAT", en: "Field goal / PAT" },
    kicking: true,
    ball: "Snapped at the line (y=0). For a PAT under NCAA/IFAF rules the snap is from the 3-yard line, anywhere between the hashes, usually the middle (x=26.67). A field goal is snapped where the last play ended, often on a hash (NCAA/IFAF hashes are 20 yd from each sideline, so x=20.0 or x=33.33; shift every x by -6.67 or +6.67). The kick is struck at the holder's spot, 7 yards behind the line (x=26.67, y=-7).",
    own: [
      { label: "LS", x: 26.67, y: -0.5, color: "slate", shape: "square" },
      { label: "LG", x: 25.57, y: -0.7, color: "slate", shape: "circle" },
      { label: "RG", x: 27.77, y: -0.7, color: "slate", shape: "circle" },
      { label: "LT", x: 24.47, y: -0.8, color: "slate", shape: "circle" },
      { label: "RT", x: 28.87, y: -0.8, color: "slate", shape: "circle" },
      { label: "LE", x: 23.37, y: -0.9, color: "slate", shape: "circle" },
      { label: "RE", x: 29.97, y: -0.9, color: "slate", shape: "circle" },
      { label: "LW", x: 22.6, y: -1.9, color: "ice", shape: "circle" },
      { label: "RW", x: 30.74, y: -1.9, color: "ice", shape: "circle" },
      { label: "H", x: 27.3, y: -7, color: "volt", shape: "circle" },
      { label: "K", x: 25.1, y: -9.4, color: "signal", shape: "circle" },
    ],
    opponent: [
      { label: "ER", x: 21.5, y: 1, color: "signal", shape: "triangle" },
      { label: "CR", x: 23.9, y: 0.8, color: "slate", shape: "triangle" },
      { label: "BR", x: 25, y: 0.8, color: "slate", shape: "triangle" },
      { label: "AR", x: 26, y: 0.8, color: "slate", shape: "triangle" },
      { label: "J", x: 26.67, y: 1.6, color: "volt", shape: "triangle" },
      { label: "AL", x: 27.35, y: 0.8, color: "slate", shape: "triangle" },
      { label: "BL", x: 28.35, y: 0.8, color: "slate", shape: "triangle" },
      { label: "CL", x: 29.45, y: 0.8, color: "slate", shape: "triangle" },
      { label: "EL", x: 31.85, y: 1, color: "signal", shape: "triangle" },
      { label: "SR", x: 20.3, y: 5.5, color: "teal", shape: "triangle" },
      { label: "SL", x: 33, y: 5.5, color: "teal", shape: "triangle" },
    ],
  },
  fieldGoalBlock: {
    name: { tr: "Field goal blok", en: "Field goal block" },
    kicking: false,
    ball: "The same ball as the kicking team: snapped at y=0 and kicked from about y=-7. The block point is about y=-2 to -5. Middle rushers need 1-2 yards of push. The edges aim about 2-3.5 yards in front of the holder, which is roughly 8-9 yards of running. On a PAT from the 3 the goal line is at y=3 and the end line at y=13.",
    own: [
      { label: "ER", x: 21.5, y: 1, color: "signal", shape: "triangle" },
      { label: "CR", x: 23.9, y: 0.8, color: "slate", shape: "triangle" },
      { label: "BR", x: 25, y: 0.8, color: "slate", shape: "triangle" },
      { label: "AR", x: 26, y: 0.8, color: "slate", shape: "triangle" },
      { label: "J", x: 26.67, y: 1.6, color: "volt", shape: "triangle" },
      { label: "AL", x: 27.35, y: 0.8, color: "slate", shape: "triangle" },
      { label: "BL", x: 28.35, y: 0.8, color: "slate", shape: "triangle" },
      { label: "CL", x: 29.45, y: 0.8, color: "slate", shape: "triangle" },
      { label: "EL", x: 31.85, y: 1, color: "signal", shape: "triangle" },
      { label: "SR", x: 20.3, y: 5.5, color: "teal", shape: "triangle" },
      { label: "SL", x: 33, y: 5.5, color: "teal", shape: "triangle" },
    ],
    opponent: [
      { label: "LS", x: 26.67, y: -0.5, color: "slate", shape: "square" },
      { label: "LG", x: 25.57, y: -0.7, color: "slate", shape: "circle" },
      { label: "RG", x: 27.77, y: -0.7, color: "slate", shape: "circle" },
      { label: "LT", x: 24.47, y: -0.8, color: "slate", shape: "circle" },
      { label: "RT", x: 28.87, y: -0.8, color: "slate", shape: "circle" },
      { label: "LE", x: 23.37, y: -0.9, color: "slate", shape: "circle" },
      { label: "RE", x: 29.97, y: -0.9, color: "slate", shape: "circle" },
      { label: "LW", x: 22.6, y: -1.9, color: "ice", shape: "circle" },
      { label: "RW", x: 30.74, y: -1.9, color: "ice", shape: "circle" },
      { label: "H", x: 27.3, y: -7, color: "volt", shape: "circle" },
      { label: "K", x: 25.1, y: -9.4, color: "signal", shape: "circle" },
    ],
  },
};
