/**
 * Deterministic calorie and macro targets. No AI, no network: the same input always
 * gives the same output, and every constant below is visible to the coach.
 *
 * Energy: Mifflin-St Jeor (1990) resting energy × activity factor × goal adjustment.
 * Protein: g/kg of body weight (ISSN position stand range for athletes), capped at 35 % of energy.
 * Fat: 25 % of energy (inside the 20–35 % AMDR). Carbohydrate: the remaining energy.
 */

export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "high" | "athlete";
export type Goal = "cut" | "maintain" | "gain";

export interface NutritionInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
}

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  athlete: 1.9,
};

export const ACTIVITY_LEVELS = Object.keys(ACTIVITY_FACTORS) as ActivityLevel[];

export const GOAL_ADJUSTMENT: Record<Goal, number> = {
  cut: -0.15,
  maintain: 0,
  gain: 0.1,
};

export const GOALS = Object.keys(GOAL_ADJUSTMENT) as Goal[];

export const PROTEIN_G_PER_KG: Record<Goal, number> = {
  cut: 2.2,
  maintain: 1.8,
  gain: 2.0,
};

export const FAT_SHARE = 0.25;
export const PROTEIN_MAX_SHARE = 0.35;

export const KCAL_PER_G = { protein: 4, fat: 9, carb: 4 } as const;

export const LIMITS = {
  age: [15, 80],
  heightCm: [130, 220],
  weightKg: [35, 200],
} as const satisfies Record<string, readonly [number, number]>;

export type LimitedField = keyof typeof LIMITS;

export const ADULT_AGE = 18;

export interface NutritionTargets {
  ok: true;
  /** Resting energy, unrounded. */
  bmr: number;
  /** Total daily energy expenditure, unrounded. */
  tdee: number;
  /** Target intake, rounded to 10 kcal. */
  kcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  /** Protein was limited to 35 % of energy. */
  proteinCapped: boolean;
  /** Under 18: show the "work with a professional" note. */
  youth: boolean;
}

export interface NutritionError {
  ok: false;
  errors: LimitedField[];
}

export type NutritionResult = NutritionTargets | NutritionError;

export function validate(input: NutritionInput): LimitedField[] {
  return (Object.keys(LIMITS) as LimitedField[]).filter((field) => {
    const value = input[field];
    const [min, max] = LIMITS[field];
    return !Number.isFinite(value) || value < min || value > max;
  });
}

/** Mifflin-St Jeor resting energy expenditure in kcal/day. */
export function mifflinStJeor({ sex, age, heightCm, weightKg }: Pick<NutritionInput, "sex" | "age" | "heightCm" | "weightKg">): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

export function calculateNutrition(input: NutritionInput): NutritionResult {
  const errors = validate(input);
  if (errors.length > 0) return { ok: false, errors };

  const bmr = mifflinStJeor(input);
  const tdee = bmr * ACTIVITY_FACTORS[input.activity];
  const kcal = Math.round((tdee * (1 + GOAL_ADJUSTMENT[input.goal])) / 10) * 10;

  const proteinByWeight = Math.round(PROTEIN_G_PER_KG[input.goal] * input.weightKg);
  const proteinCeiling = Math.floor((kcal * PROTEIN_MAX_SHARE) / KCAL_PER_G.protein);
  const proteinG = Math.min(proteinByWeight, proteinCeiling);
  const fatG = Math.round((kcal * FAT_SHARE) / KCAL_PER_G.fat);
  const carbG = Math.max(
    0,
    Math.round((kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat) / KCAL_PER_G.carb),
  );

  return {
    ok: true,
    bmr,
    tdee,
    kcal,
    proteinG,
    fatG,
    carbG,
    proteinCapped: proteinG < proteinByWeight,
    youth: input.age < ADULT_AGE,
  };
}
