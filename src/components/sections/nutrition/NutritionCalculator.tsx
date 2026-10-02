"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ACTIVITY_FACTORS,
  ACTIVITY_LEVELS,
  GOAL_ADJUSTMENT,
  GOALS,
  KCAL_PER_G,
  LIMITS,
  PROTEIN_G_PER_KG,
  calculateNutrition,
  mifflinStJeor,
  type ActivityLevel,
  type Goal,
  type LimitedField,
  type NutritionInput,
  type NutritionTargets,
  type Sex,
} from "@/domain/nutrition/nutrition";
import type { Dictionary } from "@/i18n/dictionaries/tr";
import { localeTags, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/fill";
import { gsap, MQ } from "@/lib/gsap";
import { ringArcs } from "@/components/mock/PtMocks";

type Copy = Dictionary["nutrition"];

interface Preset {
  id: string;
  label: string;
  input: NutritionInput;
}

const colors = { protein: "var(--color-volt)", carbs: "var(--color-ice)", fat: "var(--color-amber)" };

/** Counts a number to its new value without re-rendering React on every frame. */
function useTweenedText(value: number, format: (n: number) => string) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia(MQ.motion).matches) {
      current.current = value;
      el.textContent = format(value);
      return;
    }
    const proxy = { v: current.current };
    const tween = gsap.to(proxy, {
      v: value,
      duration: 0.6,
      ease: "power3.out",
      onUpdate: () => {
        el.textContent = format(proxy.v);
      },
      onComplete: () => {
        current.current = value;
      },
    });
    return () => {
      tween.kill();
      current.current = proxy.v;
    };
  }, [value, format]);
  return ref;
}

