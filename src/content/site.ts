/** Public URL, used for canonical links, sitemap and Open Graph. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Where "choose a package" goes, relative to the locale. Null would turn the buttons back
 * into "opening soon". Checkout is not part of sign-up yet: prices are still to be set.
 */
export const SIGNUP_PATH: string | null = "/signup";

export const sectionIds = {
  top: "top",
  packages: "packages",
  platform: "platform",
  modules: "modules",
  coach: "coach",
  workflow: "workflow",
  nutrition: "nutrition",
  devices: "devices",
  pricing: "pricing",
  faq: "faq",
} as const;

export type SectionId = (typeof sectionIds)[keyof typeof sectionIds];

/** Sections listed in the header, in page order. */
export const navSections = ["packages", "modules", "workflow", "pricing", "faq"] as const satisfies readonly SectionId[];
