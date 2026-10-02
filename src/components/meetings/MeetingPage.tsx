"use client";

import { useId, useMemo, useState } from "react";
import { EditOnly, ReadOnlyScope, useCanEdit } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button, TextArea } from "@/components/app/ui";
import { EventDialog } from "@/components/calendar/EventDialog";
import { timeRange } from "@/components/calendar/ui";
import { AttendanceSheet } from "@/components/practice/AttendanceSheet";
import { LinkedPlays, MinutesStepper, bare } from "@/components/practice/parts";
import { ItemActions } from "@/components/practice/PeriodCard";
import { PlayPicker } from "@/components/practice/PlayPicker";
import { useTeam } from "@/components/team/hooks";
import { CoachOnly, Tabs } from "@/components/team/ui";
import { Icon } from "@/components/ui/Icon";
import { useAccount } from "@/data/account";
import { useEvents } from "@/data/calendar";
import { useLiveMeetings } from "@/data/live";
import { meetingRepo, useMeetings } from "@/data/meetings";
import { usePlaybooks } from "@/data/playbooks";
import { useHydrated } from "@/data/store";
import { newId } from "@/domain/playbook/formations";
import type { Playbook } from "@/domain/playbook/types";
import { parseDay } from "@/domain/team/calendar";
import { emptyMeeting, invitedPlayers, meetingGroups, type AgendaItem, type Meeting } from "@/domain/team/meeting";
import { attendanceCounts, move, periodClock, totalMinutes } from "@/domain/team/practice";
import { positionGroups } from "@/domain/team/roster";
import { localeTags } from "@/i18n/config";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";
import { LiveCard } from "./live/LiveCard";
import { MeetingPrint } from "./MeetingPrint";

type View = "agenda" | "attendance";
const DEFAULT_MINUTES = 10;

