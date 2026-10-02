"use client";

import { useMemo, useState } from "react";
import { EditOnly, useCanEdit } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button, IconButton } from "@/components/app/ui";
import { useTeam, useToday } from "@/components/team/hooks";
import { CoachOnly, ModuleHeader, Tabs, panel } from "@/components/team/ui";
import { Icon } from "@/components/ui/Icon";
import { useEvents } from "@/data/calendar";
import { useHydrated } from "@/data/store";
import { sports } from "@/domain/sports";
import { EVENT_KINDS, addMonths, byDay, monthGrid, monthKey, parseDay, upcoming, type TeamEvent } from "@/domain/team/calendar";
import { localeTags } from "@/i18n/config";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";
import { EventDetails } from "./EventDetails";
import { EventDialog } from "./EventDialog";
import { EventRow, KIND_TONE, KindDot } from "./ui";

type View = "month" | "agenda";
/** A new event on a day, or an existing one. */
type Editing = { event: TeamEvent | null; date: string } | null;

/** Chips a desktop day cell shows before "+n more". */
const CHIPS = 3;

export function CalendarPage() {
  const { t, locale } = useApp();
  const href = useHref();
  const hydrated = useHydrated();
  const today = useToday();
  const { workspace, sport } = useTeam();
  const events = useEvents(workspace?.id);
  const [view, setView] = useState<View>("month");
  const [month, setMonth] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const canEdit = useCanEdit();

  const intl = localeTags[locale].intl;
  const fmt = useMemo(
    () => ({
      month: new Intl.DateTimeFormat(intl, { month: "long", year: "numeric" }),
      weekday: new Intl.DateTimeFormat(intl, { weekday: "short" }),
      long: new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long" }),
      full: new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    }),
    [intl],
  );
  const days = useMemo(() => byDay(events), [events]);

  if (!workspace || !hydrated || !today) return null;
  if (!sport) return <CoachOnly />;

  const c = t.calendar;
  const shownMonth = month ?? today;
  const day = selected ?? today;
  const grid = monthGrid(shownMonth, locale === "tr" ? 1 : 0);
  const dayEvents = days.get(day) ?? [];
  const soon = upcoming(events, today);
  const open = (event: TeamEvent) => setEditing({ event, date: event.date });
  /** Where an event's own page is: a practice's plan, a meeting's agenda, a game's stats. */
  const linkOf = (event: TeamEvent) =>
    event.kind === "practice"
      ? { href: href(`/panel/practice/${event.id}`), label: t.practice.tabs.plan }
      : event.kind === "meeting"
        ? { href: href(`/panel/meetings/${event.id}`), label: t.meetings.tabs.agenda }
        : event.kind === "game"
          ? { href: href(`/panel/stats/${event.id}`), label: t.stats.title }
          : null;
  const goTo = (iso: string) => {
    setMonth(iso);
    setSelected(null);
  };

  const dayPanel = (
    <section aria-labelledby="day-title" className={cn(panel, "rounded-[var(--radius-card)] p-4 sm:p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="day-title" className="text-[1.05rem] font-semibold first-letter:uppercase">
          {fmt.long.format(parseDay(day))}
        </h2>
        <EditOnly>
          <Button variant="ghost" className="h-10 px-3.5 text-[0.88rem]" onClick={() => setEditing({ event: null, date: day })}>
            <Icon name="plus" className="size-4" />
            {c.addOnDay}
          </Button>
        </EditOnly>
      </div>
      {dayEvents.length === 0 ? (
        <p className="mt-4 text-[0.92rem] text-mist">{c.noEvents}</p>
      ) : (
        <ul className="mt-2 -mx-2">
          {dayEvents.map((e) => (
            <li key={e.id}>
              <EventRow event={e} onOpen={() => open(e)} link={linkOf(e)} readOnly={!canEdit} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
      <ModuleHeader
        eyebrow={sports[sport].name[locale]}
        title={c.title}
        body={c.body}
        actions={
          canEdit && (
            <Button onClick={() => setEditing({ event: null, date: view === "month" ? day : today })}>
              <Icon name="plus" className="size-5" />
              {c.addEvent}
            </Button>
          )
        }
      />

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <Tabs
          idBase="calendar"
          label={c.title}
          value={view}
          onChange={setView}
          tabs={[
            { value: "month", label: c.views.month },
            { value: "agenda", label: c.views.agenda },
          ]}
        />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.85rem] text-chalk-dim">
          {EVENT_KINDS.map((k) => (
            <li key={k} className="inline-flex items-center gap-2">
              <KindDot kind={k} />
              {c.kinds[k]}
            </li>
          ))}
        </ul>
      </div>

      <div id="calendar-panel" role="tabpanel" aria-labelledby={`calendar-tab-${view}`} className="mt-6">
        {view === "agenda" ? (
          soon.length === 0 ? (
            <p className={cn(panel, "p-8 text-center text-chalk-dim")}>{events.length ? c.upcomingEmpty : canEdit ? c.empty : t.common.nothingYet}</p>
          ) : (
            <ol className="space-y-6">
              {[...byDay(soon)].map(([date, list]) => (
                <li key={date}>
                  <h2 className="flex items-baseline gap-3 text-[1rem] font-semibold first-letter:uppercase">
                    {fmt.long.format(parseDay(date))}
                    {date === today && <span className="text-[0.82rem] font-semibold text-volt">{c.today}</span>}
                  </h2>
                  <ul className={cn(panel, "mt-2 rounded-[var(--radius-card)] p-2")}>
                    {list.map((e) => (
                      <li key={e.id}>
                        <EventRow event={e} onOpen={() => open(e)} link={linkOf(e)} readOnly={!canEdit} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="display min-w-0 flex-1 text-[clamp(1.6rem,1.2rem+1.2vw,2.2rem)] leading-none first-letter:uppercase" aria-live="polite">
                  {fmt.month.format(parseDay(shownMonth))}
                </h2>
                <Button variant="ghost" className="h-10 px-3.5 text-[0.88rem]" disabled={monthKey(shownMonth) === monthKey(today) && day === today} onClick={() => goTo(today)}>
                  {c.today}
                </Button>
                <IconButton label={c.prevMonth} onClick={() => goTo(addMonths(shownMonth, -1))}>
                  <Icon name="chevronLeft" className="size-5" />
                </IconButton>
                <IconButton label={c.nextMonth} onClick={() => goTo(addMonths(shownMonth, 1))}>
                  <Icon name="chevronLeft" className="size-5 rotate-180" />
                </IconButton>
              </div>

              <div className={cn(panel, "overflow-hidden rounded-[var(--radius-card)]")}>
                <div className="grid grid-cols-7 border-b border-hairline" aria-hidden="true">
                  {grid[0].map((d) => (
                    <span key={d} className="py-2 text-center text-[0.78rem] font-medium text-mist first-letter:uppercase">
                      {fmt.weekday.format(parseDay(d))}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px bg-hairline">
                  {grid.flat().map((d) => {
                    const list = days.get(d) ?? [];
                    const inMonth = monthKey(d) === monthKey(shownMonth);
                    const isSelected = d === day;
                    return (
                      <div key={d} className={cn("relative min-h-14 p-1 sm:p-1.5 md:min-h-[7.25rem]", inMonth ? "bg-night-850" : "bg-night-900")}>
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          aria-label={`${fmt.full.format(parseDay(d))}${list.length ? `, ${plural(locale, c.dayEvents, list.length)}` : ""}`}
                          onClick={() => setSelected(d)}
                          className={cn("absolute inset-0 transition-colors hover:bg-chalk/[0.035]", isSelected && "shadow-[inset_0_0_0_1.5px_var(--color-chalk)]")}
                        />
                        <span
                          aria-hidden="true"
                          className={cn(
                            "pointer-events-none relative grid size-7 place-items-center rounded-full text-[0.85rem] font-semibold tabular",
                            d === today ? "bg-volt text-night-950" : inMonth ? "text-chalk" : "text-mist/50",
                          )}
                        >
                          {parseDay(d).getDate()}
                        </span>
                        {/* Phones: a dot per event. */}
                        {list.length > 0 && (
                          <span aria-hidden="true" className="pointer-events-none relative mt-1 flex flex-wrap gap-1 px-1 md:hidden">
                            {list.slice(0, 4).map((e) => (
                              <KindDot key={e.id} kind={e.kind} className="size-1.5" />
                            ))}
                          </span>
                        )}
                        {/* Wider screens: the events themselves. */}
                        {list.length > 0 && (
                          <ul className="pointer-events-none relative mt-1 hidden space-y-1 md:block">
                            {list.slice(0, list.length > CHIPS ? CHIPS - 1 : CHIPS).map((e) => (
                              <li key={e.id}>
                                <button
                                  type="button"
                                  onClick={() => open(e)}
                                  className={cn("pointer-events-auto block w-full rounded-md px-1.5 py-1 text-left text-[0.76rem] leading-tight transition-colors", KIND_TONE[e.kind].chip, !inMonth && "opacity-60")}
                                >
                                  {e.start && <span className="tabular block text-[0.7rem] text-chalk-dim">{e.start}</span>}
                                  <span className="block truncate font-medium">{e.title}</span>
                                </button>
                              </li>
                            ))}
                            {list.length > CHIPS && <li className="px-1.5 text-[0.74rem] font-medium text-mist">{fill(c.more, { n: list.length - (CHIPS - 1) })}</li>}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {events.length === 0 && <p className="mt-4 text-[0.92rem] text-mist">{canEdit ? c.empty : t.common.nothingYet}</p>}
            </div>
            <div className="lg:sticky lg:top-6">{dayPanel}</div>
          </div>
        )}
      </div>

      {editing && canEdit && <EventDialog key={editing.event?.id ?? `new-${editing.date}`} open onClose={() => setEditing(null)} event={editing.event} date={editing.date} workspaceId={workspace.id} />}
      {editing?.event && !canEdit && <EventDetails event={editing.event} link={linkOf(editing.event)} onClose={() => setEditing(null)} />}
    </div>
  );
}
