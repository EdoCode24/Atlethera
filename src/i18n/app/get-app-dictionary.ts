import "server-only";
import type { Locale } from "../config";
import type { AppDictionary } from "./tr";

const loaders: Record<Locale, () => Promise<AppDictionary>> = {
  tr: () => import("./tr").then((m) => m.appTr),
  en: () => import("./en").then((m) => m.appEn),
};

export function getAppDictionary(locale: Locale): Promise<AppDictionary> {
  return loaders[locale]();
}
