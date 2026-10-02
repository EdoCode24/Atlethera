import { Icon, type IconName } from "@/components/ui/Icon";
import { Section, SectionIntro } from "@/components/ui/Section";
import { sectionIds } from "@/content/site";
import type { Dictionary } from "@/i18n/dictionaries/tr";
import { CoachChain } from "./CoachChain";

const featureIcons: IconName[] = ["team", "program", "video", "playbook", "meeting", "stats"];

export function Coach({ dict }: { dict: Dictionary }) {
  const t = dict.coach;
  return (
    <Section id={sectionIds.coach} yard={40} toward="up" labelledBy="coach-title" className="py-[var(--spacing-section)]">
      <div className="container-page">
        <SectionIntro id="coach-title" badge={dict.common.coachPackage} title={t.title} body={t.body} className="max-w-[50rem]" />
        <div className="mt-14">
          <CoachChain copy={t} sample={dict.common.sample} />
        </div>
        <ul className="mt-20 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.map((feature, i) => (
            <li key={feature.title} className="border-t border-hairline-strong pt-5">
              <Icon name={featureIcons[i]} className="size-5 text-volt" />
              <h3 className="mt-4 text-[1.1rem] font-semibold">{feature.title}</h3>
              <p className="mt-2 max-w-[30rem] text-[0.95rem] text-chalk-dim">{feature.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
