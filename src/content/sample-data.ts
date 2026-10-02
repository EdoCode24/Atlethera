/**
 * Sample values for the product mockups. Every surface that renders these carries a
 * "sample view" badge. Nothing here is a claim about real users or results.
 * Nutrition numbers are never typed in: they are computed by the real formula.
 */
import { calculateNutrition, type NutritionInput, type NutritionTargets } from "@/domain/nutrition/nutrition";
import type { L10n, SportId } from "@/domain/sports/types";

/* ───────────── Coach package: the hero dashboard ───────────── */

export interface SampleEvent {
  time: string;
  title: L10n;
  group: L10n;
}

export interface SampleKpi {
  test: string;
  value: number;
  /** Change over the last four weeks. */
  delta: number;
}

export interface CoachSample {
  athlete: string;
  roster: { offense: number; defense: number; special: number };
  events: SampleEvent[];
  kpis: SampleKpi[];
  /** Weekly 40-yard dash in seconds, eight weeks; the last four match the KPI delta. */
  fortyTrend: number[];
}

export const coachSamples: Record<SportId, CoachSample> = {
  "american-football": {
    athlete: "Kaan Demir",
    roster: { offense: 22, defense: 20, special: 4 },
    events: [
      { time: "16:00", title: { tr: "Takım antrenmanı", en: "Team practice" }, group: { tr: "Tüm takım", en: "Full team" } },
      { time: "18:00", title: { tr: "Pozisyon toplantısı", en: "Position meeting" }, group: { tr: "WR grubu", en: "WR group" } },
      { time: "19:30", title: { tr: "Maç videosu, 3. çeyrek", en: "Game film, Q3" }, group: { tr: "Savunma", en: "Defense" } },
    ],
    kpis: [
      { test: "forty", value: 4.62, delta: -0.06 },
      { test: "vertical", value: 81, delta: 3 },
      { test: "bench225", value: 14, delta: 2 },
      { test: "split10", value: 1.61, delta: -0.03 },
    ],
    fortyTrend: [4.74, 4.73, 4.71, 4.7, 4.68, 4.66, 4.64, 4.62],
  },
  "flag-football": {
    athlete: "Elif Şahin",
    roster: { offense: 7, defense: 6, special: 0 },
    events: [
      { time: "17:00", title: { tr: "Takım antrenmanı", en: "Team practice" }, group: { tr: "Tüm takım", en: "Full team" } },
      { time: "18:30", title: { tr: "Savunma toplantısı", en: "Defense meeting" }, group: { tr: "Rusher ve DB", en: "Rushers and DBs" } },
      { time: "19:30", title: { tr: "Playbook: yeni oyunlar", en: "Playbook: new plays" }, group: { tr: "Hücum", en: "Offense" } },
    ],
    kpis: [
      { test: "forty", value: 5.04, delta: -0.08 },
      { test: "proAgility", value: 4.61, delta: -0.09 },
      { test: "threeCone", value: 7.42, delta: -0.12 },
      { test: "vertical", value: 58, delta: 2 },
    ],
    fortyTrend: [5.16, 5.15, 5.13, 5.12, 5.12, 5.09, 5.07, 5.04],
  },
};

/** 40-yard times entered on the sideline tablet, in the devices mockup. */
export const sidelineTimes: { athlete: string; position: string; time: number | null }[] = [
  { athlete: "Kaan Demir", position: "WR", time: 4.62 },
  { athlete: "Mert Aydın", position: "RB", time: 4.58 },
  { athlete: "Emre Kaya", position: "QB", time: 4.81 },
  { athlete: "Can Öztürk", position: "CB", time: null },
];

/* ───────────── PT package: one athlete through the workflow ───────────── */

export const ptAthlete = {
  name: "Ece Tunç",
  initials: "ET",
  age: 26,
  heightCm: 170,
  weightKg: 63,
  goals: [
    { tr: "Squat 1RM: 90 kg", en: "Squat 1RM: 90 kg" },
    { tr: "30 m sprint: 4,60 sn altı", en: "30 m sprint under 4.60 s" },
  ] satisfies L10n[],
};