function Tweened({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useTweenedText(value, format);
  return <span ref={ref}>{format(value)}</span>;
}

export function NutritionCalculator({ locale, copy, presets, labels }: { locale: Locale; copy: Copy; presets: Preset[]; labels: { kcal: string; protein: string; carbs: string; fat: string } }) {
  const [input, setInput] = useState<NutritionInput>(presets[0].input);
  const [lastValid, setLastValid] = useState<NutritionTargets>(() => calculateNutrition(presets[0].input) as NutritionTargets);
  const [draft, setDraft] = useState({ age: String(input.age), heightCm: String(input.heightCm), weightKg: String(input.weightKg) });
  const [preset, setPreset] = useState<string | null>(presets[0].id);
  const id = useId();

  const intl = localeTags[locale].intl;
  const whole = useMemo(() => new Intl.NumberFormat(intl, { maximumFractionDigits: 0 }), [intl]);
  const oneDecimal = useMemo(() => new Intl.NumberFormat(intl, { minimumFractionDigits: 0, maximumFractionDigits: 2 }), [intl]);
  const fmt = useMemo(() => (n: number) => whole.format(Math.round(n)), [whole]);

  const result = calculateNutrition(input);
  // While a field is being edited back into range, keep the last valid numbers on screen.
  const current = result.ok ? result : lastValid;
  const errors: LimitedField[] = result.ok ? [] : result.errors;

  const update = (next: NutritionInput, presetId: string | null = null) => {
    setInput(next);
    setPreset(presetId);
    const r = calculateNutrition(next);
    if (r.ok) setLastValid(r);
  };

  const setField = (field: "age" | "heightCm" | "weightKg", raw: string) => {
    setDraft((d) => ({ ...d, [field]: raw }));
    update({ ...input, [field]: raw.trim() === "" ? Number.NaN : Number(raw.replace(",", ".")) });
  };

  const choose = <K extends keyof NutritionInput>(key: K, value: NutritionInput[K]) => update({ ...input, [key]: value });

  const applyPreset = (p: Preset) => {
    setDraft({ age: String(p.input.age), heightCm: String(p.input.heightCm), weightKg: String(p.input.weightKg) });
    update(p.input, p.id);
  };

  const kcalP = current.proteinG * KCAL_PER_G.protein;
  const kcalC = current.carbG * KCAL_PER_G.carb;
  const kcalF = current.fatG * KCAL_PER_G.fat;
  const total = kcalP + kcalC + kcalF || 1;
  const segments = [
    { key: "protein" as const, label: labels.protein, grams: current.proteinG, share: kcalP / total },
    { key: "carbs" as const, label: labels.carbs, grams: current.carbG, share: kcalC / total },
    { key: "fat" as const, label: labels.fat, grams: current.fatG, share: kcalF / total },
  ];
  const arcs = ringArcs(segments.map((s) => s.share));

  const bmrValue = Number.isFinite(input.weightKg) && Number.isFinite(input.heightCm) && Number.isFinite(input.age) ? mifflinStJeor(input) : null;
  const sign = input.sex === "male" ? "+ 5" : "− 161";
  const factor = ACTIVITY_FACTORS[input.activity];
  const goalFactor = 1 + GOAL_ADJUSTMENT[input.goal];

  const fieldClass = "tabular h-12 w-full min-w-0 rounded-[0.7rem] bg-night-950/70 px-3.5 text-[1rem] font-semibold text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1.5px_var(--color-volt)]";
  const chip = (active: boolean) =>
    cn(
      "rounded-[0.6rem] px-3 py-2 text-[0.85rem] font-semibold transition-colors",
      active ? "bg-volt text-night-950" : "bg-chalk/5 text-chalk-dim shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] hover:text-chalk",
    );

  return (
    <form
      aria-label={copy.formLabel}
      onSubmit={(e) => e.preventDefault()}
      className="grid overflow-hidden rounded-[var(--radius-panel)] bg-night-900 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] lg:grid-cols-[1.1fr_1fr]"
    >
      <div className="min-w-0 space-y-6 p-5 sm:p-8">
        <fieldset>
          <legend className="text-[0.8rem] text-mist">{copy.presets}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => applyPreset(p)} className={chip(preset === p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-[0.8rem] text-mist">{copy.sex}</legend>
          <div className="mt-2 flex gap-2">
            {(["male", "female"] as Sex[]).map((s) => (
              <button key={s} type="button" aria-pressed={input.sex === s} onClick={() => choose("sex", s)} className={chip(input.sex === s)}>
                {copy.sexes[s]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {(
            [
              ["age", copy.age, copy.units.age],
              ["heightCm", copy.height, copy.units.heightCm],
              ["weightKg", copy.weight, copy.units.weightKg],
            ] as const
          ).map(([field, label, unit]) => (
            <label key={field} className="block min-w-0">
              <span className="text-[0.8rem] text-mist">{label}</span>
              <span className="relative mt-2 block">
                <input
                  inputMode="decimal"
                  aria-invalid={errors.includes(field) || undefined}
                  aria-describedby={errors.includes(field) ? `${id}-${field}` : undefined}
                  value={draft[field]}
                  min={LIMITS[field][0]}
                  max={LIMITS[field][1]}
                  onChange={(e) => setField(field, e.target.value)}
                  className={cn(fieldClass, errors.includes(field) && "shadow-[inset_0_0_0_1.5px_var(--color-signal)]")}
                />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[0.72rem] text-mist">{unit}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.length > 0 && (
          <ul className="space-y-1 text-[0.82rem] text-signal">
            {errors.map((field) => (
              <li key={field} id={`${id}-${field}`}>
                {copy.errors[field]}
              </li>
            ))}
          </ul>
        )}

        <label className="block">
          <span className="text-[0.8rem] text-mist">{copy.activity}</span>
          <select value={input.activity} onChange={(e) => choose("activity", e.target.value as ActivityLevel)} className={cn(fieldClass, "mt-2 appearance-none font-medium")}>
            {ACTIVITY_LEVELS.map((level) => (
              <option key={level} value={level} className="bg-night-900">
                {copy.activities[level]} (×{oneDecimal.format(ACTIVITY_FACTORS[level])})
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="text-[0.8rem] text-mist">{copy.goal}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(GOALS as Goal[]).map((g) => (
              <button key={g} type="button" aria-pressed={input.goal === g} onClick={() => choose("goal", g)} className={chip(input.goal === g)}>
                {copy.goals[g]}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex min-w-0 flex-col gap-6 bg-night-850 p-5 sm:p-8 lg:border-l lg:border-hairline">
        <div className="flex items-center gap-5 sm:gap-6">
          <div className="relative size-32 shrink-0 sm:size-40">
            <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="18" cy="18" r="15.9155" fill="none" stroke="rgb(242 244 237 / 0.08)" strokeWidth="3" />
              {segments.map((s, i) => (
                  <circle
                    key={s.key}
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    stroke={colors[s.key]}
                    strokeWidth="3"
                    strokeDasharray={arcs[i].dasharray}
                    strokeDashoffset={arcs[i].dashoffset}
                    className="transition-[stroke-dasharray,stroke-dashoffset] duration-700 ease-(--ease-out-expo)"
                  />
              ))}
            </svg>
            <p className="absolute inset-0 grid place-items-center text-center">
              <span>
                <span className="block text-[0.7rem] text-mist">{copy.results.target}</span>
                <span className="display tabular block text-[1.9rem] leading-none sm:text-[2.3rem]">
                  <Tweened value={current.kcal} format={fmt} />
                </span>
                <span className="text-[0.72rem] text-mist">{labels.kcal}</span>
              </span>
            </p>
          </div>
          <dl className="min-w-0 flex-1 space-y-3">
            {segments.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-[0.9rem] text-chalk-dim">
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: colors[s.key] }} />
                  {s.label}
                </dt>
                <dd className="display tabular text-[1.5rem] leading-none">
                  <Tweened value={s.grams} format={fmt} />
                  <span className="ml-0.5 font-sans text-[0.75rem] font-medium normal-case text-mist">g</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-night-950/60 p-3.5">
            <p className="text-[0.74rem] text-mist">{copy.results.bmr}</p>
            <p className="display tabular mt-1 text-[1.5rem] leading-none">
              <Tweened value={current.bmr} format={fmt} /> <span className="font-sans text-[0.72rem] font-medium normal-case text-mist">{labels.kcal}</span>
            </p>
          </div>
          <div className="rounded-xl bg-night-950/60 p-3.5">
            <p className="text-[0.74rem] text-mist">{copy.results.tdee}</p>
            <p className="display tabular mt-1 text-[1.5rem] leading-none">
              <Tweened value={current.tdee} format={fmt} /> <span className="font-sans text-[0.72rem] font-medium normal-case text-mist">{labels.kcal}</span>
            </p>
          </div>
        </div>

        <details className="group rounded-xl bg-night-950/60 p-3.5" open>
          <summary className="cursor-pointer list-none text-[0.8rem] font-semibold text-chalk-dim marker:hidden">{copy.steps}</summary>
          {bmrValue !== null && result.ok && (
            <ol className="tabular mt-3 space-y-1.5 text-[0.8rem] leading-relaxed text-chalk-dim">
              <li>
                {fill(copy.formula.bmr, {
                  w: oneDecimal.format(input.weightKg),
                  h: oneDecimal.format(input.heightCm),
                  a: oneDecimal.format(input.age),
                  s: sign,
                  bmr: fmt(bmrValue),
                })}
              </li>
              <li>{fill(copy.formula.tdee, { bmr: fmt(current.bmr), factor: oneDecimal.format(factor), tdee: fmt(current.tdee) })}</li>
              <li>{fill(copy.formula.target, { tdee: fmt(current.tdee), goal: oneDecimal.format(goalFactor), kcal: fmt(current.kcal) })}</li>
              <li>{fill(copy.formula.macros, { pkg: oneDecimal.format(PROTEIN_G_PER_KG[input.goal]) })}</li>
            </ol>
          )}
        </details>

        {current.youth && <p className="text-[0.82rem] text-amber">{copy.youth}</p>}
        {current.proteinCapped && <p className="text-[0.82rem] text-amber">{copy.capped}</p>}
        <p aria-live="polite" className="sr-only">
          {fill(copy.live, { kcal: fmt(current.kcal), p: current.proteinG, c: current.carbG, f: current.fatG })}
        </p>
        <p className="mt-auto text-[0.76rem] text-mist">{copy.disclaimer}</p>
      </div>
    </form>
  );
}
