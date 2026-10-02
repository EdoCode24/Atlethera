"use client";

import { useMemo, useState } from "react";
import { EditOnly, ReadOnlyScope, useCanEdit } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button, Dialog, TextArea, TextField } from "@/components/app/ui";
import { EventDialog } from "@/components/calendar/EventDialog";
import { timeRange } from "@/components/calendar/ui";
import { useTeam } from "@/components/team/hooks";
import { CoachOnly, Tabs } from "@/components/team/ui";
import { Icon } from "@/components/ui/Icon";
import { useEvents } from "@/data/calendar";
import { usePlaybooks } from "@/data/playbooks";
import { practiceRepo, usePlans } from "@/data/practice";
import { useHydrated } from "@/data/store";
import { newId } from "@/domain/playbook/formations";
import { parseDay } from "@/domain/team/calendar";
import { attendanceCounts, copyPeriods, durationMinutes, emptyPlan, move, periodClock, presetsFor, totalMinutes, type Period, type PracticePlan, type Unit } from "@/domain/team/practice";
import { localeTags } from "@/i18n/config";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";
import { AttendanceSheet } from "./AttendanceSheet";
import { PeriodCard, UNIT_TONE } from "./PeriodCard";
import { PlayPicker } from "./PlayPicker";
import { PracticePrint } from "./PracticePrint";

type View = "plan" | "attendance";
const DEFAULT_MINUTES = 10;

