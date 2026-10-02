import { localeTags, type Locale } from "@/i18n/config";
import type { TestUnit as CombineUnit } from "@/domain/sports/combine";

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeTags[locale].intl, options).format(value);
}

const unitLabels: Record<Locale, Record<CombineUnit, string>> = {
  tr: { s: "sn", cm: "cm", reps: "tekrar", kg: "kg" },
  en: { s: "s", cm: "cm", reps: "reps", kg: "kg" },
};

export function unitLabel(locale: Locale, unit: CombineUnit): string {
  return unitLabels[locale][unit];
}

/** Digits for a combine result: seconds keep two decimals, everything else is whole. */
export function formatMeasure(locale: Locale, unit: CombineUnit, value: number): string {
  const digits = unit === "s" ? 2 : 0;
  return formatNumber(locale, value, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatDelta(locale: Locale, unit: CombineUnit, delta: number): string {
  return formatMeasure(locale, unit, Math.abs(delta));
}
