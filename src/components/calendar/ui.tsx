"use client";

import { useApp } from "@/components/app/AppContext";
import { Icon } from "@/components/ui/Icon";
import type { EventKind, TeamEvent } from "@/domain/team/calendar";
import { cn } from "@/lib/cn";

/** One colour per kind of event, the same in the grid, the lists and the dashboard. */
export const KIND_TONE: Record<EventKind, { dot: string; chip: string; bar: string }> = {
  practice: { dot: "bg-volt", chip: "bg-volt/12 hover:bg-volt/22", bar: "before:bg-volt" },
  game: { dot: "bg-signal", chip: "bg-signal/15 hover:bg-signal/25", bar: "before:bg-signal" },
  meeting: { dot: "bg-ice", chip: "bg-ice/12 hover:bg-ice/22", bar: "before:bg-ice" },
  other: { dot: "bg-amber", chip: "bg-amber/12 hover:bg-amber/22", bar: "before:bg-amber" },
};

export function KindDot({ kind, className }: { kind: EventKind; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", KIND_TONE[kind].dot, className)} />;
}

export function timeRange(e: Pick<TeamEvent, "start" | "end">, allDay: string) {
  if (!e.start) return allDay;
  return e.end ? `${e.start}–${e.end}` : e.start;
}

/**
 * An event as a row: time, title, and what kind of event it is and where. `link` leads to what
 * hangs off the event (a practice's plan).
 */
export function EventRow({ event, onOpen, link, readOnly }: { event: TeamEvent; onOpen: () => void; link?: { href: string; label: string } | null; readOnly?: boolean }) {
  const { t } = useApp();
  const c = t.calendar;
  const meta = [
    // The kind, unless the title already says it ("Antrenman").
    event.title.toLocaleLowerCase() === c.kinds[event.kind].toLocaleLowerCase() ? null : c.kinds[event.kind],
    event.kind === "game" && event.venue ? c.venues[event.venue] : null,
    event.location || null,
    event.seriesId ? c.series : null,
  ].filter(Boolean);
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "relative flex min-w-0 flex-1 items-start gap-4 rounded-[0.8rem] py-3 pr-3 pl-5 text-left transition-colors before:absolute before:top-3 before:bottom-3 before:left-2 before:w-[3px] before:rounded-full hover:bg-chalk/5",
          KIND_TONE[event.kind].bar,
        )}
      >
        <span className="tabular w-[5.6rem] shrink-0 pt-0.5 text-[0.9rem] font-semibold text-chalk-dim">{timeRange(event, c.allDay)}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{event.title}</span>
          <span className="mt-0.5 block text-[0.85rem] text-mist">{meta.join(", ")}</span>
        </span>
        <Icon name={readOnly ? "info" : "pencil"} className="mt-1 size-4 shrink-0 text-mist" />
      </button>
      {link && (
        <a
          href={link.href}
          aria-label={`${link.label}: ${event.title}`}
          className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-[0.6rem] px-3 text-[0.85rem] font-semibold text-chalk-dim shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] transition-colors hover:bg-chalk/6 hover:text-chalk"
        >
          {link.label}
          <Icon name="chevronLeft" className="size-3.5 rotate-180" />
        </a>
      )}
    </div>
  );
}