function AgendaCard({
  item,
  index,
  count,
  slot,
  books,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  onPickPlays,
}: {
  item: AgendaItem;
  index: number;
  count: number;
  slot: { start: string; end: string } | null;
  books: Playbook[];
  onChange: (patch: Partial<AgendaItem>) => void;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onPickPlays: () => void;
}) {
  const { t } = useApp();
  const m = t.meetings;
  const id = useId();
  return (
    <li className="rounded-[var(--radius-card)] bg-night-850 p-3 shadow-[inset_0_0_0_1px_var(--color-hairline)] sm:p-4" aria-labelledby={`${id}-n`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 id={`${id}-n`} className="text-[0.82rem] font-semibold text-mist">
          {fill(m.item.number, { n: index + 1 })}
          {slot && <span className="tabular ml-2 text-chalk-dim">{`${slot.start}–${slot.end}`}</span>}
        </h3>
        <ItemActions index={index} count={count} labels={{ duplicate: m.item.duplicate, remove: m.item.remove }} onMove={onMove} onDuplicate={onDuplicate} onRemove={onRemove} />
      </div>
      <div className="mt-1 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <label className="block">
          <span className="sr-only">{m.item.title}</span>
          <input value={item.title} onChange={(e) => onChange({ title: e.target.value })} className={cn(bare, "h-11 text-[1.1rem] font-semibold")} />
        </label>
        <MinutesStepper value={item.minutes} onChange={(minutes) => onChange({ minutes })} />
      </div>
      <label className="mt-2 block">
        <span className="sr-only">{m.item.notes}</span>
        <textarea rows={2} value={item.notes} placeholder={m.item.notesPlaceholder} onChange={(e) => onChange({ notes: e.target.value })} className={cn(bare, "resize-y py-2 text-[0.95rem] leading-relaxed")} />
      </label>
      <div className="mt-2">
        <LinkedPlays plays={item.plays} books={books} onChange={(plays) => onChange({ plays })} onPick={onPickPlays} />
      </div>
    </li>
  );
}

export function MeetingPage({ eventId }: { eventId: string }) {
  const { t, locale } = useApp();
  const href = useHref();
  const hydrated = useHydrated();
  const { workspace, sport, roster } = useTeam();
  const events = useEvents(workspace?.id);
  const meetings = useMeetings(workspace?.id);
  const books = usePlaybooks(workspace?.id);
  const { live } = useLiveMeetings(workspace?.id);
  const { playerId } = useAccount();
  const [view, setView] = useState<View>("agenda");
  const [editingEvent, setEditingEvent] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const canEdit = useCanEdit();
  const fmt = useMemo(() => new Intl.DateTimeFormat(localeTags[locale].intl, { weekday: "long", day: "numeric", month: "long", year: "numeric" }), [locale]);

  if (!workspace || !hydrated) return null;
  if (!sport) return <CoachOnly />;

  const m = t.meetings;
  const back = (
    <a href={href("/panel/meetings")} className="inline-flex min-h-11 items-center gap-1.5 text-[0.92rem] font-medium text-chalk-dim hover:text-chalk">
      <Icon name="chevronLeft" className="size-4" />
      {m.back}
    </a>
  );
  const event = events.find((e) => e.id === eventId);
  if (!event || event.kind !== "meeting") {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:py-14">
        {back}
        <p className="mt-8 text-chalk-dim">{event ? m.notMeeting : m.notFound}</p>
      </div>
    );
  }

  const meeting = meetings[eventId] ?? emptyMeeting(eventId);
  const update = (change: (meeting: Meeting) => Meeting) => meetingRepo.update(workspace.id, eventId, change);
  const setAgenda = (change: (agenda: AgendaItem[]) => AgendaItem[]) => update((mt) => ({ ...mt, agenda: change(mt.agenda) }));
  const groups = meetingGroups(meeting.groups, sport);
  const invited = invitedPlayers(roster.players, groups, sport);
  const marks = attendanceCounts(meeting, invited.map((p) => p.id));
  const clock = periodClock(event.start, meeting.agenda);
  const date = fmt.format(parseDay(event.date));
  const pickingItem = meeting.agenda.find((it) => it.id === picking);
  const toggleGroup = (id: string) => update((mt) => ({ ...mt, groups: mt.groups.includes(id) ? mt.groups.filter((g) => g !== id) : [...mt.groups, id] }));

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:py-14">
      {back}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[0.9rem] font-semibold text-ice first-letter:uppercase">{date}</p>
          <h1 className="display mt-2 text-display-md">{event.title}</h1>
          <p className="mt-3 text-chalk-dim">{[timeRange(event, t.calendar.allDay), event.location || null].filter(Boolean).join(", ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EditOnly>
            <Button variant="ghost" onClick={() => setEditingEvent(true)}>
              <Icon name="pencil" className="size-[1.1rem]" />
              {t.practice.editEvent}
            </Button>
          </EditOnly>
          <Button variant="ghost" onClick={() => window.print()} disabled={meeting.agenda.length === 0}>
            <Icon name="printer" className="size-[1.1rem]" />
            {m.print}
          </Button>
        </div>
      </div>

      <LiveCard workspaceId={workspace.id} eventId={eventId} session={live[eventId]} isCoach={canEdit} invited={invited.some((p) => p.id === playerId)} />

      <div className="mt-10">
        <Tabs
          idBase="meeting"
          label={event.title}
          value={view}
          onChange={setView}
          tabs={[
            { value: "agenda", label: m.tabs.agenda },
            { value: "attendance", label: invited.length && marks.unmarked < invited.length ? `${m.tabs.attendance} ${marks.present + marks.late}/${invited.length}` : m.tabs.attendance },
          ]}
        />
      </div>

      <div id="meeting-panel" role="tabpanel" aria-labelledby={`meeting-tab-${view}`} className="mt-6">
        {view === "attendance" ? (
          <ReadOnlyScope>
            <AttendanceSheet plan={meeting} players={invited} sport={sport} empty={roster.players.length ? m.noInvited : undefined} onChange={(attendance) => update((mt) => ({ ...mt, attendance }))} />
          </ReadOnlyScope>
        ) : (
          <ReadOnlyScope>
          <div className="space-y-8">
            {!canEdit && (
              <p className="text-[0.95rem] text-chalk-dim">
                <span className="font-semibold text-chalk">{`${m.audience}: `}</span>
                {groups.length ? positionGroups(sport).filter((g) => groups.includes(g.id)).map((g) => g.name[locale]).join(", ") : m.wholeTeam}
              </p>
            )}
            {canEdit && (
            <fieldset>
              <legend className="text-[0.85rem] font-medium text-chalk-dim">{m.audience}</legend>
              <p className="mt-1 text-[0.82rem] text-mist">{m.audienceHint}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={groups.length === 0}
                  onClick={() => update((mt) => ({ ...mt, groups: [] }))}
                  className={cn("min-h-10 rounded-[0.6rem] px-3 text-[0.88rem] font-semibold transition-colors", groups.length === 0 ? "bg-chalk text-night-950" : "bg-chalk/6 text-chalk-dim hover:text-chalk")}
                >
                  {m.wholeTeam}
                </button>
                {positionGroups(sport).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={groups.includes(g.id)}
                    title={g.name[locale]}
                    onClick={() => toggleGroup(g.id)}
                    className={cn("min-h-10 min-w-12 rounded-[0.6rem] px-3 text-[0.88rem] font-semibold transition-colors", groups.includes(g.id) ? "bg-ice text-night-950" : "bg-chalk/6 text-chalk-dim hover:text-chalk")}
                  >
                    {g.abbr}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[0.88rem] text-chalk-dim">{plural(locale, m.invited, invited.length)}</p>
            </fieldset>
            )}

            <section aria-labelledby="agenda-title">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="agenda-title" className="text-[1.1rem] font-semibold">
                  {m.agenda}
                </h2>
                {meeting.agenda.length > 0 && <p className="text-[0.92rem] text-chalk-dim">{fill(t.practice.total, { minutes: totalMinutes(meeting.agenda) })}</p>}
              </div>
              {meeting.agenda.length === 0 ? (
                <p className="mt-4 text-[0.95rem] text-mist">{canEdit ? m.noItems : t.common.nothingYet}</p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {meeting.agenda.map((item, i) => (
                    <AgendaCard
                      key={item.id}
                      item={item}
                      index={i}
                      count={meeting.agenda.length}
                      slot={clock?.[i] ?? null}
                      books={books}
                      onChange={(patch) => setAgenda((list) => list.map((x) => (x.id === item.id ? { ...x, ...patch } : x)))}
                      onMove={(delta) => setAgenda((list) => move(list, list.findIndex((x) => x.id === item.id), delta))}
                      onDuplicate={() =>
                        setAgenda((list) => {
                          const at = list.findIndex((x) => x.id === item.id);
                          const copy = { ...item, id: newId("ag"), plays: item.plays.map((r) => ({ ...r })) };
                          return [...list.slice(0, at + 1), copy, ...list.slice(at + 1)];
                        })
                      }
                      onRemove={() => setAgenda((list) => list.filter((x) => x.id !== item.id))}
                      onPickPlays={() => setPicking(item.id)}
                    />
                  ))}
                </ol>
              )}
              <EditOnly>
                <Button variant="ghost" className="mt-4 h-10 px-3.5 text-[0.88rem]" onClick={() => setAgenda((list) => [...list, { id: newId("ag"), title: m.newItem, minutes: DEFAULT_MINUTES, notes: "", plays: [] }])}>
                  <Icon name="plus" className="size-4" />
                  {m.addItem}
                </Button>
              </EditOnly>
            </section>

            {(canEdit || meeting.notes) && <TextArea label={m.notes} placeholder={m.notesPlaceholder} value={meeting.notes} onChange={(notes) => update((mt) => ({ ...mt, notes }))} rows={5} />}
          </div>
          </ReadOnlyScope>
        )}
      </div>

      {editingEvent && canEdit && <EventDialog open onClose={() => setEditingEvent(false)} event={event} date={event.date} workspaceId={workspace.id} />}
      {pickingItem && canEdit && (
        <PlayPicker
          books={books}
          selected={pickingItem.plays}
          onClose={() => setPicking(null)}
          onPick={(refs) => setAgenda((list) => list.map((x) => (x.id === pickingItem.id ? { ...x, plays: refs } : x)))}
        />
      )}
      <MeetingPrint event={event} meeting={meeting} team={workspace.name} date={date} books={books} audience={groups.length ? positionGroups(sport).filter((g) => groups.includes(g.id)).map((g) => g.name[locale]).join(", ") : m.wholeTeam} />
    </div>
  );
}
