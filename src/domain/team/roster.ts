import { sports } from "@/domain/sports";
import type { PositionGroup, Side, SportId } from "@/domain/sports/types";

/**
 * The Coach package's roster: the players of one team (workspace), in the positions of its sport
 * module, and a depth chart that orders them per position. Everything the other modules record
 * (attendance, stats, evaluations) points at these player ids.
 */

export type PlayerStatus = "active" | "injured" | "inactive";
export const PLAYER_STATUSES: PlayerStatus[] = ["active", "injured", "inactive"];

export interface Injury {
  note: string;
  /** Expected return, ISO date (yyyy-mm-dd); null when unknown. */
  returnDate: string | null;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  /** Jersey number, 0-99; null when not given yet. */
  number: number | null;
  /** Positions of the sport module, primary first. */
  positions: string[];
  status: PlayerStatus;
  injury: Injury | null;
  heightCm: number | null;
  weightKg: number | null;
  /** ISO date (yyyy-mm-dd). */
  birthDate: string | null;
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Roster {
  players: Player[];
  /** Ordered player ids per position: the starter first. */
  depth: Record<string, string[]>;
}

export const EMPTY_ROSTER: Roster = { players: [], depth: {} };

/** Every position of the sport, grouped the way coaches talk about them, in field order. */
export function positionGroups(sport: SportId): PositionGroup[] {
  return sports[sport].positionGroups;
}

export function allPositions(sport: SportId): string[] {
  return positionGroups(sport).flatMap((g) => g.positions);
}

export function groupOf(sport: SportId, position: string): PositionGroup | null {
  return positionGroups(sport).find((g) => g.positions.includes(position)) ?? null;
}

export function sideOf(sport: SportId, position: string): Side | null {
  return groupOf(sport, position)?.side ?? null;
}

export const fullName = (p: Pick<Player, "firstName" | "lastName">) => `${p.firstName} ${p.lastName}`.trim();

export type PlayerInput = Partial<Omit<Player, "id" | "createdAt" | "updatedAt">> & Pick<Player, "firstName">;

export type PlayerError = "nameRequired" | "numberRange" | "heightRange" | "weightRange" | "birthDate";

/** Problems with a player's fields, or an empty list. Duplicate numbers are allowed (a warning, not an error). */
export function validatePlayer(p: Pick<Player, "firstName" | "lastName" | "number" | "heightCm" | "weightKg" | "birthDate">): PlayerError[] {
  const errors: PlayerError[] = [];
  if (!`${p.firstName}${p.lastName}`.trim()) errors.push("nameRequired");
  // Written as "inside the range" so a number that failed to parse (NaN) is out of it.
  const within = (n: number, min: number, max: number) => n >= min && n <= max;
  if (p.number !== null && !(Number.isInteger(p.number) && within(p.number, 0, 99))) errors.push("numberRange");
  if (p.heightCm !== null && !within(p.heightCm, 120, 230)) errors.push("heightRange");
  if (p.weightKg !== null && !within(p.weightKg, 35, 200)) errors.push("weightRange");
  if (p.birthDate !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate) || Number.isNaN(Date.parse(p.birthDate)))) errors.push("birthDate");
  return errors;
}

