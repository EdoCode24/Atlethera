import { FLAG_OFFSET, type FieldPlayer } from "@/components/field/FieldSvg";
import { Section, SectionIntro } from "@/components/ui/Section";
import { sectionIds } from "@/content/site";
import { combineTests, sports, sportOrder, type SportId, type SportModule } from "@/domain/sports";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/tr";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/fill";
import { ModulesStage } from "./ModulesStage";

/** American football players who have a flag football counterpart, and who they become. */
const FLAG_COUNTERPART: Record<string, string> = {
  c: "c",
  qb: "qb",
  rb: "rb",
  x: "x",
  z: "z",
  de2: "rsh",
  mlb: "lb",
  cb1: "cb1",
  cb2: "cb2",
  fs: "s",
};

/** The position whose stat sheet each panel shows: the one that differs most between the sports. */
const FEATURED_POSITION: Record<SportId, string> = {
  "american-football": "wr",
  "flag-football": "rsh",
};

function buildPlayers(): FieldPlayer[] {
  const af = sports["american-football"].formation.players;
  const flag = sports["flag-football"].formation.players;
  return af.map((p) => {
    const target = flag.find((f) => f.id === FLAG_COUNTERPART[p.id]);
    return {
      id: p.id,
      side: p.side,
      x: p.x,
      y: p.y,
      label: p.label,
      labelAt: p.labelAt,
      minorLabel: p.minorLabel,
      flag: target && { x: target.x + FLAG_OFFSET.x, y: target.y + FLAG_OFFSET.y, label: target.label, labelAt: target.labelAt },
    };
  });
}

function Panel({ sport, locale, dict }: { sport: SportModule; locale: Locale; dict: Dictionary }) {
  const t = dict.modules;
  const featured = sport.positionGroups.find((g) => g.id === FEATURED_POSITION[sport.id])!;
  const stats = sport.statGroups.find((g) => g.id === featured.statGroups[0])!.stats;
  const sides = (["offense", "defense", "special"] as const).filter((side) => sport.positionGroups.some((g) => g.side === side));
  const size = sport.id === "american-football" ? "120 × 53⅓ yd" : "70 × 25 yd";

  return (
    <article
      data-panel={sport.id}
      aria-label={sport.name[locale]}
      className={cn(
        "col-start-1 row-start-1 flex flex-col gap-5 rounded-[var(--radius-panel)] bg-night-900 p-6 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]",
        sport.id === "flag-football" && "module-panel-flag",
      )}
    >
      <header className="flex items-baseline justify-between gap-4">
        <h3 lang="en" className="display text-[1.9rem] leading-none">
          {sport.name[locale]}
        </h3>
        <p className="tabular text-[0.82rem] whitespace-nowrap text-mist">
          {fill(t.perSide, { n: sport.playersPerSide })}, {size}
        </p>
      </header>

      <div>
        <p className="text-[0.78rem] font-medium text-mist">{t.positions}</p>
        <div className="mt-2 space-y-2">
          {sides.map((side) => (
            <div key={side} className="flex flex-wrap items-center gap-1.5">
              <span className="w-[5.5rem] shrink-0 text-[0.76rem] text-chalk-dim">{t.sides[side]}</span>
              {sport.positionGroups
                .filter((g) => g.side === side)
                .map((g) => (
                  <abbr
                    key={g.id}
                    title={g.name[locale]}
                    className={cn(
                      "rounded-[var(--radius-chip)] px-2 py-0.5 text-[0.74rem] font-semibold no-underline",
                      side === "offense" ? "bg-chalk/12 text-chalk" : "text-chalk-dim shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]",
                    )}
                  >
                    {g.abbr}
                  </abbr>
                ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[0.78rem] font-medium text-mist">
          {t.statSchema}, {fill(t.statFor, { position: featured.abbr })}
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {stats.map((stat) => (
            <li key={stat.key}>
              <abbr title={stat.label[locale]} className="tabular rounded-[var(--radius-chip)] bg-chalk/6 px-2 py-0.5 text-[0.74rem] font-semibold no-underline">
                {stat.abbr}
              </abbr>
            </li>
          ))}
        </ul>
      </div>

      {/* Pinned on short screens there is no room for everything; tests and rules drop out first. */}
      <div className="hidden max-lg:block [@media(min-height:760px)]:block">
        <p className="text-[0.78rem] font-medium text-mist">{t.tests}</p>
        <p className="mt-1.5 text-[0.84rem] leading-relaxed text-chalk-dim">{sport.combine.map((id) => combineTests[id].name[locale]).join(", ")}</p>
      </div>

      <div className="hidden max-lg:block [@media(min-height:880px)]:block">
        <p className="text-[0.78rem] font-medium text-mist">{t.rules}</p>
        <ul className="mt-1.5 space-y-1 text-[0.84rem] text-chalk-dim">
          {sport.rules.slice(2, 5).map((rule) => (
            <li key={rule.en} className="flex gap-2">
              <span aria-hidden="true" className="mt-[0.55em] size-1 shrink-0 rounded-full bg-volt" />
              {rule[locale]}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function Modules({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const t = dict.modules;
  const af = sports["american-football"];

  return (
    <Section id={sectionIds.modules} yard={30} toward="up" labelledBy="modules-title">
      <ModulesStage
        tabsLabel={t.tabsLabel}
        sports={sportOrder.map((id) => ({ id, name: sports[id].name[locale] }))}
        intro={<SectionIntro id="modules-title" badge={dict.common.coachPackage} title={t.title} body={t.body} />}
        field={{
          players: buildPlayers(),
          losX: af.formation.losX,
          labels: { afSize: "120 × 53⅓ yd", flagSize: "70 × 25 yd", los: t.los, noRun: t.noRun, rushLine: t.rushLine },
          groupLabels: [
            { x: 43.4, y: 21.7, text: "OL" },
            { x: 46.9, y: 20.3, text: "DL" },
          ],
          ariaLabel: fill(t.fieldAria, { sport: af.name[locale], formation: af.formation.name[locale] }),
        }}
        legend={
          <div className="mt-5 flex flex-col gap-3 text-[0.8rem] sm:flex-row sm:gap-8">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-mist">{t.coreTitle}</span>
              {t.coreItems.map((item) => (
                <span key={item} className="rounded-md px-2.5 py-0.5 text-chalk-dim shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]">
                  {item}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-mist">{t.moduleTitle}</span>
              {t.moduleItems.map((item) => (
                <span key={item} className="rounded-md bg-chalk/10 px-2.5 py-0.5 text-chalk">
                  {item}
                </span>
              ))}
            </div>
          </div>
        }
        panels={sportOrder.map((id) => (
          <Panel key={id} sport={sports[id]} locale={locale} dict={dict} />
        ))}
      />
    </Section>
  );
}
