import type { ReactNode } from "react";
import { AthleteCardMock, LineChartMock, MacroRingsMock, ProgramWeekMock, SessionLogMock, TestTableMock } from "@/components/mock/PtMocks";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section, SectionIntro } from "@/components/ui/Section";
import {
  bodyweightGoal,
  bodyweightSeries,
  programWeek,
  ptAthlete,
  ptTestResults,
  sampleNutrition,
  sessionLog,
  sprintSeries,
} from "@/content/sample-data";
import { sectionIds } from "@/content/site";
import { KCAL_PER_G } from "@/domain/nutrition/nutrition";
import { generalTests } from "@/domain/sports";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/tr";
import { fill } from "@/lib/fill";
import { formatMeasure, formatNumber, unitLabel } from "@/lib/format";
import { WorkflowTrack } from "./WorkflowTrack";

function Panel({ index, title, body, sample, children }: { index: number; title: string; body: string; sample: string; children: ReactNode }) {
  return (
    <article data-panel className="flex shrink-0 flex-col gap-5 rounded-[var(--radius-panel)] bg-night-850 p-6 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] lg:w-[min(27rem,34vw)] lg:self-center">
      <header className="flex items-start gap-4">
        <span className="display tabular text-[3.2rem] leading-[0.8] text-volt">{String(index).padStart(2, "0")}</span>
        <div>
          <h3 className="text-[1.2rem] font-semibold">{title}</h3>
          <p className="mt-1 text-[0.9rem] text-chalk-dim">{body}</p>
        </div>
      </header>
      {children}
      <SampleBadge label={sample} className="self-start" />
    </article>
  );
}

export function Workflow({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const t = dict.workflow;
  const l = t.labels;
  const n = sampleNutrition();
  const kcalP = n.proteinG * KCAL_PER_G.protein;
  const kcalC = n.carbG * KCAL_PER_G.carb;
  const kcalF = n.fatG * KCAL_PER_G.fat;
  const total = kcalP + kcalC + kcalF;
  const weeks = bodyweightSeries.map((_, i) => fill(l.weekShort, { n: i + 1 }));
  const kg = (v: number) => `${formatNumber(locale, v, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
  const sec = (v: number) => `${formatMeasure(locale, "s", v)} ${unitLabel(locale, "s")}`;

  const mocks: ReactNode[] = [
    <AthleteCardMock
      key="athlete"
      initials={ptAthlete.initials}
      name={ptAthlete.name}
      facts={[
        { label: l.age, value: String(ptAthlete.age) },
        { label: l.height, value: `${ptAthlete.heightCm}` },
        { label: l.weight, value: `${ptAthlete.weightKg}` },
      ]}
      goalsLabel={l.goals}
      goals={ptAthlete.goals.map((g) => g[locale])}
    />,
    <ProgramWeekMock key="program" label={l.week} days={programWeek.map((d, i) => ({ day: l.days[i], title: d.title[locale], kind: d.kind }))} />,
    <SessionLogMock
      key="session"
      title={l.sessionTitle}
      head={{ exercise: l.exercise, sets: l.sets, load: l.load, rpe: l.rpe }}
      rows={sessionLog.map((r, i) => ({ exercise: r.exercise, sets: r.sets, load: r.load[locale], rpe: r.rpe, done: i < 3 }))}
    />,
    <MacroRingsMock
      key="nutrition"
      label={l.dailyTarget}
      kcal={formatNumber(locale, n.kcal)}
      kcalUnit={dict.common.kcal}
      macros={[
        { key: "protein", label: dict.common.protein, grams: `${n.proteinG} g`, share: kcalP / total },
        { key: "carbs", label: dict.common.carbs, grams: `${n.carbG} g`, share: kcalC / total },
        { key: "fat", label: dict.common.fat, grams: `${n.fatG} g`, share: kcalF / total },
      ]}
      cta={l.openCalculator}
      href={`#${sectionIds.nutrition}`}
    />,
    <LineChartMock key="progress" label={l.bodyweight} values={bodyweightSeries} goal={bodyweightGoal} goalLabel={`${l.goal} ${kg(bodyweightGoal)}`} weekLabels={weeks} format={kg} />,
    <div key="performance" className="space-y-3">
      <TestTableMock
        head={{ test: l.test, latest: l.latest, target: l.target }}
        rows={ptTestResults.slice(0, 3).map((r) => {
          const test = generalTests[r.test];
          const unit = unitLabel(locale, test.unit);
          const ratio = test.better === "lower" ? r.goal / r.value : r.value / r.goal;
          return {
            name: test.name[locale],
            latest: `${formatMeasure(locale, test.unit, r.value)} ${unit}`,
            target: `${formatMeasure(locale, test.unit, r.goal)} ${unit}`,
            progress: Math.min(1, ratio),
          };
        })}
      />
      <LineChartMock label={l.trend} values={sprintSeries} weekLabels={weeks} format={sec} lowerIsBetter height={76} />
    </div>,
  ];

  return (
    <Section id={sectionIds.workflow} yard={50} toward={null} labelledBy="workflow-title">
      <WorkflowTrack
        intro={<SectionIntro id="workflow-title" badge={dict.common.ptPackage} title={t.title} body={t.body} />}
        panels={t.steps.map((step, i) => (
          <Panel key={step.title} index={i + 1} title={step.title} body={step.body} sample={dict.common.sample}>
            {mocks[i]}
          </Panel>
        ))}
      />
    </Section>
  );
}

