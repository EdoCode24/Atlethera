"use client";

import { useApp } from "@/components/app/AppContext";
import { PrintOnly } from "@/components/app/PrintOnly";
import { timeRange } from "@/components/calendar/ui";
import type { Playbook } from "@/domain/playbook/types";
import type { TeamEvent } from "@/domain/team/calendar";
import { periodClock, totalMinutes, type PracticePlan } from "@/domain/team/practice";
import { fill } from "@/lib/fill";
import { resolvePlay } from "./parts";

/** The practice script on paper: what runs when, for whom, and which plays. */
export function PracticePrint({ event, plan, team, date, books }: { event: TeamEvent; plan: PracticePlan; team: string; date: string; books: Playbook[] }) {
  const { t } = useApp();
  const p = t.practice;
  const clock = periodClock(event.start, plan.periods);
  return (
    <PrintOnly>
      <article className="mx-auto max-w-[48rem] p-[0.4in] font-sans text-[10.5pt] leading-snug text-black">
        <header className="flex items-end justify-between gap-6 border-b-2 border-black pb-2">
          <div>
            <p className="text-[9.5pt] font-semibold">{team}</p>
            <h1 className="mt-1 text-[18pt] font-bold leading-tight">{event.title}</h1>
          </div>
          <p className="text-right text-[10pt]">
            <span className="block font-semibold first-letter:uppercase">{date}</span>
            <span className="block">{[timeRange(event, t.calendar.allDay), event.location || null].filter(Boolean).join(", ")}</span>
          </p>
        </header>
        {plan.focus && (
          <p className="mt-3">
            <span className="font-semibold">{p.focus}: </span>
            {plan.focus}
          </p>
        )}
        <table className="mt-4 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-black text-[9pt]">
              <th className="w-8 py-1.5 pr-2">#</th>
              <th className="w-24 py-1.5 pr-2">{clock ? p.columns.time : p.columns.length}</th>
              <th className="w-44 py-1.5 pr-2">{p.columns.period}</th>
              <th className="py-1.5">{p.columns.drill}</th>
            </tr>
          </thead>
          <tbody>
            {plan.periods.map((period, i) => {
              const plays = period.plays.map((r) => resolvePlay(books, r)?.play.name).filter(Boolean);
              return (
                <tr key={period.id} className="break-inside-avoid border-b border-black/30 align-top">
                  <td className="py-2 pr-2 font-semibold">{i + 1}</td>
                  <td className="py-2 pr-2 tabular-nums">
                    {clock && <span className="block font-semibold">{`${clock[i].start}–${clock[i].end}`}</span>}
                    <span className="block">{fill(p.minutes, { n: period.minutes })}</span>
                  </td>
                  <td className="py-2 pr-2">
                    <span className="block font-semibold">{period.name}</span>
                    <span className="block text-[9pt]">{p.units[period.unit]}</span>
                  </td>
                  <td className="py-2">
                    {period.drill && <span className="block whitespace-pre-line">{period.drill}</span>}
                    {plays.length > 0 && (
                      <span className="mt-1 block text-[9.5pt]">
                        <span className="font-semibold">{p.period.plays}: </span>
                        {plays.join(", ")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-right font-semibold">{fill(p.total, { minutes: totalMinutes(plan.periods) })}</p>
        <section className="mt-6 break-inside-avoid">
          <h2 className="border-b border-black pb-1 text-[10pt] font-semibold">{p.notes}</h2>
          {plan.notes ? <p className="mt-2 whitespace-pre-line">{plan.notes}</p> : <div className="h-[1.6in]" />}
        </section>
      </article>
    </PrintOnly>
  );
}
