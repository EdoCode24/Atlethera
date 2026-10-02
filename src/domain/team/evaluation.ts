import { combineTests, type PerformanceTest, type TestUnit } from "@/domain/sports/combine";
import { sports } from "@/domain/sports";
import type { SportId } from "@/domain/sports/types";

/**
 * Player evaluation: the coach's ratings (1 to 5) on criteria the coach names, dated so progress
 * shows; and test days with the sport's combine tests.
 */

export interface Criterion {
  id: string;
  name: string;
}

export const RATINGS = [1, 2, 3, 4, 5] as const;

export interface Evaluation {
  id: string;
  playerId: string;
  /** yyyy-mm-dd */
  date: string;
  /** Keyed by criterion id, 1 to 5; criteria left out were not rated. */
  ratings: Record<string, number>;
  strengths: string;
  improve: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestSession {
  id: string;
  /** yyyy-mm-dd */
  date: string;
  title: string;
  /** Keyed by player id, then test id. */
  results: Record<string, Record<string, number>>;
  createdAt: string;
}

export interface EvaluationData {
  /** Null until the coach saves something: the defaults of the language are used until then. */
  criteria: Criterion[] | null;
  evaluations: Evaluation[];
  tests: TestSession[];
}

export const EMPTY_EVALUATION_DATA: EvaluationData = { criteria: null, evaluations: [], tests: [] };

/** Criteria named in the coach's language, for a team that has not set its own. */
export function defaultCriteria(names: readonly string[]): Criterion[] {
  return names.map((name, i) => ({ id: `c${i + 1}`, name }));
}

/** The mean of the criteria that were rated, among those still in use; null when none was. */
export function averageRating(ratings: Record<string, number>, criteria: Criterion[]): number | null {
  const values = criteria.map((c) => ratings[c.id]).filter((v): v is number => typeof v === "number");
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** A player's evaluations, newest first. */
export function history(evaluations: Evaluation[], playerId: string): Evaluation[] {
  return evaluations.filter((e) => e.playerId === playerId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** How the latest evaluation compares with the one before: a change in the mean, or null. */
export function trend(evaluations: Evaluation[], playerId: string, criteria: Criterion[]): number | null {
  const [latest, previous] = history(evaluations, playerId);
  if (!latest || !previous) return null;
  const a = averageRating(latest.ratings, criteria);
  const b = averageRating(previous.ratings, criteria);
  return a === null || b === null ? null : a - b;
}

// ── Tests ───────────────────────────────────────────────────────────────────

export function sportTests(sport: SportId): PerformanceTest[] {
  return sports[sport].combine.map((id) => combineTests[id]).filter(Boolean);
}

/** Readings a test can plausibly give, to catch a slip of the finger. */
const RANGES: Record<TestUnit, [number, number]> = { s: [0.5, 60], cm: [1, 400], reps: [0, 100], kg: [1, 500] };

export function validResult(test: PerformanceTest, value: number): boolean {
  const [min, max] = RANGES[test.unit];
  return value >= min && value <= max && (test.unit !== "reps" || Number.isInteger(value));
}

const better = (test: PerformanceTest, a: number, b: number) => (test.better === "lower" ? a < b : a > b);

/** A player's best reading in a test over all test days, with the day it came on. */
export function personalBest(sessions: TestSession[], playerId: string, test: PerformanceTest): { value: number; date: string } | null {
  let best: { value: number; date: string } | null = null;
  for (const s of sessions) {
    const v = s.results[playerId]?.[test.id];
    if (v === undefined) continue;
    if (!best || better(test, v, best.value)) best = { value: v, date: s.date };
  }
  return best;
}

/** The team's best reading in a test, over the given players' personal bests. */
export function teamBest(sessions: TestSession[], playerIds: string[], test: PerformanceTest): number | null {
  let best: number | null = null;
  for (const id of playerIds) {
    const pb = personalBest(sessions, id, test);
    if (pb && (best === null || better(test, pb.value, best))) best = pb.value;
  }
  return best;
}
