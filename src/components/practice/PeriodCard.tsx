"use client";

import { useId } from "react";
import { useCanEdit } from "@/components/app/access";
import { useApp } from "@/components/app/AppContext";
import { IconButton } from "@/components/app/ui";
import { Select } from "@/components/team/ui";
import { Icon } from "@/components/ui/Icon";
import type { Playbook } from "@/domain/playbook/types";
import type { SportId } from "@/domain/sports/types";
import { unitsFor, type Period, type Unit } from "@/domain/team/practice";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";
import { LinkedPlays, MinutesStepper, bare } from "./parts";

/** One colour per unit: the bar beside each period and its slice of the timeline. */
export const UNIT_TONE: Record<Unit, string> = {
  team: "bg-chalk",
  offense: "bg-volt",
  defense: "bg-signal",
  special: "bg-amber",
  individual: "bg-ice",
};

/** Reorder, copy and delete for one item of a list; `labels` name the copy and delete actions. */
export function ItemActions({
  index,
  count,
  labels,
  onMove,
  onDuplicate,
  onRemove,
}: {
  index: number;
  count: number;
  labels: { duplicate?: string; remove: string };
  onMove: (delta: -1 | 1) => void;
  onDuplicate?: () => void;
  onRemove: () => void;
}) {
  const { t } = useApp();
  if (!useCanEdit()) return null;
  return (
    <span className="ml-auto flex">
      <IconButton label={t.common.moveUp} disabled={index === 0} onClick={() => onMove(-1)} className="size-9">
        <Icon name="arrowDown" className="size-4 rotate-180" />
      </IconButton>
      <IconButton label={t.common.moveDown} disabled={index === count - 1} onClick={() => onMove(1)} className="size-9">
        <Icon name="arrowDown" className="size-4" />
      </IconButton>
      {onDuplicate && labels.duplicate && (
        <IconButton label={labels.duplicate} onClick={onDuplicate} className="size-9">
          <Icon name="copy" className="size-4" />
        </IconButton>
      )}
      <IconButton label={labels.remove} onClick={onRemove} className="size-9 hover:text-signal">
        <Icon name="trash" className="size-4" />
      </IconButton>
    </span>
  );
}

export function PeriodCard({
  period,
  index,
  count,
  slot,
  sport,
  books,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  onPickPlays,
}: {
  period: Period;
  index: number;
  count: number;
  /** When it runs, if the practice has a start time. */
  slot: { start: string; end: string } | null;
  sport: SportId;
  books: Playbook[];
  onChange: (patch: Partial<Period>) => void;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onPickPlays: () => void;
}) {
  const { t } = useApp();
  const p = t.practice;
  const id = useId();

  return (
    <li className="relative flex gap-3 rounded-[var(--radius-card)] bg-night-850 p-3 shadow-[inset_0_0_0_1px_var(--color-hairline)] sm:gap-4 sm:p-4" aria-labelledby={`${id}-n`}>
      <span aria-hidden="true" className={cn("w-1 shrink-0 self-stretch rounded-full", UNIT_TONE[period.unit])} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 id={`${id}-n`} className="text-[0.82rem] font-semibold text-mist">
            {fill(p.period.number, { n: index + 1 })}
            {slot && <span className="tabular ml-2 text-chalk-dim">{`${slot.start}–${slot.end}`}</span>}
          </h3>
          <ItemActions index={index} count={count} labels={{ duplicate: p.period.duplicate, remove: p.period.remove }} onMove={onMove} onDuplicate={onDuplicate} onRemove={onRemove} />
        </div>

        <div className="mt-1 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_11rem] sm:items-center">
          <label className="block">
            <span className="sr-only">{p.period.name}</span>
            <input value={period.name} onChange={(e) => onChange({ name: e.target.value })} className={cn(bare, "h-11 text-[1.1rem] font-semibold")} />
          </label>
          <MinutesStepper value={period.minutes} onChange={(minutes) => onChange({ minutes })} />
          <Select hideLabel label={p.period.unit} value={period.unit} onChange={(unit) => onChange({ unit })} options={unitsFor(sport).map((u) => ({ value: u, label: p.units[u] }))} />
        </div>

        <label className="mt-2 block">
          <span className="sr-only">{p.period.drill}</span>
          <textarea
            rows={2}
            value={period.drill}
            placeholder={p.period.drillPlaceholder}
            onChange={(e) => onChange({ drill: e.target.value })}
            className={cn(bare, "resize-y py-2 text-[0.95rem] leading-relaxed")}
          />
        </label>

        <div className="mt-2">
          <LinkedPlays plays={period.plays} books={books} onChange={(plays) => onChange({ plays })} onPick={onPickPlays} />
        </div>
      </div>
    </li>
  );
}
