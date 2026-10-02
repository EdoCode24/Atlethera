import { FlowTrack } from "@/components/ui/FlowTrack";
import { Section, SectionIntro } from "@/components/ui/Section";
import { sectionIds } from "@/content/site";
import { sports, sportOrder } from "@/domain/sports";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/tr";

export function Packages({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { pt, coach } = dict.packages;

  return (
    <Section id={sectionIds.packages} yard={10} toward="up" labelledBy="packages-title" className="py-[var(--spacing-section)]">
      <div className="container-page">
        <SectionIntro id="packages-title" title={dict.packages.title} body={dict.packages.body} />

        <div className="mt-16 grid gap-5 lg:grid-cols-[1fr_1.25fr]">
          <article className="relative flex flex-col overflow-hidden rounded-[var(--radius-panel)] bg-night-900 p-7 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] sm:p-9">
            <p className="text-[0.9rem] text-mist">{pt.audience}</p>
            <h3 className="display mt-2 text-[clamp(4.5rem,3rem+5vw,8rem)] leading-[0.85]">{pt.name}</h3>
            <FlowTrack steps={pt.flow} className="mt-8" />
            <p className="mt-8 max-w-[26rem] text-[0.95rem] text-chalk-dim">{pt.note}</p>
            <a
              href={`#${sectionIds.workflow}`}
              className="mt-auto inline-flex items-center gap-2 self-start pt-10 text-[0.95rem] font-semibold text-chalk underline decoration-hairline-strong underline-offset-[6px] transition-colors hover:decoration-chalk"
            >
              {pt.cta}
            </a>
          </article>

          <article className="relative flex flex-col overflow-hidden rounded-[var(--radius-panel)] bg-night-800 p-7 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] sm:p-9">
            <p className="relative text-[0.9rem] text-mist">{coach.audience}</p>
            <h3 className="display relative mt-2 text-[clamp(4.5rem,3rem+5vw,8rem)] leading-[0.85] text-volt">{coach.name}</h3>
            <FlowTrack steps={coach.flow} tone="volt" className="relative mt-8" />
            <div className="relative mt-8 flex flex-wrap items-center gap-2.5">
              <p className="mr-1 text-[0.95rem] text-chalk-dim">{coach.note}</p>
              {sportOrder.map((id) => (
                <span key={id} className="rounded-md bg-chalk/8 px-3 py-1.5 text-[0.85rem] font-semibold">
                  {sports[id].name[locale]}
                </span>
              ))}
            </div>
            <a
              href={`#${sectionIds.modules}`}
              className="relative mt-auto inline-flex items-center gap-2 self-start pt-10 text-[0.95rem] font-semibold text-volt underline decoration-volt/40 underline-offset-[6px] transition-colors hover:decoration-volt"
            >
              {coach.cta}
            </a>
          </article>
        </div>
      </div>
    </Section>
  );
}
