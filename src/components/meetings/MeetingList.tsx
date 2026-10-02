"use client";

import { useApp } from "@/components/app/AppContext";
import { KindEventList } from "@/components/calendar/KindEventList";
import { useTeam } from "@/components/team/hooks";
import { useLiveMeetings } from "@/data/live";
import { useMeetings } from "@/data/meetings";
import { meetingGroups } from "@/domain/team/meeting";
import { positionGroups } from "@/domain/team/roster";
import { totalMinutes } from "@/domain/team/practice";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";

export function MeetingList() {
  const { t, locale } = useApp();
  const { workspace, sport } = useTeam();
  const meetings = useMeetings(workspace?.id);
  const { live } = useLiveMeetings(workspace?.id);
  const m = t.meetings;

  return (
    <KindEventList
      kind="meeting"
      path="/panel/meetings"
      title={m.title}
      body={m.body}
      addLabel={m.add}
      empty={m.empty}
      icon="meeting"
      summary={(e) => {
        const meeting = meetings[e.id];
        const groups = meeting && sport ? meetingGroups(meeting.groups, sport) : [];
        const agenda = meeting?.agenda ?? [];
        const audience = groups.length && sport ? positionGroups(sport).filter((g) => groups.includes(g.id)).map((g) => g.abbr).join(", ") : m.wholeTeam;
        return (
          <>
            {live[e.id] && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-signal/15 px-2 py-0.5 text-[0.78rem] font-bold text-signal">
                <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-signal" />
                {t.live.badge}
              </span>
            )}
            <span className="text-[0.9rem] text-chalk-dim">{audience}</span>
            <span className={cn("text-[0.9rem]", agenda.length ? "text-chalk-dim" : "text-mist")}>
              {agenda.length ? plural(locale, m.agendaSummary, agenda.length, { minutes: totalMinutes(agenda) }) : m.noAgenda}
            </span>
          </>
        );
      }}
    />
  );
}