export function newPlayer(input: PlayerInput, id: string, now = new Date()): Player {
  const stamp = now.toISOString();
  return {
    id,
    firstName: input.firstName.trim(),
    lastName: (input.lastName ?? "").trim(),
    number: input.number ?? null,
    positions: input.positions ?? [],
    status: input.status ?? "active",
    injury: input.status === "injured" ? (input.injury ?? { note: "", returnDate: null }) : null,
    heightCm: input.heightCm ?? null,
    weightKg: input.weightKg ?? null,
    birthDate: input.birthDate ?? null,
    phone: input.phone ?? "",
    email: input.email ?? "",
    notes: input.notes ?? "",
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/** Numbers worn by more than one player. */
export function duplicateNumbers(players: Player[]): Set<number> {
  const seen = new Set<number>();
  const twice = new Set<number>();
  for (const p of players) {
    if (p.number === null) continue;
    if (seen.has(p.number)) twice.add(p.number);
    seen.add(p.number);
  }
  return twice;
}

export function age(birthDate: string | null, today = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  let years = today.getFullYear() - b.getFullYear();
  const beforeBirthday = today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate());
  if (beforeBirthday) years--;
  return years;
}

export type RosterSort = "number" | "name" | "position";

/** Players in the order a coach reads a roster: by number, by last name, or by position in field order. */
export function sortPlayers(players: Player[], sport: SportId, by: RosterSort, locale = "tr"): Player[] {
  const order = allPositions(sport);
  const posIndex = (p: Player) => (p.positions.length ? order.indexOf(p.positions[0]) : Infinity);
  // A player known by one name sorts by that name.
  const last = (p: Player) => p.lastName || p.firstName;
  const byName = (a: Player, b: Player) => last(a).localeCompare(last(b), locale) || a.firstName.localeCompare(b.firstName, locale);
  const byNumber = (a: Player, b: Player) => (a.number ?? 1000) - (b.number ?? 1000);
  return [...players].sort((a, b) => {
    if (by === "number") return byNumber(a, b) || byName(a, b);
    if (by === "position") return posIndex(a) - posIndex(b) || byNumber(a, b) || byName(a, b);
    return byName(a, b) || byNumber(a, b);
  });
}

// ── Bulk paste ─────────────────────────────────────────────────────────────

/** Line spots coaches write instead of the position (American football). */
const LINE_SPOTS: Record<string, string> = { LT: "OT", RT: "OT", LG: "OG", RG: "OG", ILB: "MLB" };

/**
 * Every name that means a position of the sport, upper-cased: the positions themselves, the
 * abbreviation of a group that has one position (RSH for Rusher), and line spots such as LT.
 */
export function positionNames(sport: SportId): Map<string, string> {
  const names = new Map(allPositions(sport).map((p) => [p.toLocaleUpperCase("en-US"), p]));
  for (const g of positionGroups(sport)) {
    const abbr = g.abbr.toLocaleUpperCase("en-US");
    if (g.positions.length === 1 && !names.has(abbr)) names.set(abbr, g.positions[0]);
  }
  if (sport === "american-football") for (const [spot, pos] of Object.entries(LINE_SPOTS)) names.set(spot, pos);
  return names;
}

export interface ParsedLine {
  line: number;
  input: PlayerInput | null;
  /** Words that looked like positions but are not in this sport. */
  unknown: string[];
}

/**
 * Players from pasted lines, in any order of number, name and positions: "12 Ahmet Yılmaz QB",
 * "Mehmet Kaya, 7, WR/CB", "Can Demir 88 TE". Separators: spaces, commas, tabs, slashes and
 * semicolons. The last name is the last name word; blank lines are skipped.
 */
export function parseBulk(text: string, sport: SportId, locale = "tr"): ParsedLine[] {
  const known = positionNames(sport);
  const out: ParsedLine[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const tokens = raw
      .split(/[\s,;\t/|]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!tokens.length) return;
    // A line typed all in capitals has capitalised names too; only mixed-case lines can flag them.
    const shouting = raw === raw.toLocaleUpperCase(locale);
    let number: number | null = null;
    const positions: string[] = [];
    const unknown: string[] = [];
    const name: string[] = [];
    for (const token of tokens) {
      const bare = token.replace(/^#/, "");
      if (number === null && /^\d{1,2}$/.test(bare)) {
        number = Number(bare);
        continue;
      }
      const pos = known.get(token.toLocaleUpperCase("en-US"));
      if (pos) {
        if (!positions.includes(pos)) positions.push(pos);
        continue;
      }
      // An all-caps short word that is not a position of this sport: report it rather than
      // silently taking it as part of the name.
      if (!shouting && /^[A-Z]{1,3}$/.test(token) && name.length > 0) {
        unknown.push(token);
        continue;
      }
      name.push(token);
    }
    const input: PlayerInput | null = name.length
      ? {
          firstName: name.slice(0, -1).join(" ") || name[0],
          lastName: name.length > 1 ? name[name.length - 1] : "",
          number,
          positions,
        }
      : null;
    if (input && name.length === 1) input.lastName = "";
    // Keep Turkish capitalisation of names as typed, but tidy all-lowercase entries.
    if (input) {
      const tidy = (w: string) => (w === w.toLocaleLowerCase(locale) ? w.charAt(0).toLocaleUpperCase(locale) + w.slice(1) : w);
      input.firstName = input.firstName.split(" ").map(tidy).join(" ");
      input.lastName = input.lastName ? tidy(input.lastName) : "";
    }
    out.push({ line: i + 1, input, unknown });
  });
  return out;
}

// ── Depth chart ────────────────────────────────────────────────────────────

/**
 * The depth chart kept in step with the players: every player listed under each of his
 * positions (new ones at the end), nobody listed under a position he no longer plays, and no
 * one who left the roster.
 */
export function syncDepth(depth: Record<string, string[]>, players: Player[]): Record<string, string[]> {
  const byId = new Map(players.map((p) => [p.id, p]));
  const next: Record<string, string[]> = {};
  for (const [pos, ids] of Object.entries(depth)) {
    const kept = ids.filter((id) => byId.get(id)?.positions.includes(pos));
    if (kept.length) next[pos] = kept;
  }
  for (const p of players) {
    for (const pos of p.positions) {
      const list = next[pos] ?? (next[pos] = []);
      if (!list.includes(p.id)) list.push(p.id);
    }
  }
  return next;
}

/** Moves a player up (-1) or down (+1) in one position's list. */
export function moveInDepth(depth: Record<string, string[]>, position: string, playerId: string, delta: -1 | 1): Record<string, string[]> {
  const list = [...(depth[position] ?? [])];
  const i = list.indexOf(playerId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return depth;
  [list[i], list[j]] = [list[j], list[i]];
  return { ...depth, [position]: list };
}

/** Puts a player at a given place (0 = starter) in one position's list. */
export function placeInDepth(depth: Record<string, string[]>, position: string, playerId: string, index: number): Record<string, string[]> {
  const list = (depth[position] ?? []).filter((id) => id !== playerId);
  list.splice(Math.max(0, Math.min(index, list.length)), 0, playerId);
  return { ...depth, [position]: list };
}
