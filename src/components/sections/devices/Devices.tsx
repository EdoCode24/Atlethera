import { LogoMark } from "@/components/layout/Wordmark";
import { Icon } from "@/components/ui/Icon";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section, SectionIntro } from "@/components/ui/Section";
import { programWeek, sidelineTimes } from "@/content/sample-data";
import { sectionIds } from "@/content/site";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/tr";
import { cn } from "@/lib/cn";
import { formatMeasure, unitLabel } from "@/lib/format";
import { DevicesMotion } from "./DevicesMotion";

const kindStyle: Record<string, string> = {
  strength: "bg-volt text-night-950",
  speed: "bg-ice/85 text-night-950",
  conditioning: "bg-amber/85 text-night-950",
  recovery: "bg-chalk/12 text-chalk-dim",
  rest: "text-mist shadow-[inset_0_0_0_1px_var(--color-hairline)]",
};

export function Devices({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const t = dict.devices;
  const s = unitLabel(locale, "s");

  const laptop = (
    <div data-device="laptop" className="w-full">
      <div className="rounded-t-[1.1rem] bg-night-700 p-2 pb-0 shadow-[0_0_0_1px_var(--color-hairline-strong)]">
        <div className="flex aspect-[16/10] flex-col overflow-hidden rounded-t-[0.7rem] bg-night-900 p-4">
          <p className="text-[0.7rem] font-semibold text-chalk-dim">{t.laptop.title}</p>
          <ol className="mt-3 grid flex-1 grid-cols-7 gap-1">
            {programWeek.map((d, i) => (
              <li key={i} className="flex flex-col gap-1">
                <span className="text-center text-[0.55rem] text-mist">{dict.workflow.labels.days[i]}</span>
                <span className={cn("flex-1 rounded-md p-1.5 text-[0.55rem] leading-tight font-semibold", kindStyle[d.kind])}>{d.title[locale]}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="mx-auto h-3 w-[112%] -translate-x-[5.4%] rounded-b-[1rem] bg-night-600 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.9)]" />
    </div>
  );

  const tablet = (
    <div data-device="tablet" className="w-full rounded-[1.6rem] bg-night-700 p-2.5 shadow-[0_0_0_1px_var(--color-hairline-strong),0_50px_100px_-30px_rgb(0_0_0/0.95)]">
      <div className="aspect-[4/3] overflow-hidden rounded-[1.1rem] bg-night-900 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[0.66rem] text-mist">{t.tablet.context}</p>
            <p className="text-[0.95rem] font-semibold">{t.tablet.title}</p>
          </div>
          <div className="text-right">
            <p className="text-[0.62rem] text-mist">{t.tablet.timer}</p>
            <p className="display tabular text-[2.1rem] leading-none text-volt">
              {formatMeasure(locale, "s", 4.62)}
              <span className="ml-1 font-sans text-[0.7rem] font-medium normal-case text-mist">{s}</span>
            </p>
          </div>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {sidelineTimes.map((row) => (
            <li
              key={row.athlete}
              className={cn(
                "flex min-h-14 items-center justify-between gap-2 rounded-xl px-3 py-2 text-[0.74rem]",
                row.time === null ? "bg-night-700 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]" : "bg-night-800",
              )}
            >
              <span>
                <span className="block font-semibold">{row.athlete}</span>
                <span className="text-[0.64rem] text-mist">{row.position}</span>
              </span>
              <span className="tabular font-semibold">{row.time === null ? t.tablet.waiting : `${formatMeasure(locale, "s", row.time)} ${s}`}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <span className="grid h-11 place-items-center rounded-xl bg-chalk/8 text-[0.8rem] font-semibold">
            <Icon name="timer" className="size-5" />
          </span>
          <span className="grid h-11 place-items-center rounded-xl bg-volt text-[0.8rem] font-semibold text-night-950">{t.tablet.save}</span>
        </div>
      </div>
    </div>
  );

  const phone = (
    <div data-device="phone" className="w-full rounded-[2rem] bg-night-700 p-2 shadow-[0_0_0_1px_var(--color-hairline-strong),0_40px_80px_-24px_rgb(0_0_0/0.95)]">
      <div className="relative aspect-[9/19] overflow-hidden rounded-[1.6rem] bg-night-900">
        <span className="absolute top-2 left-1/2 h-4 w-14 -translate-x-1/2 rounded-full bg-night-950" />
        <div className="px-3 pt-9">
          <p className="text-[0.62rem] text-mist">{t.phone.today}</p>
          <ul className="mt-2 space-y-1.5">
            {programWeek.slice(0, 3).map((d, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg bg-night-800 px-2 py-1.5 text-[0.58rem]">
                <span className={cn("size-1.5 rounded-full", i === 0 ? "bg-volt" : "bg-chalk/30")} />
                <span className="truncate font-semibold">{d.title[locale]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="absolute inset-x-0 bottom-0 rounded-t-[1.2rem] bg-night-800 p-3.5 shadow-[0_-1px_0_var(--color-hairline-strong)]">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-night-950 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]">
              <LogoMark className="size-6" />
            </span>
            <div>
              <p className="text-[0.72rem] font-semibold">{t.phone.title}</p>
              <p className="text-[0.6rem] leading-snug text-mist">{t.phone.body}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5 text-[0.66rem] font-semibold">
            <span className="grid h-8 place-items-center rounded-lg bg-chalk/8 text-chalk-dim">{t.phone.cancel}</span>
            <span className="grid h-8 place-items-center rounded-lg bg-volt text-night-950">{t.phone.add}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Section id={sectionIds.devices} yard={30} toward="down" labelledBy="devices-title" className="overflow-x-clip py-[var(--spacing-section)]">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <SectionIntro id="devices-title" title={t.title} body={t.body} className="lg:col-span-6" />
          <ul className="grid gap-5 sm:grid-cols-3 lg:col-span-6">
            {t.points.map((p) => (
              <li key={p.title} className="border-t border-hairline-strong pt-4">
                <h3 className="font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-[0.88rem] text-chalk-dim">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <DevicesMotion laptop={laptop} tablet={tablet} phone={phone} />
        <SampleBadge label={dict.common.sample} className="mt-6" />
      </div>
    </Section>
  );
}
