"use client";

import { useApp } from "@/components/app/AppContext";
import { PrintOnly } from "@/components/app/PrintOnly";
import { timeRange } from "@/components/calendar/ui";
import { resolvePlay } from "@/components/practice/parts";
import type { Playbook } from "@/domain/playbook/types";
import type { TeamEvent } from "@/domain/team/calendar";
import type { Meeting } from "@/domain/team/meeting";
import { periodClock, totalMinutes } from "@/domain/team/practice";
import { fill } from "@/lib/fill";

/** The meeting agenda on paper, with room for notes. */
export function MeetingPrint({ event, meeting, team, date, books, audience }: { event: TeamEvent; meeting: Meeting; team: string; date: string; books: Playbook[]; audience: string }) {
  const { t } = useApp();
  const m = t.meetings;
  const p = t.practice;
  const clock = periodClock(event.start, meeting.agenda);
  return (
    <PrintOnly>
      <article className="mx-auto max-w-[48rem] p-[0.4in] font-sans text-[10.5pt] leading-snug text-black">
        <header className="flex items-end justify-between gap-6 border-b-2 border-black pb-2">
          <div>
            <p className="text-[9.5pt] font-semibold">{team}</p>
            <h1 className="mt-1 text-[18pt] font-bold leading-tight">{event.title}</h1>
            <p className="mt-0.5 text-[10pt]">{audience}</p>
          </div>
          <p className="text-right text-[10pt]">
            <span className="block font-semibold first-letter:uppercase">{date}</span>
            <span className="block">{[timeRange(event, t.calendar.allDay), event.location || null].filter(Boolean).join(", ")}</span>
          </p>
        </header>
        <ol className="mt-4">
          {meeting.agenda.map((item, i) => {
            const plays = item.plays.map((r) => resolvePlay(books, r)?.play.name).filter(Boolean);
            return (
              <li key={item.id} className="break-inside-avoid border-b border-black/30 py-2.5">
                <p className="flex items-baseline gap-3">
                  <span className="w-6 font-semibold">{i + 1}</span>
                  <span className="flex-1 font-semibold">{item.title}</span>
                  <span className="tabular-nums">{clock ? `${clock[i].start}–${clock[i].end}` : fill(p.minutes, { n: item.minutes })}</span>
                </p>
                {item.notes && <p className="mt-1 ml-9 whitespace-pre-line">{item.notes}</p>}
                {plays.length > 0 && (
                  <p className="mt-1 ml-9 text-[9.5pt]">
                    <span className="font-semibold">{p.period.plays}: </span>
                    {plays.join(", ")}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-right font-semibold">{fill(p.total, { minutes: totalMinutes(meeting.agenda) })}</p>
        <section className="mt-6 break-inside-avoid">
          <h2 className="border-b border-black pb-1 text-[10pt] font-semibold">{m.notes}</h2>
          {meeting.notes ? <p className="mt-2 whitespace-pre-line">{meeting.notes}</p> : <div className="h-[2in]" />}
        </section>
      </article>
    </PrintOnly>
  );
}
