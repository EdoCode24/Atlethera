import { localeTags, type Locale } from "@/i18n/config";
import { fill } from "./fill";

export type PluralForms = { one: string; other: string };

/** The plural form for `n` in the locale ("1 play", "2 plays"), with `{n}` and any other values filled in. */
export function plural(locale: Locale, forms: PluralForms, n: number, values: Record<string, string | number> = {}): string {
  return fill(new Intl.PluralRules(localeTags[locale].intl).select(n) === "one" ? forms.one : forms.other, { n, ...values });
}
