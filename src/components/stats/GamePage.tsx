"use client";

import { useMemo, useState } from "react";
import { EditOnly, useCanEdit } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button, IconButton, TextArea } from "@/components/app/ui";
import { EventDialog } from "@/components/calendar/EventDialog";
import { timeRange } from "@/components/calendar/ui";
import { useTeam } from "@/components/team/hooks";
import { CoachOnly, Jersey, Select, Tabs, panel } from "@/components/team/ui";
import { Icon } from "@/components/ui/Icon";
import { useEvents } from "@/data/calendar";
import { statsRepo, useGames } from "@/data/stats";
import { useHydrated } from "@/data/store";
import { sports } from "@/domain/sports";
import { parseDay } from "@/domain/team/calendar";
import { fullName, sortPlayers } from "@/domain/team/roster";
import { allowsNegative, combineLines, emptyGame, formatStat, hasGroup, isEntered, playerStatGroups, statDigits, statKey, statValue, type GameStats, type StatLine } from "@/domain/team/stats";
import { localeTags } from "@/i18n/config";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";
import { NumberCell, ResultBadge } from "./parts";

export function GamePage({ eventId }: { eventId: string }) {
  const { t, locale } = useApp();
  const href = useHref();
  const hydrated = useHydrated();
  const { workspace, sport, roster } = useTeam();
  const events = useEvents(workspace?.id);
  const games = useGames(workspace?.id);
  const [group, setGroup] = useState<string | null>(null);
  // Players added to a group's table by hand, before they have a number in it.
  const [extra, setExtra] = useState<Record<string, string[]>>({});
  const [editingEvent, setEditingEvent] = useState(false);
  const canEdit = useCanEdit();
  const intl = localeTags[locale].intl;
  const fmt = useMemo(() => new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long", year: "numeric" }), [intl]);

  if (!workspace || !hydrated) return null;
  if (!sport) return <CoachOnly />;

  const s = t.stats;
  const back = (
    <a href={href("/panel/stats")} className="inline-flex min-h-11 items-center gap-1.5 text-[0.92rem] font-medium text-chalk-dim hover:text-chalk">
      <Icon name="chevronLeft" className="size-4" />
      {s.back}
    </a>
  );
  const event = events.find((e) => e.id === eventId);
  if (!event || event.kind !== "game") {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:py-14">
        {back}
        <p className="mt-8 text-chalk-dim">{event ? s.notGame : s.notFound}</p>
      </div>
    );
  }

  const game = games[eventId] ?? emptyGame(eventId);
  const update = (change: (g: GameStats) => GameStats) => statsRepo.update(workspace.id, eventId, change);
  const groups = sports[sport].statGroups;
  const current = groups.find((g) => g.id === group) ?? groups[0];
  const setStat = (playerId: string, key: string, value: number | null) =>
    update((g) => {
      const line: StatLine = { ...(g.players[playerId] ?? {}) };
      if (value === null) delete line[statKey(current.id, key)];
      else line[statKey(current.id, key)] = value;
      return { ...g, players: { ...g.players, [playerId]: line } };
    });
  const clearRow = (playerId: string) => {
    update((g) => {
      const line = Object.fromEntries(Object.entries(g.players[playerId] ?? {}).filter(([k]) => !k.startsWith(`${current.id}.`)));
      return { ...g, players: { ...g.players, [playerId]: line } };
    });
    setExtra((x) => ({ ...x, [current.id]: (x[current.id] ?? []).filter((id) => id !== playerId) }));
  };

  const listed = sortPlayers(
    roster.players.filter((p) => hasGroup(game.players[p.id], current.id) || (canEdit && ((extra[current.id] ?? []).includes(p.id) || (p.status !== "inactive" && playerStatGroups(p, sport).includes(current.id))))),
    sport,
    "number",
    locale,
  );
  const others = sortPlayers(
    roster.players.filter((p) => !listed.includes(p)),
    sport,
    "number",
    locale,
  );
  const total = combineLines(listed.map((p) => game.players[p.id] ?? {}).map((line) => Object.fromEntries(Object.entries(line).filter(([k]) => k.startsWith(`${current.id}.`)))));
  const opponent = event.opponent || s.opponent;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
      {back}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[0.9rem] font-semibold text-signal first-letter:uppercase">{fmt.format(parseDay(event.date))}</p>
          <h1 className="display mt-2 text-display-md">{event.title}</h1>
          <p className="mt-3 text-chalk-dim">{[timeRange(event, t.calendar.allDay), event.venue ? t.calendar.venues[event.venue] : null, event.location || null].filter(Boolean).join(", ")}</p>
        </div>
        <EditOnly>
          <Button variant="ghost" onClick={() => setEditingEvent(true)}>
            <Icon name="pencil" className="size-[1.1rem]" />
            {t.practice.editEvent}
          </Button>
        </EditOnly>
      </div>

      <section aria-labelledby="score-title" className={cn(panel, "mt-8 rounded-[var(--radius-card)] p-5 sm:p-6")}>
        <h2 id="score-title" className="text-[0.85rem] font-medium text-mist">
          {s.score}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          {[
            { side: "us" as const, name: workspace.name },
            { side: "them" as const, name: opponent },
          ].map(({ side, name }, i) => (
            <label key={side} className="flex w-full min-w-0 items-center justify-between gap-3 sm:w-auto sm:justify-start">
              <span className={cn("min-w-0 truncate text-[1.05rem] font-semibold", i === 1 && "text-chalk-dim")}>{name}</span>
              {canEdit ? (
                <NumberCell value={game[side]} onChange={(v) => update((g) => ({ ...g, [side]: v }))} label={fill(s.scoreOf, { team: name })} large />
              ) : (
                <span className="display tabular w-20 text-center text-[2rem]">{game[side] ?? "–"}</span>
              )}
            </label>
          ))}
          <ResultBadge game={game} />
        </div>
      </section>

      <section aria-labelledby="sheet-title" className="mt-10">
        <h2 id="sheet-title" className="sr-only">
          {s.leaders}
        </h2>
        <div className="overflow-x-auto pb-1">
          <Tabs idBase="sheet" label={s.leaders} value={current.id} onChange={setGroup} tabs={groups.map((g) => ({ value: g.id, label: g.label[locale] }))} />
        </div>
        {canEdit && <p className="mt-3 text-[0.88rem] text-mist">{s.groupHint}</p>}
        <div id="sheet-panel" role="tabpanel" aria-labelledby={`sheet-tab-${current.id}`} className={cn(panel, "mt-3 overflow-x-auto rounded-[var(--radius-card)]")}>
          {listed.length === 0 ? (
            <p className="p-6 text-[0.95rem] text-mist">{canEdit ? s.noPlayers : s.noLeaders}</p>
          ) : (
            <table className="w-full text-[0.92rem]">
              <thead>
                <tr className="border-b border-hairline text-[0.8rem] text-mist">
                  <th scope="col" className="sticky left-0 z-10 bg-night-850 py-2.5 pr-3 pl-4 text-left font-medium">
                    {s.player}
                  </th>
                  {current.stats.map((st) => (
                    <th key={st.key} scope="col" title={st.label[locale]} className="px-1.5 py-2.5 text-right font-medium">
                      {st.abbr}
                    </th>
                  ))}
                  <td className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {listed.map((player) => {
                  const line = game.players[player.id] ?? {};
                  return (
                    <tr key={player.id}>
                      <th scope="row" className="sticky left-0 z-10 bg-night-850 py-1.5 pr-3 pl-4 text-left font-normal">
                        <span className="flex items-center gap-2.5 whitespace-nowrap">
                          <Jersey number={player.number} className="w-7 text-right text-[1.2rem]" />
                          <span className="font-semibold">{fullName(player)}</span>
                        </span>
                      </th>
                      {current.stats.map((st) => (
                        <td key={st.key} className="px-1.5 py-1.5 text-right">
                          {canEdit && isEntered(current.id, st.key) ? (
                            <NumberCell
                              value={line[statKey(current.id, st.key)] ?? null}
                              onChange={(v) => setStat(player.id, st.key, v)}
                              label={`${fullName(player)}, ${st.label[locale]}`}
                              negative={allowsNegative(st.key)}
                              decimals={statDigits(current.id, st.key) > 0}
                            />
                          ) : (
                            <span className="tabular block px-2 text-chalk-dim">{formatStat(statValue(line, current.id, st.key), statDigits(current.id, st.key), intl)}</span>
                          )}
                        </td>
                      ))}
                      <td className="pr-2">
                        {canEdit && hasGroup(line, current.id) && (
                          <IconButton label={fill(s.clearRow, { name: fullName(player) })} onClick={() => clearRow(player.id)} className="size-9">
                            <Icon name="close" className="size-4" />
                          </IconButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-hairline-strong font-semibold">
                  <th scope="row" className="sticky left-0 z-10 bg-night-850 py-2.5 pr-3 pl-4 text-left">
                    {s.total}
                  </th>
                  {current.stats.map((st) => (
                    <td key={st.key} className="tabular px-3.5 py-2.5 text-right">
                      {formatStat(statValue(total, current.id, st.key), statDigits(current.id, st.key), intl)}
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
        {canEdit && others.length > 0 && (
          <div className="mt-3 max-w-xs">
            <Select
              label={s.addPlayer}
              hideLabel
              value=""
              onChange={(id) => id && setExtra((x) => ({ ...x, [current.id]: [...(x[current.id] ?? []), id] }))}
              options={[{ value: "", label: `${s.addPlayer}…` }, ...others.map((p) => ({ value: p.id, label: `${p.number ?? "–"}  ${fullName(p)}` }))]}
            />
          </div>
        )}
      </section>

      <div className="mt-10">
        {canEdit ? (
          <TextArea label={s.notes} placeholder={s.notesPlaceholder} value={game.notes} onChange={(notes) => update((g) => ({ ...g, notes }))} rows={4} />
        ) : (
          game.notes && (
            <section>
              <h2 className="text-[0.85rem] font-medium text-chalk-dim">{s.notes}</h2>
              <p className="mt-2 whitespace-pre-line text-chalk-dim">{game.notes}</p>
            </section>
          )
        )}
      </div>

      {editingEvent && canEdit && <EventDialog open onClose={() => setEditingEvent(false)} event={event} date={event.date} workspaceId={workspace.id} />}
    </div>
  );
}
