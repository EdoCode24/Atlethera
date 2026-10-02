import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content/site";
import { locales } from "@/i18n/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}`]));
  return locales.map((locale) => ({
    url: `${SITE_URL}/${locale}`,
    changeFrequency: "monthly",
    priority: locale === "tr" ? 1 : 0.9,
    alternates: { languages },
  }));
}