export function PracticePlanPage({ eventId }: { eventId: string }) {
  const { t, locale } = useApp();
  const href = useHref();
  const hydrated = useHydrated();
  const { workspace, sport, roster } = useTeam();
  const events = useEvents(workspace?.id);
  const plans = usePlans(workspace?.id);
  const books = usePlaybooks(workspace?.id);
  const [view, setView] = useState<View>("plan");
  const [editingEvent, setEditingEvent] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const canEdit = useCanEdit();
  const fmt = useMemo(() => new Intl.DateTimeFormat(localeTags[locale].intl, { weekday: "long", day: "numeric", month: "long", year: "numeric" }), [locale]);

  if (!workspace || !hydrated) return null;
  if (!sport) return <CoachOnly />;

  const p = t.practice;
  const back = (
    <a href={href("/panel/practice")} className="inline-flex min-h-11 items-center gap-1.5 text-[0.92rem] font-medium text-chalk-dim hover:text-chalk">
      <Icon name="chevronLeft" className="size-4" />
      {p.back}
    </a>
  );
  const event = events.find((e) => e.id === eventId);
  if (!event || event.kind !== "practice") {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:py-14">
        {back}
        <p className="mt-8 text-chalk-dim">{event ? p.notPractice : p.notFound}</p>
      </div>
    );
  }

  const plan = plans[eventId] ?? emptyPlan(eventId);
  const update = (change: (plan: PracticePlan) => PracticePlan) => practiceRepo.update(workspace.id, eventId, change);
  const setPeriods = (change: (periods: Period[]) => Period[]) => update((pl) => ({ ...pl, periods: change(pl.periods) }));
  const addPeriod = (name: string, unit: Unit) => setPeriods((list) => [...list, { id: newId("pd"), name, minutes: DEFAULT_MINUTES, unit, drill: "", plays: [] }]);

  const clock = periodClock(event.start, plan.periods);
  const total = totalMinutes(plan.periods);
  const planned = durationMinutes(event.start, event.end);
  const date = fmt.format(parseDay(event.date));
  const counted = roster.players.filter((pl) => pl.status !== "inactive").map((pl) => pl.id);
  const marks = attendanceCounts(plan, counted);
  const others = Object.values(plans)
    .filter((o) => o.eventId !== eventId && o.periods.length > 0)
    .map((o) => ({ plan: o, event: events.find((e) => e.id === o.eventId) }))
    .filter((o) => o.event)
    .sort((a, b) => b.event!.date.localeCompare(a.event!.date));
  const pickingPeriod = plan.periods.find((pd) => pd.id === picking);
  const scale = Math.max(total, planned ?? 0);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:py-14">
      {back}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[0.9rem] font-semibold text-volt first-letter:uppercase">{date}</p>
          <h1 className="display mt-2 text-display-md">{event.title}</h1>
          <p className="mt-3 text-chalk-dim">{[timeRange(event, t.calendar.allDay), event.location || null].filter(Boolean).join(", ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EditOnly>
            <Button variant="ghost" onClick={() => setEditingEvent(true)}>
              <Icon name="pencil" className="size-[1.1rem]" />
              {p.editEvent}
            </Button>
          </EditOnly>
          <Button variant="ghost" onClick={() => window.print()} disabled={plan.periods.length === 0}>
            <Icon name="printer" className="size-[1.1rem]" />
            {p.print}
          </Button>
        </div>
      </div>

      <div className="mt-10">
        <Tabs
          idBase="practice"
          label={event.title}
          value={view}
          onChange={setView}
          tabs={[
            { value: "plan", label: p.tabs.plan },
            { value: "attendance", label: counted.length && marks.unmarked < counted.length ? `${p.tabs.attendance} ${marks.present + marks.late}/${counted.length}` : p.tabs.attendance },
          ]}
        />
      </div>

      <div id="practice-panel" role="tabpanel" aria-labelledby={`practice-tab-${view}`} className="mt-6">
        {view === "attendance" ? (
          <ReadOnlyScope>
            <AttendanceSheet plan={plan} players={roster.players} sport={sport} onChange={(attendance) => update((pl) => ({ ...pl, attendance }))} />
          </ReadOnlyScope>
        ) : (
          <ReadOnlyScope>
          <div className="space-y-8">
            {(canEdit || plan.focus) && (
              <TextField label={p.focus} placeholder={p.focusPlaceholder} value={plan.focus} onChange={(e) => update((pl) => ({ ...pl, focus: e.target.value }))} autoComplete="off" />
            )}

            <section aria-labelledby="periods-title">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="periods-title" className="text-[1.1rem] font-semibold">
                  {p.periods}
                </h2>
                {plan.periods.length > 0 && (
                  <p className="text-[0.92rem] text-chalk-dim">
                    {fill(p.total, { minutes: total })}
                    {planned !== null && <span className="text-mist">{`, ${fill(p.planned, { minutes: planned })}`}</span>}
                  </p>
                )}
              </div>

              {plan.periods.length > 0 && (
                <>
                  {/* The practice as a strip: each period's share of the time, in its unit's colour. */}
                  <div aria-hidden="true" className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-night-800">
                    {plan.periods.map((pd) => (
                      <span key={pd.id} className={cn("h-full", UNIT_TONE[pd.unit])} style={{ width: `${(pd.minutes / scale) * 100}%` }} />
                    ))}
                  </div>
                  {planned !== null && total !== planned && (
                    <p className={cn("mt-2 text-[0.88rem]", total > planned ? "text-signal" : "text-mist")}>
                      {total > planned ? fill(p.over, { minutes: total - planned }) : fill(p.left, { minutes: planned - total })}
                    </p>
                  )}
                </>
              )}

              {plan.periods.length === 0 ? (
                <p className="mt-4 text-[0.95rem] text-mist">{canEdit ? p.noPeriods : t.common.nothingYet}</p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {plan.periods.map((pd, i) => (
                    <PeriodCard
                      key={pd.id}
                      period={pd}
                      index={i}
                      count={plan.periods.length}
                      slot={clock?.[i] ?? null}
                      sport={sport}
                      books={books}
                      onChange={(patch) => setPeriods((list) => list.map((x) => (x.id === pd.id ? { ...x, ...patch } : x)))}
                      onMove={(delta) => setPeriods((list) => move(list, list.findIndex((x) => x.id === pd.id), delta))}
                      onDuplicate={() =>
                        setPeriods((list) => {
                          const at = list.findIndex((x) => x.id === pd.id);
                          return [...list.slice(0, at + 1), ...copyPeriods([pd], () => newId("pd")), ...list.slice(at + 1)];
                        })
                      }
                      onRemove={() => setPeriods((list) => list.filter((x) => x.id !== pd.id))}
                      onPickPlays={() => setPicking(pd.id)}
                    />
                  ))}
                </ol>
              )}

              <EditOnly>
              <div className="mt-5 rounded-[var(--radius-card)] p-4 shadow-[inset_0_0_0_1px_var(--color-hairline)]">
                <p className="text-[0.85rem] font-medium text-chalk-dim">{p.quickAdd}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {presetsFor(sport).map(({ preset, unit }) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => addPeriod(p.presets[preset], unit)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-[0.6rem] bg-chalk/6 px-3 text-[0.88rem] font-semibold text-chalk-dim transition-colors hover:bg-chalk/10 hover:text-chalk"
                    >
                      <span aria-hidden="true" className={cn("size-2 rounded-full", UNIT_TONE[unit])} />
                      {p.presets[preset]}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="ghost" className="h-10 px-3.5 text-[0.88rem]" onClick={() => addPeriod(p.newPeriod, "team")}>
                    <Icon name="plus" className="size-4" />
                    {p.addPeriod}
                  </Button>
                  <Button variant="ghost" className="h-10 px-3.5 text-[0.88rem]" onClick={() => setCopying(true)}>
                    <Icon name="copy" className="size-4" />
                    {p.copyFrom}
                  </Button>
                </div>
              </div>
              </EditOnly>
            </section>

            {(canEdit || plan.notes) && <TextArea label={p.notes} placeholder={p.notesPlaceholder} value={plan.notes} onChange={(notes) => update((pl) => ({ ...pl, notes }))} rows={4} />}
          </div>
          </ReadOnlyScope>
        )}
      </div>

      {editingEvent && canEdit && <EventDialog open onClose={() => setEditingEvent(false)} event={event} date={event.date} workspaceId={workspace.id} />}
      {pickingPeriod && canEdit && (
        <PlayPicker
          books={books}
          selected={pickingPeriod.plays}
          onClose={() => setPicking(null)}
          onPick={(refs) => setPeriods((list) => list.map((x) => (x.id === pickingPeriod.id ? { ...x, plays: refs } : x)))}
        />
      )}
      {copying && canEdit && (
        <Dialog open onClose={() => setCopying(false)} title={p.copyTitle}>
          {others.length === 0 ? (
            <p className="text-chalk-dim">{p.copyEmpty}</p>
          ) : (
            <>
              <p className="text-[0.95rem] text-chalk-dim">{p.copyBody}</p>
              <ul className="mt-4 space-y-2">
                {others.map(({ plan: source, event: from }) => (
                  <li key={source.eventId}>
                    <button
                      type="button"
                      onClick={() => {
                        setPeriods((list) => [...list, ...copyPeriods(source.periods, () => newId("pd"))]);
                        setCopying(false);
                      }}
                      className="block w-full rounded-[0.8rem] px-4 py-3 text-left shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] transition-colors hover:bg-chalk/5"
                    >
                      <span className="block font-semibold first-letter:uppercase">{fmt.format(parseDay(from!.date))}</span>
                      <span className="mt-0.5 block text-[0.88rem] text-mist">
                        {[source.focus || null, plural(locale, p.planSummary, source.periods.length, { minutes: totalMinutes(source.periods) })].filter(Boolean).join(", ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Dialog>
      )}
      <PracticePrint event={event} plan={plan} team={workspace.name} date={date} books={books} />
    </div>
  );
}
