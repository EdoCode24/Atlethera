import type { CSSProperties } from "react";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { heroPlays } from "@/content/hero-plays";
import { sectionIds } from "@/content/site";
import { sports, sportOrder } from "@/domain/sports";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/tr";
import { HeroStage, type HeroSportView } from "./HeroStage";

function buildViews(locale: Locale, dict: Dictionary): HeroSportView[] {
  const plays = heroPlays();
  return sportOrder.map((id) => ({
    id,
    name: sports[id].name[locale],
    play: plays[id],
    playName: dict.hero.preview.playNames[id],
    note: dict.hero.preview.notes[id],
  }));
}
export function Hero({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const views = buildViews(locale, dict);

  return (
    <section id={sectionIds.top} aria-labelledby="hero-title" tabIndex={-1} className="outline-none">
      <HeroStage
        views={views}
        copy={{
          sportLabel: dict.hero.sportLabel,
          switchHint: dict.hero.switchHint,
          announce: dict.hero.announce,
          preview: {
            app: dict.hero.preview.app,
            section: dict.hero.preview.section,
            side: dict.hero.preview.side,
            category: dict.hero.preview.category,
            noteTitle: dict.hero.preview.noteTitle,
            tools: dict.hero.preview.tools,
            sample: dict.common.sample,
            label: dict.hero.preview.label,
          },
        }}
      >
        <h1 id="hero-title" className="display text-display-hero">
          {dict.hero.lines.map((line, i) => (
            <span key={line} className="hero-line">
              <span style={{ "--i": i } as CSSProperties}>{line}</span>
            </span>
          ))}
        </h1>
        <p className="hero-fade mt-7 max-w-[33rem] text-lead text-chalk-dim" style={{ "--d": "0.6s" } as CSSProperties}>
          {dict.hero.sub}
        </p>
        <div className="hero-fade mt-9 flex flex-wrap gap-3" style={{ "--d": "0.72s" } as CSSProperties}>
          <MagneticButton href={`#${sectionIds.pricing}`}>{dict.hero.primary}</MagneticButton>
          <MagneticButton href={`#${sectionIds.packages}`} variant="ghost">
            {dict.hero.secondary}
          </MagneticButton>
        </div>
      </HeroStage>
    </section>
  );
}
