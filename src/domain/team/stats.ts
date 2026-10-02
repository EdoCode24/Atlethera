import { sports } from "@/domain/sports";
import type { SportId, StatGroup } from "@/domain/sports/types";
import { groupOf, type Player } from "./roster";

/**
 * Game stats: the score of each game on the calendar and every player's numbers in the sport's
 * stat groups. Coaches enter counts; rates and averages are worked out from them, per game and
 * over the season.
 */

/** A player's numbers in one game, keyed "group.stat" ("passing.yds"). */
export type StatLine = Record<string, number>;

export interface GameStats {
  /** The game on the calendar these belong to. */
  eventId: string;
  us: number | null;
  them: number | null;
  /** Keyed by player id. */
  players: Record<string, StatLine>;
  notes: string;
  updatedAt: string;
}

export function emptyGame(eventId: string, now = new Date()): GameStats {
  return { eventId, us: null, them: null, players: {}, notes: "", updatedAt: now.toISOString() };
}

export const statKey = (group: string, key: string) => `${group}.${key}`;

export type Result = "win" | "loss" | "tie";

export function result(game: Pick<GameStats, "us" | "them">): Result | null {
  if (game.us === null || game.them === null) return null;
  return game.us > game.them ? "win" : game.us < game.them ? "loss" : "tie";
}

/** Wins, losses and ties, and points for and against, over the games with a final score. */
export function seasonRecord(games: Pick<GameStats, "us" | "them">[]) {
  const out = { win: 0, loss: 0, tie: 0, pointsFor: 0, pointsAgainst: 0, played: 0 };
  for (const g of games) {
    const r = result(g);
    if (!r) continue;
    out[r]++;
    out.played++;
    out.pointsFor += g.us!;
    out.pointsAgainst += g.them!;
  }
  return out;
}

// ── How each stat is kept ────────────────────────────────────────────────────

const ratio = (a: number | undefined, b: number | undefined, scale = 1) => (b ? ((a ?? 0) / b) * scale : null);

/** NFL passer rating: four parts, each held between 0 and 2.375. */
export function passerRating(cmp: number, att: number, yds: number, td: number, int: number): number | null {
  if (!att) return null;
  const part = (x: number) => Math.min(2.375, Math.max(0, x));
  const a = part((cmp / att - 0.3) * 5);
  const b = part((yds / att - 3) * 0.25);
  const c = part((td / att) * 20);
  const d = part(2.375 - (int / att) * 25);
  return ((a + b + c + d) / 6) * 100;
}

type Rule =
  /** Worked out from the counts of the same group. */
  | { kind: "derived"; from: (get: (key: string) => number | undefined) => number | null; digits: number }
  /** A per-game best: the season keeps the highest. */
  | { kind: "max" }
  /** A per-game average: the season weighs each game by `by`. */
  | { kind: "average"; by: string; digits: number };

/** Keyed "group.stat"; every other stat is a count that adds up. */
const RULES: Record<string, Rule> = {
  "passing.cmpPct": { kind: "derived", from: (g) => ratio(g("cmp"), g("att"), 100), digits: 1 },
  "passing.rate": { kind: "derived", from: (g) => passerRating(g("cmp") ?? 0, g("att") ?? 0, g("yds") ?? 0, g("td") ?? 0, g("int") ?? 0), digits: 1 },
  "rushing.ypc": { kind: "derived", from: (g) => ratio(g("yds"), g("car")), digits: 1 },
  "receiving.ypr": { kind: "derived", from: (g) => ratio(g("yds"), g("rec")), digits: 1 },
  "kicking.fgPct": { kind: "derived", from: (g) => ratio(g("fgm"), g("fga"), 100), digits: 1 },
  "kicking.lng": { kind: "max" },
  "punting.avg": { kind: "average", by: "punts", digits: 1 },
  "punting.net": { kind: "average", by: "punts", digits: 1 },
  "returns.avg": { kind: "derived", from: (g) => ratio(g("yds"), g("ret")), digits: 1 },
};

/** Whether the coach types this stat in (a derived one is worked out). */
export function isEntered(group: string, key: string): boolean {
  return RULES[statKey(group, key)]?.kind !== "derived";
}

/** Digits after the decimal point the stat is shown with. */
export function statDigits(group: string, key: string): number {
  const rule = RULES[statKey(group, key)];
  return rule && rule.kind !== "max" ? rule.digits : 0;
}

/** Yards (and net averages) can go below zero; counts can't. */
export function allowsNegative(key: string): boolean {
  return key === "yds" || key === "net";
}

/** A stat's value in a line: the entered number, or one worked out from the line's counts. */
export function statValue(line: StatLine, group: string, key: string): number | null {
  const rule = RULES[statKey(group, key)];
  if (rule?.kind === "derived") return rule.from((k) => line[statKey(group, k)]);
  const v = line[statKey(group, key)];
  return v === undefined ? null : v;
}

/** Several games' lines as one: counts add up, bests keep the highest, averages are weighed. */
export function combineLines(lines: StatLine[]): StatLine {
  const out: StatLine = {};
  const weights: Record<string, number> = {};
  for (const line of lines) {
    for (const [k, v] of Object.entries(line)) {
      const rule = RULES[k];
      if (rule?.kind === "derived") continue;
      if (rule?.kind === "max") out[k] = Math.max(out[k] ?? -Infinity, v);
      else if (rule?.kind === "average") {
        const w = line[`${k.split(".")[0]}.${rule.by}`] ?? 0;
        out[k] = (out[k] ?? 0) + v * w;
        weights[k] = (weights[k] ?? 0) + w;
      } else out[k] = (out[k] ?? 0) + v;
    }
  }
  for (const [k, w] of Object.entries(weights)) {
    if (w) out[k] = out[k] / w;
    else delete out[k];
  }
  return out;
}

/** Whether the line has anything in a stat group. */
export function hasGroup(line: StatLine | undefined, group: string): boolean {
  return !!line && Object.keys(line).some((k) => k.startsWith(`${group}.`));
}

/** The stat groups a player's positions keep, in the sport's order. */
export function playerStatGroups(player: Pick<Player, "positions">, sport: SportId): string[] {
  const ids = new Set(player.positions.flatMap((pos) => groupOf(sport, pos)?.statGroups ?? []));
  return sports[sport].statGroups.map((g) => g.id).filter((id) => ids.has(id));
}

/** The stat that leads a group's table: yards where there are yards, else the first count. */
export function leadStat(group: StatGroup): string {
  return group.stats.find((s) => s.key === "yds")?.key ?? group.stats.find((s) => isEntered(group.id, s.key))?.key ?? group.stats[0].key;
}

/** A value as it is read: whole counts, one decimal for rates and averages. */
export function formatStat(value: number | null, digits: number, locale: string): string {
  if (value === null || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}
