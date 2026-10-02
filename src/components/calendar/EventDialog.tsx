"use client";

import { useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Button, Choice, Dialog, TextArea, TextField } from "@/components/app/ui";
import { Checkbox } from "@/components/team/ui";
import { Icon } from "@/components/ui/Icon";
import { calendarRepo } from "@/data/calendar";
import { EVENT_KINDS, VENUES, addDays, validateEvent, weeklyDates, type EventError, type EventInput, type EventKind, type TeamEvent, type Venue } from "@/domain/team/calendar";
import { fill } from "@/lib/fill";
import { plural } from "@/lib/plural";

/**
 * Adds an event (once, or weekly through a last date) or edits one. Mount it with a `key` per
 * event so the fields start from that event's values.
 */
export function EventDialog({
  open,
  onClose,
  event,
  date,
  workspaceId,
  kind: onlyKind,
  onAdded,
  title: newTitle,
}: {
  open: boolean;
  onClose: () => void;
  /** The event to edit; null adds one on `date`. */
  event: TeamEvent | null;
  date: string;
  workspaceId: string;
  /** Adds only this kind of event (the practice page adds practices). */
  kind?: EventKind;
  onAdded?: (events: TeamEvent[]) => void;
  /** The dialog's title when adding. */
  title?: string;
}) {
  const { t, locale } = useApp();
  const c = t.calendar;
  const f = c.form;
  const [kind, setKind] = useState<EventKind>(event?.kind ?? onlyKind ?? "practice");
  // A new event's title follows its kind until the coach types one.
  const [title, setTitle] = useState<string | null>(event?.title ?? null);
  const [day, setDay] = useState(event?.date ?? date);
  const [start, setStart] = useState(event?.start ?? "");
  const [end, setEnd] = useState(event?.end ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [opponent, setOpponent] = useState(event?.opponent ?? "");
  const [venue, setVenue] = useState<Venue>(event?.venue ?? "home");
  const [repeat, setRepeat] = useState(false);
  const [until, setUntil] = useState(() => addDays(date, 7 * 11));
  const [errors, setErrors] = useState<EventError[]>([]);
  const [confirming, setConfirming] = useState(false);

  const autoTitle = kind === "game" ? (opponent.trim() ? fill(c.gameTitle, { opponent: opponent.trim() }) : "") : c.kinds[kind];
  const shownTitle = title ?? autoTitle;
  const error = (e: EventError) => (errors.includes(e) ? f.errors[e] : null);
  const touched = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setErrors([]);
  };

  const input = (): EventInput => ({
    kind,
    title: shownTitle.trim() || autoTitle,
    date: day,
    start: start || null,
    end: end || null,
    location,
    notes,
    opponent,
    venue: kind === "game" ? venue : null,
  });

  const save = () => {
    const value = input();
    const problems = validateEvent(value, !event && repeat ? until : null);
    if (problems.length) {
      setErrors(problems);
      return;
    }
    if (event) calendarRepo.update(workspaceId, event.id, value);
    else {
      // Added first: `onAdded?.(add())` would skip the add when there is no callback.
      const added = calendarRepo.add(workspaceId, value, repeat ? until : null);
      onAdded?.(added);
    }
    onClose();
  };

  const remove = (scope: "one" | "following") => {
    if (event) calendarRepo.remove(workspaceId, event.id, scope);
    onClose();
  };

  const repeats = repeat && until >= day ? weeklyDates(day, until).length : 0;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        onSubmit={save}
        wide
        title={event ? f.titleEdit : (newTitle ?? f.titleNew)}
        footer={
          <>
            {event && (
              <Button variant="ghost" className="mr-auto text-signal" onClick={() => setConfirming(true)}>
                <Icon name="trash" className="size-[1.1rem]" />
                {f.deleteTitle}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit">{event ? t.common.save : f.add}</Button>
          </>
        }
      >
        <div className="space-y-6">
          {!onlyKind && <Choice label={f.kind} value={kind} onChange={touched(setKind)} options={EVENT_KINDS.map((k) => ({ value: k, label: c.kinds[k] }))} />}

          {kind === "game" && (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <TextField label={f.opponent} placeholder={f.opponentPlaceholder} value={opponent} onChange={(e) => touched(setOpponent)(e.target.value)} autoComplete="off" />
              <Choice label={f.venue} value={venue} onChange={setVenue} options={VENUES.map((v) => ({ value: v, label: c.venues[v] }))} />
            </div>
          )}

          <TextField
            label={f.title}
            value={shownTitle}
            placeholder={kind === "game" ? fill(c.gameTitle, { opponent: f.opponent }) : undefined}
            onChange={(e) => touched(setTitle)(e.target.value)}
            error={error("titleRequired")}
            autoComplete="off"
            autoFocus={kind !== "game"}
          />

          <div>
            <div className="grid gap-4 sm:grid-cols-[1fr_9rem_9rem]">
              <TextField label={f.date} type="date" value={day} onChange={(e) => touched(setDay)(e.target.value)} error={error("dateInvalid")} />
              <TextField label={f.start} type="time" value={start} onChange={(e) => touched(setStart)(e.target.value)} />
              <TextField label={f.end} type="time" value={end} onChange={(e) => touched(setEnd)(e.target.value)} />
            </div>
            <p className={errors.some((e) => e === "timeInvalid" || e === "endBeforeStart") ? "mt-1.5 text-[0.82rem] text-signal" : "mt-1.5 text-[0.82rem] text-mist"}>
              {error("timeInvalid") ?? error("endBeforeStart") ?? f.timeHint}
            </p>
          </div>

          {!event && (
            <div>
              <Checkbox label={f.repeat} checked={repeat} onChange={touched(setRepeat)} />
              {repeat && (
                <div className="mt-2 grid items-end gap-x-4 gap-y-2 sm:grid-cols-[1fr_1fr]">
                  <TextField label={f.until} type="date" value={until} min={day} onChange={(e) => touched(setUntil)(e.target.value)} error={error("untilInvalid") ?? error("tooMany")} />
                  {repeats > 0 && <p className="text-[0.9rem] text-chalk-dim sm:pb-3.5">{plural(locale, f.repeatCount, repeats)}</p>}
                </div>
              )}
            </div>
          )}

          <TextField label={f.location} placeholder={f.locationPlaceholder} value={location} onChange={(e) => setLocation(e.target.value)} autoComplete="off" />
          <TextArea label={f.notes} value={notes} onChange={setNotes} />
        </div>
      </Dialog>

      {event && (
        <Dialog
          open={open && confirming}
          onClose={() => setConfirming(false)}
          title={f.deleteTitle}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                {t.common.cancel}
              </Button>
              {event.seriesId && (
                <Button variant="ghost" className="text-signal" onClick={() => remove("following")}>
                  {f.deleteFollowing}
                </Button>
              )}
              <Button variant="danger" onClick={() => remove("one")}>
                {event.seriesId ? f.deleteOne : t.common.delete}
              </Button>
            </>
          }
        >
          <p className="text-chalk-dim">{fill(f.deleteConfirm, { title: event.title })}</p>
          {event.seriesId && <p className="mt-2 text-[0.9rem] text-mist">{f.seriesNote}</p>}
        </Dialog>
      )}
    </>
  );
}
