"use client";

import { useMemo, useState } from "react";
import { useCanEdit } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button } from "@/components/app/ui";
import { EventDialog } from "@/components/calendar/EventDialog";
import { useTeam, useToday } from "@/components/team/hooks";
import { CoachOnly, Jersey, ModuleHeader, Tabs, panel } from "@/components/team/ui";
import { Icon } from "@/components/ui/Icon";
import { useEvents } from "@/data/calendar";
import { useGames } from "@/data/stats";
import { useHydrated } from "@/data/store";
import { sports } from "@/domain/sports";
import { parseDay, sortEvents } from "@/domain/team/calendar";
import { fullName } from "@/domain/team/roster";
import { combineLines, formatStat, hasGroup, leadStat, seasonRecord, statDigits, statValue } from "@/domain/team/stats";
import { localeTags } from "@/i18n/config";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";
import { recordText, ResultBadge } from "./parts";

type Sort = { key: string; dir: "asc" | "desc" } | null;

export function StatsPage() {
  const { t, locale } = useApp();
  const href = useHref();
  const hydrated = useHydrated();
  const today = useToday();
  const { workspace, sport, roster } = useTeam();
  const events = useEvents(workspace?.id);
  const games = useGames(workspace?.id);
  const [group, setGroup] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>(null);
  const [adding, setAdding] = useState(false);
  const canEdit = useCanEdit();
  const intl = localeTags[locale].intl;
  const day = useMemo(() => new Intl.DateTimeFormat(intl, { day: "numeric", month: "long", year: "numeric" }), [intl]);

  if (!workspace || !hydrated || !today) return null;
  if (!sport) return <CoachOnly />;

  const s = t.stats;
  const gameEvents = sortEvents(events.filter((e) => e.kind === "game"));
  const onCalendar = gameEvents.map((e) => games[e.id]).filter(Boolean);
  const record = seasonRecord(onCalendar);
  const groups = sports[sport].statGroups;
  const current = groups.find((g) => g.id === group) ?? groups[0];

  // Season lines per player, from the games still on the calendar.
  const rows = roster.players
    .map((player) => {
      const lines = onCalendar.map((g) => g.players[player.id]).filter((line) => hasGroup(line, current.id));
      return { player, played: lines.length, line: combineLines(lines) };
    })
    .filter((r) => r.played > 0);
  const by = sort ?? { key: leadStat(current), dir: "desc" as const };
  const value = (line: Record<string, number>, key: string) => statValue(line, current.id, key) ?? -Infinity;
  rows.sort((a, b) => {
    const d = by.key === "gp" ? a.played - b.played : value(a.line, by.key) - value(b.line, by.key);
    return (by.dir === "desc" ? -d : d) || (a.player.number ?? 999) - (b.player.number ?? 999);
  });
  const sortButton = (key: string, label: string, title: string) => {
    const active = by.key === key;
    return (
      <th key={key} scope="col" aria-sort={active ? (by.dir === "desc" ? "descending" : "ascending") : undefined} className="px-2 py-2.5 text-right font-medium" title={title}>
        <button
          type="button"
          aria-label={fill(s.sortBy, { stat: title })}
          onClick={() => setSort({ key, dir: active && by.dir === "desc" ? "asc" : "desc" })}
          className={cn("inline-flex min-h-8 items-center gap-1 rounded-md px-1 hover:text-chalk", active && "text-chalk")}
        >
          {label}
          {active && <Icon name="arrowDown" className={cn("size-3", by.dir === "asc" && "rotate-180")} />}
        </button>
      </th>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
      <ModuleHeader
        eyebrow={sports[sport].name[locale]}
        title={s.title}
        body={s.body}
        actions={
          canEdit && (
            <Button onClick={() => setAdding(true)}>
              <Icon name="plus" className="size-5" />
              {s.addGame}
            </Button>
          )
        }
      />

      <div className="mt-10 grid gap-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <section aria-labelledby="season-title" className={cn(panel, "rounded-[var(--radius-card)] p-5 sm:p-6")}>
          <h2 id="season-title" className="text-[0.85rem] font-medium text-mist">
            {s.season}
          </h2>
          {record.played ? (
            <>
              <p className="display tabular mt-2 text-[3.4rem] leading-none" aria-hidden="true">
                {recordText(record)}
              </p>
              <p className="mt-3 text-[0.95rem] text-chalk-dim">{fill(s.recordLong, record)}</p>
              <p className="mt-1 text-[0.9rem] text-mist">{fill(s.points, { for: record.pointsFor, against: record.pointsAgainst })}</p>
            </>
          ) : (
            <p className="mt-3 text-[0.95rem] text-mist">{s.noRecord}</p>
          )}
        </section>

        <section aria-labelledby="games-title" className={cn(panel, "rounded-[var(--radius-card)] p-2 sm:p-3")}>
          <h2 id="games-title" className="px-3 pt-2 text-[0.85rem] font-medium text-mist">
            {s.games}
          </h2>
          {gameEvents.length === 0 ? (
            <p className="px-3 py-4 text-[0.95rem] text-chalk-dim">{canEdit ? s.noGames : t.common.nothingYet}</p>
          ) : (
            <ul className="mt-1 divide-y divide-hairline">
              {gameEvents.map((e) => {
                const g = games[e.id];
                const scored = g && g.us !== null && g.them !== null;
                return (
                  <li key={e.id}>
                    <a href={href(`/panel/stats/${e.id}`)} className="group flex items-center gap-4 rounded-[0.7rem] px-3 py-3 transition-colors hover:bg-chalk/[0.03]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold group-hover:underline">{e.title}</span>
                        <span className="mt-0.5 block text-[0.85rem] text-mist">{[day.format(parseDay(e.date)), e.venue ? t.calendar.venues[e.venue] : null].filter(Boolean).join(", ")}</span>
                      </span>
                      {scored ? (
                        <>
                          <span className="tabular text-[1.05rem] font-semibold">{`${g.us}–${g.them}`}</span>
                          <ResultBadge game={g} />
                        </>
                      ) : (
                        <span className="text-[0.85rem] text-mist">{e.date > today ? s.notPlayed : s.noScore}</span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="leaders-title" className="mt-12">
        <h2 id="leaders-title" className="text-[1.1rem] font-semibold">
          {s.leaders}
        </h2>
        <p className="mt-1 text-[0.9rem] text-mist">{s.leadersBody}</p>
        <div className="mt-4 overflow-x-auto pb-1">
          <Tabs
            idBase="leaders"
            label={s.leaders}
            value={current.id}
            onChange={(id) => {
              setGroup(id);
              setSort(null);
            }}
            tabs={groups.map((g) => ({ value: g.id, label: g.label[locale] }))}
          />
        </div>
        <div id="leaders-panel" role="tabpanel" aria-labelledby={`leaders-tab-${current.id}`} className={cn(panel, "mt-4 overflow-x-auto rounded-[var(--radius-card)]")}>
          {rows.length === 0 ? (
            <p className="p-6 text-[0.95rem] text-mist">{s.noLeaders}</p>
          ) : (
            <table className="w-full text-[0.92rem]">
              <thead>
                <tr className="border-b border-hairline text-[0.8rem] text-mist">
                  <th scope="col" className="sticky left-0 bg-night-850 py-2.5 pr-3 pl-4 text-left font-medium">
                    {s.player}
                  </th>
                  {sortButton("gp", s.gamesColumn, s.gamesColumn)}
                  {current.stats.map((st) => sortButton(st.key, st.abbr, st.label[locale]))}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map(({ player, played, line }) => (
                  <tr key={player.id}>
                    <th scope="row" className="sticky left-0 bg-night-850 py-2 pr-3 pl-4 text-left font-normal">
                      <a href={href(`/panel/roster/${player.id}`)} className="flex items-center gap-2.5 whitespace-nowrap hover:underline">
                        <Jersey number={player.number} className="w-7 text-right text-[1.2rem]" />
                        <span className="font-semibold">{fullName(player)}</span>
                      </a>
                    </th>
                    <td className="tabular px-3 py-2 text-right text-chalk-dim">{played}</td>
                    {current.stats.map((st) => (
                      <td key={st.key} className={cn("tabular px-3 py-2 text-right", by.key === st.key ? "font-semibold text-chalk" : "text-chalk-dim")}>
                        {formatStat(statValue(line, current.id, st.key), statDigits(current.id, st.key), intl)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {adding && canEdit && (
        <EventDialog
          open
          onClose={() => setAdding(false)}
          event={null}
          date={today}
          kind="game"
          title={s.addGame}
          workspaceId={workspace.id}
          onAdded={(added) => window.location.assign(href(`/panel/stats/${added[0].id}`))}
        />
      )}
    </div>
  );
}
