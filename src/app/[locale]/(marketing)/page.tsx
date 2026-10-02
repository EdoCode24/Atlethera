import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { Coach } from "@/components/sections/coach/Coach";
import { Hero } from "@/components/sections/hero/Hero";
import { Marquee } from "@/components/sections/Marquee";
import { Modules } from "@/components/sections/modules/Modules";
import { Devices } from "@/components/sections/devices/Devices";
import { EndZone } from "@/components/sections/endzone/EndZone";
import { Faq } from "@/components/sections/Faq";
import { Nutrition } from "@/components/sections/nutrition/Nutrition";
import { Pricing } from "@/components/sections/pricing/Pricing";
import { Packages } from "@/components/sections/Packages";
import { Platform } from "@/components/sections/platform/Platform";
import { Workflow } from "@/components/sections/workflow/Workflow";
import { Section, SectionIntro } from "@/components/ui/Section";
import { programWeek, ptAthlete, sampleNutrition } from "@/content/sample-data";
import { SITE_URL, sectionIds } from "@/content/site";
import { KCAL_PER_G } from "@/domain/nutrition/nutrition";
import { formatNumber } from "@/lib/format";
import { combineTests, sports, sportOrder } from "@/domain/sports";
import { isLocale, localeTags, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

/**
 * Each section hydrates as its own unit. Nothing on this page suspends, so the server HTML
 * is complete; the boundaries only let React hydrate in pieces and yield to the browser
 * between them, which lets the first paint land before the whole page is interactive.
 */
function Hydrate({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages: { tr: "/tr", en: "/en", "x-default": "/tr" },
    },
    openGraph: {
      type: "website",
      siteName: "Atlethera",
      title: dict.meta.ogTitle,
      description: dict.meta.description,
      url: `/${locale}`,
      locale: localeTags[locale].og,
      alternateLocale: locales.filter((l) => l !== locale).map((l) => localeTags[l].og),
    },
    twitter: { card: "summary_large_image", title: dict.meta.ogTitle, description: dict.meta.description },
  };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  const nutrition = sampleNutrition();
  const marqueePositions = [
    ...new Set(sportOrder.flatMap((id) => sports[id].positionGroups.filter((g) => g.side !== "special").map((g) => (g.id === "rsh" ? "Rusher" : g.abbr)))),
  ].map((text) => ({ text, lang: "en" }));
  // A Turkish label identical to the English one is an English term: keep its uppercase dotless.
  const marqueeTerms = [
    ...Object.values(combineTests).map((t) => ({ text: t.name[locale], lang: t.name.tr === t.name.en ? "en" : undefined })),
    ...dict.marquee.terms.map((text) => ({ text, lang: locale === "tr" && text === "End zone" ? "en" : undefined })),
  ];

  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <script
        type="application/ld+json"
        // Only static, trusted values go in here.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Atlethera",
            url: `${SITE_URL}/${locale}`,
            logo: `${SITE_URL}/icon.png`,
            description: dict.meta.description,
          }),
        }}
      />
      <Hero locale={locale} dict={dict} />
      <Hydrate>
        <Marquee label={dict.marquee.label} pauseLabel={dict.marquee.pause} playLabel={dict.marquee.play} positions={marqueePositions} terms={marqueeTerms} />
      </Hydrate>
      <Hydrate>
        <Packages locale={locale} dict={dict} />
      </Hydrate>
      <Hydrate>
        <Section id={sectionIds.platform} yard={20} toward="up" labelledBy="platform-title">
          <Platform
            intro={<SectionIntro id="platform-title" title={dict.platform.title} body={dict.platform.body} />}
            tools={dict.platform.tools}
            counterFrom={dict.platform.counterFrom}
            counterTo={dict.platform.counterTo}
            resultTitle={dict.platform.resultTitle}
            resultLine={dict.platform.resultLine}
            resultBody={dict.platform.resultBody}
            faces={dict.platform.faces}
            preview={{
              week: programWeek.map((d) => d.kind),
              athlete: { initials: ptAthlete.initials, name: ptAthlete.name, line: `${ptAthlete.heightCm} cm, ${ptAthlete.weightKg} kg` },
              kcal: formatNumber(locale, nutrition.kcal),
              kcalUnit: dict.common.kcal,
              macroShares: [nutrition.proteinG * KCAL_PER_G.protein, nutrition.carbG * KCAL_PER_G.carb, nutrition.fatG * KCAL_PER_G.fat],
              clip: dict.coach.video.clip,
            }}
          />
        </Section>
      </Hydrate>
      <Hydrate>
        <Modules locale={locale} dict={dict} />
      </Hydrate>
      <Hydrate>
        <Coach dict={dict} />
      </Hydrate>
      <Hydrate>
        <Workflow locale={locale} dict={dict} />
      </Hydrate>
      <Hydrate>
        <Nutrition locale={locale} dict={dict} />
      </Hydrate>
      <Hydrate>
        <Devices locale={locale} dict={dict} />
      </Hydrate>
      <Hydrate>
        <Pricing locale={locale} dict={dict} />
      </Hydrate>
      <Hydrate>
        <Faq dict={dict} />
      </Hydrate>
      <Hydrate>
        <EndZone locale={locale} dict={dict} />
      </Hydrate>
    </main>
  );
}
