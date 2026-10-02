export const locales = ["tr", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "tr";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "tr" || value === "en";
}

/** BCP 47 tags used by Intl and Open Graph. */
export const localeTags: Record<Locale, { intl: string; og: string }> = {
  tr: { intl: "tr-TR", og: "tr_TR" },
  en: { intl: "en-US", og: "en_US" },
};
