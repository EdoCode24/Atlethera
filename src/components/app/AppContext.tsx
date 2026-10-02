"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AppDictionary } from "@/i18n/app/tr";
import type { Locale } from "@/i18n/config";

interface AppContextValue {
  locale: Locale;
  t: AppDictionary;
}

const Ctx = createContext<AppContextValue | null>(null);

export function AppProvider({ locale, t, children }: AppContextValue & { children: ReactNode }) {
  return <Ctx value={{ locale, t }}>{children}</Ctx>;
}

export function useApp(): AppContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useApp must be used inside <AppProvider>");
  return value;
}

/**
 * The `next` page from the query, if it is a page of this site in this language (so a link can't
 * send the user elsewhere after signing in).
 */
export function safeNext(next: string | null, locale: Locale): string | null {
  if (!next || !next.startsWith(`/${locale}/`) || next.startsWith("//")) return null;
  return next;
}

/** Locale-prefixed path inside the app. */
export function useHref() {
  const { locale } = useApp();
  return (path: string) => `/${locale}${path}`;
}
