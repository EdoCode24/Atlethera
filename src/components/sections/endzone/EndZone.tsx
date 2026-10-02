import { Wordmark } from "@/components/layout/Wordmark";
import { FieldTexture } from "@/components/ui/FieldTexture";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { sectionIds } from "@/content/site";
import { sports, sportOrder } from "@/domain/sports";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/tr";

function Choice({ href, icon, title, body, cta, tags }: { href: string; icon: IconName; title: string; body: string; cta: string; tags?: string[] }) {
  return (
    <a
      href={href}
      className="group flex flex-col rounded-[var(--radius-panel)] bg-night-800 p-6 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] transition-colors duration-300 hover:bg-night-700 sm:p-7"
    >
      <span className="grid size-11 place-items-center rounded-xl bg-chalk/8 text-volt">
        <Icon name={icon} className="size-5" />
      </span>
      <span className="mt-6 text-[1.35rem] leading-snug font-semibold">{title}</span>
      <span className="mt-2 text-[0.95rem] text-chalk-dim">{body}</span>
      {tags && (
        <span className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-md bg-chalk/8 px-2.5 py-1 text-[0.8rem] font-semibold">
              {tag}
            </span>
          ))}
        </span>
      )}
      <span className="mt-auto pt-8 text-[0.95rem] font-semibold text-volt underline decoration-volt/40 underline-offset-[6px] transition-colors group-hover:decoration-volt">
        {cta}
      </span>
    </a>
  );
}

/**
 * The last yards before the goal line: pick how you coach. Below the goal line the end
 * zone holds the footer.
 */
export function EndZone({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const other: Locale = locale === "tr" ? "en" : "tr";
  const f = dict.footer;
  const columns: { title: string; links: { label: string; href: string; lang?: string }[] }[] = [
    {
      title: f.columns.packages,
      links: [
        { label: dict.common.ptPackage, href: `#${sectionIds.workflow}` },
        { label: dict.common.coachPackage, href: `#${sectionIds.modules}` },
        { label: dict.nav.links.pricing, href: `#${sectionIds.pricing}` },
      ],
    },
    {
      title: f.columns.sports,
      links: sportOrder.map((id) => ({ label: sports[id].name[locale], href: `#${sectionIds.modules}`, lang: "en" })),
    },
    {
      title: f.columns.site,
      links: [
        { label: dict.nav.links.faq, href: `#${sectionIds.faq}` },
        { label: f.languageName, href: `/${other}`, lang: other },
        { label: f.backToTop, href: `#${sectionIds.top}` },
      ],
    },
  ];

  return (
    <section aria-labelledby="final-title" className="relative overflow-clip">
      <div className="relative">
        <div aria-hidden="true" className="endzone-approach pointer-events-none absolute inset-0">
          <FieldTexture />
        </div>
        <div className="container-page relative grid gap-12 pt-[var(--spacing-section)] pb-16 lg:grid-cols-12 lg:items-end lg:pb-24">
          <div className="lg:col-span-5">
            <Reveal as="h2" id="final-title" className="display text-display-xl">
              {dict.final.lines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </Reveal>
            <p className="mt-8 max-w-[30rem] text-lead text-chalk-dim">{dict.final.body}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
            <Choice href={`#${sectionIds.pricing}`} icon="athletes" {...dict.final.choices.pt} />
            <Choice href={`#${sectionIds.pricing}`} icon="team" {...dict.final.choices.coach} tags={sportOrder.map((id) => sports[id].name[locale])} />
          </div>
        </div>
      </div>

      <div className="endzone relative">
        <div aria-hidden="true" className="goal-line">
          <span className="pylon left-[var(--spacing-gutter)]" />
          <span className="pylon right-[var(--spacing-gutter)]" />
        </div>
        <footer className="container-page relative pt-16 pb-10">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <a href={`/${locale}`} aria-label={dict.nav.home} className="inline-block rounded-md">
                <Wordmark />
              </a>
              <p className="mt-4 max-w-[22rem] text-[0.95rem] text-chalk-dim">{f.tagline}</p>
            </div>
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title} className="lg:col-span-2">
                <p className="text-[0.85rem] font-semibold text-mist">{col.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} lang={link.lang} hrefLang={link.href.startsWith("/") ? link.lang : undefined} className="text-[0.95rem] text-chalk transition-colors hover:text-volt">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <p className="mt-16 border-t border-hairline pt-6 text-[0.85rem] text-mist">{f.rights}</p>
        </footer>
      </div>
    </section>
  );
}
