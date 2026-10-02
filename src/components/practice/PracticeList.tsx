"use client";

import { useApp } from "@/components/app/AppContext";
import { KindEventList } from "@/components/calendar/KindEventList";
import { useTeam } from "@/components/team/hooks";
import { usePlans } from "@/data/practice";
import { attendanceCounts, totalMinutes } from "@/domain/team/practice";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";

export function PracticeList() {
  const { t, locale } = useApp();
  const { workspace, roster } = useTeam();
  const plans = usePlans(workspace?.id);
  const p = t.practice;
  const counted = roster.players.filter((pl) => pl.status !== "inactive").map((pl) => pl.id);

  return (
    <KindEventList
      kind="practice"
      path="/panel/practice"
      title={p.title}
      body={p.body}
      addLabel={p.add}
      empty={p.empty}
      icon="training"
      summary={(e) => {
        const plan = plans[e.id];
        const periods = plan?.periods ?? [];
        const marks = plan ? attendanceCounts(plan, counted) : null;
        return (
          <>
            <span className={cn("text-[0.9rem]", periods.length ? "text-chalk-dim" : "text-mist")}>
              {periods.length ? plural(locale, p.planSummary, periods.length, { minutes: totalMinutes(periods) }) : p.noPlan}
            </span>
            {marks && marks.unmarked < counted.length && <span className="text-[0.9rem] text-chalk-dim">{fill(p.attendanceLine, { present: marks.present + marks.late, total: counted.length })}</span>}
          </>
        );
      }}
    />
  );
}