export type SessionKind = "strength" | "speed" | "recovery" | "conditioning" | "rest";

export const programWeek: { kind: SessionKind; title: L10n }[] = [
  { kind: "strength", title: { tr: "Alt vücut kuvvet", en: "Lower-body strength" } },
  { kind: "conditioning", title: { tr: "Kondisyon", en: "Conditioning" } },
  { kind: "recovery", title: { tr: "Aktif dinlenme", en: "Active recovery" } },
  { kind: "strength", title: { tr: "Üst vücut kuvvet", en: "Upper-body strength" } },
  { kind: "speed", title: { tr: "Sprint ve pliometri", en: "Sprints and plyometrics" } },
  { kind: "recovery", title: { tr: "Mobilite", en: "Mobility" } },
  { kind: "rest", title: { tr: "Dinlenme", en: "Rest" } },
];

export const sessionLog: { exercise: string; sets: string; load: L10n; rpe: number }[] = [
  { exercise: "Back squat", sets: "4 × 5", load: { tr: "75 kg", en: "75 kg" }, rpe: 8 },
  { exercise: "Romanian deadlift", sets: "3 × 8", load: { tr: "60 kg", en: "60 kg" }, rpe: 7 },
  { exercise: "Bulgarian split squat", sets: "3 × 8", load: { tr: "2 × 12 kg", en: "2 × 12 kg" }, rpe: 8 },
  { exercise: "Box jump", sets: "4 × 3", load: { tr: "Vücut ağırlığı", en: "Bodyweight" }, rpe: 6 },
  { exercise: "Nordic curl", sets: "3 × 5", load: { tr: "Vücut ağırlığı", en: "Bodyweight" }, rpe: 8 },
];

export const ptNutritionInput: NutritionInput = {
  sex: "female",
  age: ptAthlete.age,
  heightCm: ptAthlete.heightCm,
  weightKg: ptAthlete.weightKg,
  activity: "high",
  goal: "gain",
};

export function sampleNutrition(input: NutritionInput = ptNutritionInput): NutritionTargets {
  const result = calculateNutrition(input);
  if (!result.ok) throw new Error("Sample nutrition input is out of range");
  return result;
}

/** Weekly bodyweight in kg, eight weeks. */
export const bodyweightSeries = [61.4, 61.7, 61.9, 62.1, 62.4, 62.5, 62.8, 63.0];
export const bodyweightGoal = 64;

/** Weekly 30 m sprint in seconds, eight weeks. */
export const sprintSeries = [4.84, 4.82, 4.8, 4.77, 4.75, 4.73, 4.7, 4.68];

export const ptTestResults: { test: string; value: number; goal: number }[] = [
  { test: "sprint30", value: 4.68, goal: 4.6 },
  { test: "vertical", value: 46, goal: 50 },
  { test: "broad", value: 215, goal: 225 },
  { test: "squat1rm", value: 85, goal: 90 },
  { test: "bench1rm", value: 50, goal: 55 },
  { test: "deadlift1rm", value: 110, goal: 120 },
];

export interface CalculatorPreset {
  id: string;
  label: L10n;
  input: NutritionInput;
}

export const calculatorPresets: CalculatorPreset[] = [
  { id: "strength", label: { tr: "Kuvvet", en: "Strength" }, input: { sex: "male", age: 22, heightCm: 183, weightKg: 84, activity: "high", goal: "maintain" } },
  { id: "sprint", label: { tr: "Sprint", en: "Sprint" }, input: { sex: "female", age: 24, heightCm: 168, weightKg: 60, activity: "high", goal: "maintain" } },
  { id: "endurance", label: { tr: "Dayanıklılık", en: "Endurance" }, input: { sex: "male", age: 30, heightCm: 176, weightKg: 70, activity: "athlete", goal: "maintain" } },
  { id: "fat-loss", label: { tr: "Yağ kaybı", en: "Fat loss" }, input: { sex: "female", age: 34, heightCm: 165, weightKg: 72, activity: "moderate", goal: "cut" } },
];
