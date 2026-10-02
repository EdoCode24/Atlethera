import { Section, SectionIntro } from "@/components/ui/Section";
import { calculatorPresets } from "@/content/sample-data";
import { sectionIds } from "@/content/site";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/tr";
import { NutritionCalculator } from "./NutritionCalculator";

export function Nutrition({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <Section id={sectionIds.nutrition} yard={40} toward="down" labelledBy="nutrition-title" className="py-[var(--spacing-section)]">
      <div className="container-page">
        <SectionIntro id="nutrition-title" badge={dict.common.ptPackage} title={dict.nutrition.title} body={dict.nutrition.body} />
        <div className="mt-14">
          <NutritionCalculator
            locale={locale}
            copy={dict.nutrition}
            presets={calculatorPresets.map((p) => ({ id: p.id, label: p.label[locale], input: p.input }))}
            labels={{ kcal: dict.common.kcal, protein: dict.common.protein, carbs: dict.common.carbs, fat: dict.common.fat }}
          />
        </div>
      </div>
    </Section>
  );
}
