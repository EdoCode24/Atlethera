"use client";

import { useMemo } from "react";
import { useApp } from "@/components/app/AppContext";
import { Button, Dialog } from "@/components/app/ui";
import { Icon } from "@/components/ui/Icon";
import { parseDay, type TeamEvent } from "@/domain/team/calendar";
import { localeTags } from "@/i18n/config";
import { KindDot, timeRange } from "./ui";

/** An event as a player sees it: when, where, against whom, and a way to its own page. */
export function EventDetails({ event, link, onClose }: { event: TeamEvent; link: { href: string; label: string } | null; onClose: () => void }) {
  const { t, locale } = useApp();
  const c = t.calendar;
  const day = useMemo(() => new Intl.DateTimeFormat(localeTags[locale].intl, { weekday: "long", day: "numeric", month: "long", year: "numeric" }), [locale]);
  const rows: [string, string][] = [
    [c.form.kind, c.kinds[event.kind]],
    [c.form.date, day.format(parseDay(event.date))],
    [c.form.start, timeRange(event, c.allDay)],
    ...(event.kind === "game" && event.opponent ? ([[c.form.opponent, event.opponent]] as [string, string][]) : []),
    ...(event.kind === "game" && event.venue ? ([[c.form.venue, c.venues[event.venue]]] as [string, string][]) : []),
    ...(event.location ? ([[c.form.location, event.location]] as [string, string][]) : []),
  ];
  return (
    <Dialog
      open
      onClose={onClose}
      title={event.title}
      footer={
        <>
          {link && (
            <a href={link.href} className="inline-flex h-11 items-center gap-2 rounded-[0.7rem] bg-volt px-5 font-semibold text-night-950 hover:bg-volt-soft">
              {link.label}
              <Icon name="chevronLeft" className="size-4 rotate-180" />
            </a>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t.common.close}
          </Button>
        </>
      }
    >
      <p className="flex items-center gap-2 text-[0.9rem] text-chalk-dim">
        <KindDot kind={event.kind} />
        {c.kinds[event.kind]}
        {event.seriesId && <span className="text-mist">{`, ${c.series}`}</span>}
      </p>
      <dl className="mt-4 divide-y divide-hairline">
        {rows.slice(1).map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-[0.9rem] text-chalk-dim">{label}</dt>
            <dd className="text-right font-medium first-letter:uppercase">{value}</dd>
          </div>
        ))}
      </dl>
      {event.notes && <p className="mt-4 text-[0.95rem] whitespace-pre-line text-chalk-dim">{event.notes}</p>}
    </Dialog>
  );
}
