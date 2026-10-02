/**
 * The team calendar: practices, games, meetings and anything else on the schedule. It is the
 * backbone of the Coach package: a practice plan belongs to a practice here, meeting notes to a
 * meeting, game stats to a game.
 *
 * Dates are local calendar days as ISO strings (yyyy-mm-dd) and times are "HH:MM", so an event
 * stays on the day the coach put it on, whatever the time zone.
 */

export type EventKind = "practice" | "game" | "meeting" | "other";
export const EVENT_KINDS: EventKind[] = ["practice", "game", "meeting", "other"];

export type Venue = "home" | "away" | "neutral";
export const VENUES: Venue[] = ["home", "away", "neutral"];

export interface TeamEvent {
  id: string;
  kind: EventKind;
  title: string;
  /** yyyy-mm-dd */
  date: string;
  /** HH:MM, or null for an all-day entry. */
  start: string | null;
  /** HH:MM, after start; null when open-ended. */
  end: string | null;
  location: string;
  notes: string;
  /** Games only. */
  opponent: string;
  venue: Venue | null;
  /** Events made together as a weekly series share this id. */
  seriesId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EventInput = Omit<TeamEvent, "id" | "seriesId" | "createdAt" | "updatedAt">;

export type EventError = "titleRequired" | "dateInvalid" | "timeInvalid" | "endBeforeStart" | "untilInvalid" | "tooMany";

/** A weekly series stops here: a season of practices, not an endless list. */
export const MAX_REPEATS = 60;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isIsoDay(s: string): boolean {
  if (!ISO_DAY.test(s)) return false;
  const d = parseDay(s);
  return toIsoDay(d) === s;
}

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso: string, n: number): string {
  const d = parseDay(iso);
  d.setDate(d.getDate() + n);
  return toIsoDay(d);
}

/** The first day of the month `delta` months away from the month of `iso`. */
export function addMonths(iso: string, delta: number): string {
  const d = parseDay(iso);
  return toIsoDay(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}

export const monthKey = (iso: string) => iso.slice(0, 7);

/**
 * The days shown for a month: whole weeks from the one holding the 1st to the one holding the
 * last day. `weekStart` is 1 for Monday, 0 for Sunday.
 */
export function monthGrid(iso: string, weekStart: 0 | 1): string[][] {
  const first = parseDay(`${monthKey(iso)}-01`);
  const lead = (first.getDay() - weekStart + 7) % 7;
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const days = lead + last.getDate();
  const weeks = Math.ceil(days / 7);
  const start = addDays(toIsoDay(first), -lead);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

/** The dates of a weekly series from `date` through `until`, both included. */
export function weeklyDates(date: string, until: string): string[] {
  const out: string[] = [];
  for (let d = date; d <= until && out.length < MAX_REPEATS + 1; d = addDays(d, 7)) out.push(d);
  return out;
}

export function validateEvent(e: Pick<EventInput, "title" | "date" | "start" | "end">, until: string | null = null): EventError[] {
  const errors: EventError[] = [];
  if (!e.title.trim()) errors.push("titleRequired");
  if (!isIsoDay(e.date)) errors.push("dateInvalid");
  if ((e.start !== null && !TIME.test(e.start)) || (e.end !== null && !TIME.test(e.end)) || (e.end !== null && e.start === null)) errors.push("timeInvalid");
  else if (e.start !== null && e.end !== null && e.end <= e.start) errors.push("endBeforeStart");
  if (until !== null) {
    if (!isIsoDay(until) || (isIsoDay(e.date) && until < e.date)) errors.push("untilInvalid");
    else if (isIsoDay(e.date) && weeklyDates(e.date, until).length > MAX_REPEATS) errors.push("tooMany");
  }
  return errors;
}

export function newEvent(input: EventInput, id: string, seriesId: string | null = null, now = new Date()): TeamEvent {
  const stamp = now.toISOString();
  const game = input.kind === "game";
  return {
    ...input,
    id,
    title: input.title.trim(),
    location: input.location.trim(),
    notes: input.notes.trim(),
    opponent: game ? input.opponent.trim() : "",
    venue: game ? (input.venue ?? "home") : null,
    seriesId,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/** Events in the order they happen: by day, all-day entries first, then by start time. */
export function sortEvents(events: TeamEvent[]): TeamEvent[] {
  return [...events].sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? "") || a.title.localeCompare(b.title));
}

/** Events grouped by day, in order. */
export function byDay(events: TeamEvent[]): Map<string, TeamEvent[]> {
  const out = new Map<string, TeamEvent[]>();
  for (const e of sortEvents(events)) {
    const list = out.get(e.date) ?? [];
    list.push(e);
    out.set(e.date, list);
  }
  return out;
}

/** Events from `today` on (all of today included), soonest first. */
export function upcoming(events: TeamEvent[], today: string, limit = Infinity): TeamEvent[] {
  return sortEvents(events.filter((e) => e.date >= today)).slice(0, limit);
}
