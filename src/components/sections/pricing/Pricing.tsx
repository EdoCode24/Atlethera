import { Icon } from "@/components/ui/Icon";
import { Section, SectionIntro } from "@/components/ui/Section";
import { packages } from "@/content/pricing";
import { SIGNUP_PATH, sectionIds } from "@/content/site";
import { sports } from "@/domain/sports";
import { localeTags, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/tr";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/components/ui/Button";

export function Pricing({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const t = dict.pricing;

  return (
    <Section id={sectionIds.pricing} yard={20} toward="down" labelledBy="pricing-title" className="py-[var(--spacing-section)]">
      <div className="container-page">
        <SectionIntro id="pricing-title" title={t.title} body={t.body} />
        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {packages.map((pkg) => {
            const coach = pkg.id === "coach";
            const price =
              pkg.price.status === "set"
                ? new Intl.NumberFormat(localeTags[locale].intl, { style: "currency", currency: pkg.price.currency, maximumFractionDigits: 0 }).format(pkg.price.monthly)
                : null;
            return (
              <article
                key={pkg.id}
                className={cn(
                  "relative flex flex-col rounded-[var(--radius-panel)] p-7 sm:p-9",
                  coach ? "bg-night-800 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]" : "bg-night-900 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]",
                )}
              >
                <p className="text-[0.9rem] text-mist">{coach ? dict.common.coachPackage : dict.common.ptPackage}</p>
                <h3 className={cn("display mt-2 text-[clamp(3.5rem,2.5rem+3vw,5.5rem)] leading-[0.85]", coach && "text-volt")}>{pkg.name[locale]}</h3>
                <p className="mt-4 max-w-[30rem] text-[0.98rem] text-chalk-dim">{pkg.audience[locale]}</p>

                <div className="mt-7 border-y border-hairline py-5">
                  {price ? (
                    <p className="display tabular text-[2.6rem] leading-none">
                      {price}
                      <span className="ml-1 font-sans text-[0.9rem] font-medium normal-case text-mist">{t.perMonth}</span>
                    </p>
                  ) : (
                    <p className="text-[1.05rem] font-semibold text-chalk-dim">{t.tbd}</p>
                  )}
                </div>

                {pkg.sports && (
                  <div className="mt-6">
                    <p className="text-[0.82rem] text-mist">{t.chooseSport}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {pkg.sports.map((id) => (
                        <span key={id} className="rounded-md bg-chalk/8 px-3 py-1.5 text-[0.85rem] font-semibold">
                          {sports[id].name[locale]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <ul className="mt-6 space-y-2.5">
                  {pkg.features.map((f) => (
                    <li key={f.en} className="flex gap-2.5 text-[0.95rem]">
                      <Icon name="check" className={cn("mt-0.5 size-4.5 shrink-0", coach ? "text-volt" : "text-chalk-dim")} />
                      {f[locale]}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-9">
                  {SIGNUP_PATH ? (
                    <a href={`/${locale}${SIGNUP_PATH}?package=${pkg.id}`} className={buttonClass(coach ? "primary" : "ghost", "w-full")}>
                      {t.cta}
                    </a>
                  ) : (
                    <span aria-disabled="true" className={buttonClass("ghost", "w-full cursor-default text-mist hover:bg-transparent")}>
                      {t.ctaSoon}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
