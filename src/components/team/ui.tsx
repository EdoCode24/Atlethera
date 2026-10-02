"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useApp } from "@/components/app/AppContext";
import type { PlayerStatus } from "@/domain/team/roster";
import { cn } from "@/lib/cn";

/** The top of a Coach module page: the sport in volt, the title, what the page is for, and its actions. */
export function ModuleHeader({ eyebrow, title, body, actions }: { eyebrow: string; title: string; body: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="text-[0.9rem] font-semibold text-volt">{eyebrow}</p>
        <h1 className="display mt-2 text-display-md">{title}</h1>
        <p className="mt-3 max-w-[40rem] text-chalk-dim">{body}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const panel = "rounded-[var(--radius-panel)] bg-night-850 shadow-[inset_0_0_0_1px_var(--color-hairline)]";

/** A native select dressed like the text fields. The label can be visually hidden in filter bars. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("block", className)}>
      <span className={hideLabel ? "sr-only" : "text-[0.85rem] font-medium text-chalk-dim"}>{label}</span>
      <span className={cn("relative block", !hideLabel && "mt-2")}>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="h-11 w-full cursor-pointer appearance-none rounded-[0.7rem] bg-night-950/70 pr-9 pl-3.5 text-[0.92rem] text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-night-900">
              {o.label}
            </option>
          ))}
        </select>
        <svg viewBox="0 0 24 24" aria-hidden="true" data-edit-control className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-mist">
          <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </label>
  );
}

export function SearchField({ label, value, onChange, placeholder, className }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("relative block", className)}>
      <span className="sr-only">{label}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-mist">
        <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-[0.7rem] bg-night-950/70 pr-3 pl-10 text-[0.95rem] text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] outline-none placeholder:text-mist/70 focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]"
      />
    </label>
  );
}

/** Tabs with the keyboard behaviour of a tablist: arrows, Home and End move between them. */
export function Tabs<T extends string>({ label, value, tabs, onChange, idBase }: { label: string; value: T; tabs: { value: T; label: string }[]; onChange: (v: T) => void; idBase: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const last = tabs.length - 1;
    const next = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="inline-flex gap-1 rounded-[0.8rem] bg-night-900 p-1 shadow-[inset_0_0_0_1px_var(--color-hairline)]">
      {tabs.map((tab, i) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${tab.value}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "min-h-10 rounded-[0.6rem] px-4 text-[0.92rem] font-semibold whitespace-nowrap transition-colors",
              selected ? "bg-chalk text-night-950" : "text-chalk-dim hover:text-chalk",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

const STATUS_TONE: Record<PlayerStatus, string> = {
  active: "bg-volt",
  injured: "bg-signal",
  inactive: "bg-mist/60",
};

export function StatusBadge({ status, quiet }: { status: PlayerStatus; quiet?: boolean }) {
  const { t } = useApp();
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[0.85rem] font-medium", status === "injured" ? "text-signal" : status === "inactive" ? "text-mist" : quiet ? "text-mist" : "text-chalk-dim")}>
      <span aria-hidden="true" className={cn("size-2 rounded-full", STATUS_TONE[status])} />
      {t.roster.statuses[status]}
    </span>
  );
}

/** The jersey number in the display face, or a dash when none is given. */
export function Jersey({ number, className }: { number: number | null; className?: string }) {
  return <span className={cn("display tabular", number === null && "text-mist/60", className)}>{number ?? "–"}</span>;
}

export function PositionChips({ positions, className }: { positions: string[]; className?: string }) {
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {positions.map((p, i) => (
        <span key={p} className={cn("rounded-[var(--radius-chip)] px-1.5 py-0.5 text-[0.78rem] font-semibold", i === 0 ? "bg-chalk/12 text-chalk" : "text-mist shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]")}>
          {p}
        </span>
      ))}
    </span>
  );
}

export function CoachOnly() {
  const { t } = useApp();
  return <p className="px-8 py-14 text-chalk-dim">{t.common.coachOnly}</p>;
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-[0.95rem] font-medium">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 cursor-pointer accent-[var(--color-volt)]" />
      {label}
    </label>
  );
}
