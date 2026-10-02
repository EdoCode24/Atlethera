"use client";

import { useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { result, type GameStats, type Result } from "@/domain/team/stats";
import { cn } from "@/lib/cn";

const RESULT_TONE: Record<Result, string> = {
  win: "bg-volt text-night-950",
  loss: "bg-signal text-night-950",
  tie: "bg-chalk/15 text-chalk",
};

/** W / L / T as a small badge, named in full for screen readers. */
export function ResultBadge({ game }: { game: Pick<GameStats, "us" | "them"> }) {
  const { t } = useApp();
  const r = result(game);
  if (!r) return null;
  return (
    <span title={t.stats.resultNames[r]} className={cn("grid size-7 place-items-center rounded-md text-[0.8rem] font-bold", RESULT_TONE[r])}>
      <span aria-hidden="true">{t.stats.results[r]}</span>
      <span className="sr-only">{t.stats.resultNames[r]}</span>
    </span>
  );
}

/** "3-1", with ties only when there are any. */
export const recordText = (r: { win: number; loss: number; tie: number }) => (r.tie ? `${r.win}-${r.loss}-${r.tie}` : `${r.win}-${r.loss}`);

/** Parses what was typed: whole numbers, negatives only where allowed, decimals only where allowed. */
function parse(s: string, negative: boolean, decimals: boolean): number | null {
  const text = s.trim().replace(",", ".");
  const pattern = negative ? (decimals ? /^-?\d+(\.\d+)?$/ : /^-?\d+$/) : decimals ? /^\d+(\.\d+)?$/ : /^\d+$/;
  return pattern.test(text) ? Number(text) : null;
}

/**
 * A number typed into a table cell. What is typed stays as typed while the cell is focused ("-"
 * on the way to "-4"); the value is saved whenever it reads as a number, and cleared when empty.
 */
export function NumberCell({
  value,
  onChange,
  label,
  negative = false,
  decimals = false,
  large = false,
  warn = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  negative?: boolean;
  decimals?: boolean;
  /** The big score box instead of a table cell. */
  large?: boolean;
  /** A reading that parses but looks unlikely: ringed in amber. */
  warn?: boolean;
}) {
  const { locale } = useApp();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : locale === "tr" ? String(value).replace(".", ",") : String(value));
  const invalid = draft !== null && draft.trim() !== "" && parse(draft, negative, decimals) === null;
  return (
    <input
      aria-label={label}
      aria-invalid={invalid || undefined}
      inputMode={decimals ? "decimal" : "numeric"}
      value={shown}
      onChange={(e) => {
        const s = e.target.value;
        setDraft(s);
        if (s.trim() === "") onChange(null);
        else {
          const n = parse(s, negative, decimals);
          if (n !== null) onChange(n);
        }
      }}
      onBlur={() => setDraft(null)}
      className={cn(
        "tabular rounded-[0.55rem] bg-night-950/60 text-chalk outline-none",
        large ? "display h-14 w-20 text-center text-[2rem]" : "h-10 w-16 px-2 text-right text-[0.95rem]",
        // One ring at a time: two shadow classes on one element don't reliably override each other.
        invalid
          ? "shadow-[inset_0_0_0_1.5px_var(--color-signal)]"
          : warn
            ? "shadow-[inset_0_0_0_1.5px_var(--color-amber)]"
            : "shadow-[inset_0_0_0_1px_var(--color-hairline)] focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]",
      )}
    />
  );
}
