import { describe, expect, it } from "vitest";
import {
  ACTIVITY_LEVELS,
  GOALS,
  KCAL_PER_G,
  calculateNutrition,
  mifflinStJeor,
  type NutritionInput,
  type NutritionTargets,
} from "./nutrition";

const wr: NutritionInput = { sex: "male", age: 22, heightCm: 183, weightKg: 84, activity: "high", goal: "maintain" };

function ok(input: NutritionInput): NutritionTargets {
  const result = calculateNutrition(input);
  if (!result.ok) throw new Error(`expected targets, got errors: ${result.errors.join(", ")}`);
  return result;
}

describe("mifflinStJeor", () => {
  it("matches the published equation for men and women", () => {
    expect(mifflinStJeor(wr)).toBeCloseTo(1878.75, 2);
    expect(mifflinStJeor({ sex: "female", age: 30, heightCm: 165, weightKg: 60 })).toBeCloseTo(1320.25, 2);
  });
});

describe("calculateNutrition", () => {
  it("male WR, high activity, maintain", () => {
    const r = ok(wr);
    expect(r.tdee).toBeCloseTo(3240.84, 2);
    expect(r).toMatchObject({ kcal: 3240, proteinG: 151, fatG: 90, carbG: 457, proteinCapped: false, youth: false });
  });

  it("female athlete, moderate activity, cut", () => {
    const r = ok({ sex: "female", age: 30, heightCm: 165, weightKg: 60, activity: "moderate", goal: "cut" });
    expect(r).toMatchObject({ kcal: 1740, proteinG: 132, fatG: 48, carbG: 195 });
  });

  it("caps protein at 35 % of energy for very heavy, inactive inputs", () => {
    const r = ok({ sex: "female", age: 80, heightCm: 130, weightKg: 200, activity: "sedentary", goal: "cut" });
    expect(r.proteinCapped).toBe(true);
    expect(r.proteinG * KCAL_PER_G.protein).toBeLessThanOrEqual(r.kcal * 0.35);
    expect(r.carbG).toBeGreaterThan(0);
  });

  it("flags under-18 inputs", () => {
    expect(ok({ ...wr, age: 16 }).youth).toBe(true);
  });

  it("rejects out-of-range and non-numeric input", () => {
    expect(calculateNutrition({ ...wr, age: 14 })).toEqual({ ok: false, errors: ["age"] });
    expect(calculateNutrition({ ...wr, heightCm: 221, weightKg: 34 })).toEqual({ ok: false, errors: ["heightCm", "weightKg"] });
    expect(calculateNutrition({ ...wr, weightKg: Number.NaN })).toEqual({ ok: false, errors: ["weightKg"] });
    expect(calculateNutrition({ ...wr, age: 15, heightCm: 130, weightKg: 35 }).ok).toBe(true);
    expect(calculateNutrition({ ...wr, age: 80, heightCm: 220, weightKg: 200 }).ok).toBe(true);
  });

  it("balances energy within 2 kcal and never goes below resting energy, across the whole input grid", () => {
    for (const sex of ["male", "female"] as const)
      for (const age of [15, 18, 30, 55, 80])
        for (const heightCm of [130, 160, 185, 220])
          for (const weightKg of [35, 60, 90, 140, 200])
            for (const activity of ACTIVITY_LEVELS)
              for (const goal of GOALS) {
                const r = ok({ sex, age, heightCm, weightKg, activity, goal });
                const energy = r.proteinG * 4 + r.fatG * 9 + r.carbG * 4;
                expect(Math.abs(energy - r.kcal)).toBeLessThanOrEqual(2);
                expect(r.carbG).toBeGreaterThanOrEqual(0);
                expect(r.kcal).toBeGreaterThanOrEqual(r.bmr - 5);
              }
  });

  it("rises with weight and activity", () => {
    expect(ok({ ...wr, weightKg: 90 }).kcal).toBeGreaterThan(ok(wr).kcal);
    expect(ok({ ...wr, activity: "athlete" }).kcal).toBeGreaterThan(ok(wr).kcal);
    expect(ok({ ...wr, goal: "gain" }).kcal).toBeGreaterThan(ok(wr).kcal);
    expect(ok({ ...wr, goal: "cut" }).kcal).toBeLessThan(ok(wr).kcal);
  });
});
