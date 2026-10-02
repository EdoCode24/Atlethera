import { Section, SectionIntro } from "@/components/ui/Section";
import { sectionIds } from "@/content/site";
import type { Dictionary } from "@/i18n/dictionaries/tr";

export function Faq({ dict }: { dict: Dictionary }) {
  return (
    <Section id={sectionIds.faq} yard={10} toward="down" labelledBy="faq-title" className="py-[var(--spacing-section)]">
      <div className="container-page grid gap-12 lg:grid-cols-12">
        <SectionIntro id="faq-title" title={dict.faq.title} className="lg:col-span-4" />
        <div className="lg:col-span-8">
          {dict.faq.items.map((item) => (
            <details key={item.q} name="faq" className="faq-item group border-b border-hairline-strong">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-[1.1rem] font-semibold marker:hidden sm:text-[1.2rem]">
                {item.q}
                <span aria-hidden="true" className="relative grid size-8 shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] transition-colors group-open:bg-volt group-open:text-night-950">
                  <span className="absolute h-[1.5px] w-3 bg-current" />
                  <span className="absolute h-3 w-[1.5px] bg-current transition-transform duration-300 group-open:scale-y-0" />
                </span>
              </summary>
              <p className="max-w-[42rem] pb-6 text-[1rem] leading-relaxed text-chalk-dim">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
