import type { L10n } from "./types";

export type TestUnit = "s" | "cm" | "reps" | "kg";
/** Kept for the sport modules, which only use time, distance and reps. */
export type CombineUnit = TestUnit;

export interface PerformanceTest {
  id: string;
  name: L10n;
  unit: TestUnit;
  better: "lower" | "higher";
}
export type CombineTest = PerformanceTest;

/** Football combine tests, used by the Coach package's sport modules. */
export const combineTests: Record<string, PerformanceTest> = {
  forty: { id: "forty", name: { tr: "40 yard koşu", en: "40-yard dash" }, unit: "s", better: "lower" },
  split10: { id: "split10", name: { tr: "10 yard split", en: "10-yard split" }, unit: "s", better: "lower" },
  vertical: { id: "vertical", name: { tr: "Dikey sıçrama", en: "Vertical jump" }, unit: "cm", better: "higher" },
  broad: { id: "broad", name: { tr: "Durarak uzun atlama", en: "Broad jump" }, unit: "cm", better: "higher" },
  proAgility: { id: "proAgility", name: { tr: "Pro agility 5-10-5", en: "Pro agility 5-10-5" }, unit: "s", better: "lower" },
  threeCone: { id: "threeCone", name: { tr: "3 koni", en: "3-cone drill" }, unit: "s", better: "lower" },
  bench225: { id: "bench225", name: { tr: "Bench press 102 kg", en: "Bench press 225 lb" }, unit: "reps", better: "higher" },
};

/** Sport-independent tests for the PT package. */
export const generalTests: Record<string, PerformanceTest> = {
  sprint30: { id: "sprint30", name: { tr: "30 m sprint", en: "30 m sprint" }, unit: "s", better: "lower" },
  vertical: { id: "vertical", name: { tr: "Dikey sıçrama", en: "Vertical jump" }, unit: "cm", better: "higher" },
  broad: { id: "broad", name: { tr: "Durarak uzun atlama", en: "Broad jump" }, unit: "cm", better: "higher" },
  squat1rm: { id: "squat1rm", name: { tr: "Squat 1RM", en: "Squat 1RM" }, unit: "kg", better: "higher" },
  bench1rm: { id: "bench1rm", name: { tr: "Bench press 1RM", en: "Bench press 1RM" }, unit: "kg", better: "higher" },
  deadlift1rm: { id: "deadlift1rm", name: { tr: "Deadlift 1RM", en: "Deadlift 1RM" }, unit: "kg", better: "higher" },
};
