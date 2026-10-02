"use client";

import { EditOnly } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button } from "@/components/app/ui";
import { Jersey, PositionChips, panel } from "@/components/team/ui";
import type { SportId } from "@/domain/sports/types";
import { fullName, sortPlayers, type Player } from "@/domain/team/roster";
import { ATTENDANCE, attendanceCounts, type Attendance, type PracticePlan } from "@/domain/team/practice";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";

const TONE: Record<Attendance, string> = {
  present: "bg-volt text-night-950",
  late: "bg-amber text-night-950",
  absent: "bg-signal text-night-950",
  excused: "bg-ice text-night-950",
};

/** The roster with one mark per player; a second tap on a mark takes it back. */
export function AttendanceSheet({
  plan,
  players,
  sport,
  onChange,
  empty,
}: {
  plan: Pick<PracticePlan, "attendance">;
  players: Player[];
  sport: SportId;
  onChange: (attendance: Record<string, Attendance>) => void;
  /** Said when nobody is listed, instead of pointing to the roster. */
  empty?: string;
}) {
  const { t, locale } = useApp();
  const href = useHref();
  const a = t.practice.attendance;
  const listed = sortPlayers(
    players.filter((p) => p.status !== "inactive"),
    sport,
    "number",
    locale,
  );

  if (listed.length === 0 && empty) return <p className={cn(panel, "p-8 text-center text-chalk-dim")}>{empty}</p>;
  if (listed.length === 0) {
    return (
      <div className={cn(panel, "p-8 text-center")}>
        <p className="text-chalk-dim">{a.emptyRoster}</p>
        <a href={href("/panel/roster")} className="mt-5 inline-flex h-11 items-center rounded-[0.7rem] bg-volt px-5 font-semibold text-night-950 hover:bg-volt-soft">
          {a.toRoster}
        </a>
      </div>
    );
  }

  const counts = attendanceCounts(plan, listed.map((p) => p.id));
  const mark = (id: string, value: Attendance) => {
    const next = { ...plan.attendance };
    if (next[id] === value) delete next[id];
    else next[id] = value;
    onChange(next);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.92rem] text-chalk-dim" aria-live="polite">
          {fill(a.summary, counts)}
        </p>
        <EditOnly>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            className="h-10 px-3.5 text-[0.88rem]"
            disabled={counts.unmarked === 0}
            onClick={() => onChange(Object.fromEntries([...Object.entries(plan.attendance), ...listed.filter((p) => !plan.attendance[p.id]).map((p) => [p.id, "present"])]))}
          >
            {a.allPresent}
          </Button>
          <Button variant="ghost" className="h-10 px-3.5 text-[0.88rem]" disabled={counts.unmarked === listed.length} onClick={() => onChange({})}>
            {a.clear}
          </Button>
        </div>
        </EditOnly>
      </div>

      <ul className={cn(panel, "mt-4 divide-y divide-hairline overflow-hidden rounded-[var(--radius-card)]")}>
        {listed.map((player) => {
          const current = plan.attendance[player.id];
          return (
            <li key={player.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-5">
              <Jersey number={player.number} className="w-8 text-right text-[1.5rem]" />
              <span className="min-w-0 flex-1 basis-40">
                <span className="block truncate font-semibold">{fullName(player)}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2">
                  <PositionChips positions={player.positions.slice(0, 2)} />
                  {player.status === "injured" && <span className="text-[0.78rem] font-semibold text-signal">{t.roster.statuses.injured}</span>}
                </span>
              </span>
              <span role="group" aria-label={fullName(player)} className="flex flex-wrap gap-1">
                {ATTENDANCE.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={current === value}
                    onClick={() => mark(player.id, value)}
                    className={cn(
                      "min-h-10 rounded-[0.6rem] px-3 text-[0.85rem] font-semibold transition-colors",
                      current === value ? TONE[value] : "bg-chalk/6 text-chalk-dim hover:text-chalk",
                    )}
                  >
                    {a.statuses[value]}
                  </button>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      {players.some((p) => p.status === "inactive") && <p className="mt-3 text-[0.85rem] text-mist">{a.inactiveNote}</p>}
    </div>
  );
}
