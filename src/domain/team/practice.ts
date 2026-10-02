import type { SportId } from "@/domain/sports/types";

/**
 * A practice plan: the periods of one practice on the calendar, in order, each with its length,
 * the unit that works in it, the drill and the playbook plays it runs; and who came.
 */

export type Unit = "team" | "offense" | "defense" | "special" | "individual";
export type Attendance = "present" | "late" | "absent" | "excused";
export const ATTENDANCE: Attendance[] = ["present", "late", "absent", "excused"];

export interface PlayRef {
  playbookId: string;
  playId: string;
}

export interface Period {
  id: string;
  name: string;
  minutes: number;
  unit: Unit;
  drill: string;
  plays: PlayRef[];
}

export interface PracticePlan {
  /** The practice on the calendar this plan belongs to. */
  eventId: string;
  focus: string;
  periods: Period[];
  /** Keyed by player id; players not in it are not marked yet. */
  attendance: Record<string, Attendance>;
  notes: string;
  updatedAt: string;
}

export const MINUTES = { min: 1, max: 240, step: 5 };

/** Units that exist in the sport: flag football has no special teams. */
export function unitsFor(sport: SportId): Unit[] {
  return sport === "american-football" ? ["team", "offense", "defense", "special", "individual"] : ["team", "offense", "defense", "individual"];
}

export type Preset = "warmup" | "individual" | "group" | "team" | "special" | "conditioning" | "cooldown";

/** The usual blocks of a practice, in the order they usually come, with the unit that works in each. */
export function presetsFor(sport: SportId): { preset: Preset; unit: Unit }[] {
  const all: { preset: Preset; unit: Unit }[] = [
    { preset: "warmup", unit: "team" },
    { preset: "individual", unit: "individual" },
    { preset: "group", unit: "offense" },
    { preset: "team", unit: "team" },
    { preset: "special", unit: "special" },
    { preset: "conditioning", unit: "team" },
    { preset: "cooldown", unit: "team" },
  ];
  const units = unitsFor(sport);
  return all.filter((p) => units.includes(p.unit));
}

export function emptyPlan(eventId: string, now = new Date()): PracticePlan {
  return { eventId, focus: "", periods: [], attendance: {}, notes: "", updatedAt: now.toISOString() };
}

export const clampMinutes = (n: number) => Math.min(MINUTES.max, Math.max(MINUTES.min, Math.round(n)));

export function totalMinutes(periods: Pick<Period, "minutes">[]): number {
  return periods.reduce((n, p) => n + p.minutes, 0);
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toClock = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export function addMinutes(hhmm: string, n: number): string {
  return toClock(toMinutes(hhmm) + n);
}

/** Minutes between two times of one day; null when either is missing or the end is not later. */
export function durationMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const d = toMinutes(end) - toMinutes(start);
  return d > 0 ? d : null;
}

/** When each period starts and ends, from the practice's start time; null without a start time. */
export function periodClock(start: string | null, periods: Pick<Period, "minutes">[]): { start: string; end: string }[] | null {
  if (!start) return null;
  let at = toMinutes(start);
  return periods.map((p) => {
    const slot = { start: toClock(at), end: toClock(at + p.minutes) };
    at += p.minutes;
    return slot;
  });
}

/** Periods copied into another plan: new ids, the same content. */
export function copyPeriods(periods: Period[], newId: () => string): Period[] {
  return periods.map((p) => ({ ...p, id: newId(), plays: p.plays.map((r) => ({ ...r })) }));
}

export function move<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const j = index + delta;
  if (index < 0 || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

export type AttendanceCounts = Record<Attendance | "unmarked", number>;

/** How the roster's players are marked in one plan. */
export function attendanceCounts(plan: Pick<PracticePlan, "attendance">, playerIds: string[]): AttendanceCounts {
  const counts: AttendanceCounts = { present: 0, late: 0, absent: 0, excused: 0, unmarked: 0 };
  for (const id of playerIds) counts[plan.attendance[id] ?? "unmarked"]++;
  return counts;
}

/**
 * A player's attendance over the practices where it was taken: late counts as there, excused
 * absences are left out of the rate.
 */
export function playerAttendance(plans: Pick<PracticePlan, "attendance">[], playerId: string): { taken: number; attended: number; excused: number; rate: number | null } {
  let taken = 0;
  let attended = 0;
  let excused = 0;
  for (const plan of plans) {
    const mark = plan.attendance[playerId];
    if (!mark) continue;
    if (mark === "excused") {
      excused++;
      continue;
    }
    taken++;
    if (mark === "present" || mark === "late") attended++;
  }
  return { taken, attended, excused, rate: taken ? attended / taken : null };
}
