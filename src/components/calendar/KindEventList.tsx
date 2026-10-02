"use client";

import { useMemo, useState, type ReactNode } from "react";
import { EditOnly, useCanEdit } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button } from "@/components/app/ui";
import { useTeam, useToday } from "@/components/team/hooks";
import { CoachOnly, ModuleHeader, panel } from "@/components/team/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useEvents } from "@/data/calendar";
import { useHydrated } from "@/data/store";
import { sports } from "@/domain/sports";
import { parseDay, sortEvents, type EventKind, type TeamEvent } from "@/domain/team/calendar";
import { localeTags } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { EventDialog } from "./EventDialog";
import { timeRange } from "./ui";

/** Past events shown before the list stops. */
const PAST = 12;

/**
 * The events of one kind on the calendar (practices, meetings), upcoming then past, each leading
 * to its own page under `path`. Adding one here adds it to the calendar and opens its page.
 */
export function KindEventList({
  kind,
  path,
  title,
  body,
  addLabel,
  empty,
  icon,
  summary,
}: {
  kind: EventKind;
  path: string;
  title: string;
  body: string;
  addLabel: string;
  empty: string;
  icon: IconName;
  /** What the event's page holds so far, shown on its row. */
  summary: (event: TeamEvent) => ReactNode;
}) {
  const { t, locale } = useApp();
  const href = useHref();
  const hydrated = useHydrated();
  const today = useToday();
  const { workspace, sport } = useTeam();
  const events = useEvents(workspace?.id);
  const [adding, setAdding] = useState(false);
  const canEdit = useCanEdit();
  const day = useMemo(() => new Intl.DateTimeFormat(localeTags[locale].intl, { weekday: "long", day: "numeric", month: "long" }), [locale]);

  if (!workspace || !hydrated || !today) return null;
  if (!sport) return <CoachOnly />;

  const c = t.calendar;
  const all = sortEvents(events.filter((e) => e.kind === kind));
  const upcoming = all.filter((e) => e.date >= today);
  const past = all.filter((e) => e.date < today).reverse().slice(0, PAST);

  const row = (e: TeamEvent) => (
    <li key={e.id}>
      <a href={href(`${path}/${e.id}`)} className="group flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3.5 transition-colors hover:bg-chalk/[0.03] sm:px-5">
        <span className="min-w-0 flex-1 basis-60">
          <span className="block font-semibold first-letter:uppercase group-hover:underline">{day.format(parseDay(e.date))}</span>
          <span className="mt-0.5 block text-[0.88rem] text-mist">{[timeRange(e, c.allDay), e.title !== c.kinds[kind] ? e.title : null, e.location || null].filter(Boolean).join(", ")}</span>
        </span>
        {summary(e)}
        <Icon name="chevronLeft" className="size-4 rotate-180 text-mist" />
      </a>
    </li>
  );

  const section = (id: string, heading: string, list: TeamEvent[]) =>
    list.length > 0 && (
      <section aria-labelledby={id}>
        <h2 id={id} className="text-[1.1rem] font-semibold">
          {heading}
        </h2>
        <ul className={cn(panel, "mt-3 divide-y divide-hairline overflow-hidden rounded-[var(--radius-card)]")}>{list.map(row)}</ul>
      </section>
    );

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:py-14">
      <ModuleHeader
        eyebrow={sports[sport].name[locale]}
        title={title}
        body={body}
        actions={
          canEdit && (
            <Button onClick={() => setAdding(true)}>
              <Icon name="plus" className="size-5" />
              {addLabel}
            </Button>
          )
        }
      />

      {all.length === 0 ? (
        <div className={cn(panel, "mt-10 p-8 text-center")}>
          <Icon name={icon} className="mx-auto size-8 text-mist" />
          <p className="mx-auto mt-4 max-w-[30rem] text-chalk-dim">{canEdit ? empty : t.common.nothingYet}</p>
          <EditOnly>
            <Button className="mt-6" onClick={() => setAdding(true)}>
              {addLabel}
            </Button>
          </EditOnly>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          {section(`${kind}-upcoming`, c.upcomingHeading, upcoming)}
          {section(`${kind}-past`, c.pastHeading, past)}
        </div>
      )}

      {adding && canEdit && (
        <EventDialog
          open
          onClose={() => setAdding(false)}
          event={null}
          date={today}
          kind={kind}
          title={addLabel}
          workspaceId={workspace.id}
          onAdded={(added) => window.location.assign(href(`${path}/${added[0].id}`))}
        />
      )}
    </div>
  );
}
