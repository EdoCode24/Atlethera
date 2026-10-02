"use client";

import { useCanEdit } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { IconButton } from "@/components/app/ui";
import { PlayThumb } from "@/components/playbook/PlayThumb";
import { Icon } from "@/components/ui/Icon";
import type { Play, Playbook } from "@/domain/playbook/types";
import { MINUTES, clampMinutes, type PlayRef } from "@/domain/team/practice";
import { fill } from "@/lib/fill";

/** Pieces shared by practice periods and meeting agenda items. */

/** A field that reads as plain text until it is hovered or focused. */
export const bare =
  "w-full rounded-[0.6rem] bg-transparent px-2 text-chalk outline-none transition-shadow placeholder:text-mist/70 hover:shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] focus:bg-night-950/60 focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]";

export function resolvePlay(books: Playbook[], ref: PlayRef): { book: Playbook; play: Play } | null {
  const book = books.find((b) => b.id === ref.playbookId);
  const play = book?.plays.find((p) => p.id === ref.playId);
  return book && play ? { book, play } : null;
}

/** Minutes in steps of five, or typed. */
export function MinutesStepper({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const { t } = useApp();
  const p = t.practice;
  const set = (n: number) => onChange(clampMinutes(n));
  return (
    <div className="flex items-center gap-1">
      <IconButton label={p.period.less} disabled={value <= MINUTES.min} onClick={() => set(value - MINUTES.step)} className="size-9" data-edit-control>
        <Icon name="minus" className="size-4" />
      </IconButton>
      <label className="flex items-baseline gap-1">
        <span className="sr-only">{p.period.minutes}</span>
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, ""));
            if (n) set(n);
          }}
          className="tabular h-10 w-12 rounded-[0.6rem] bg-night-950/60 text-center text-[1rem] font-semibold text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]"
        />
      </label>
      <span aria-hidden="true" className="text-[0.85rem] text-mist">
        {p.minuteUnit}
      </span>
      <IconButton label={p.period.more} disabled={value >= MINUTES.max} onClick={() => set(value + MINUTES.step)} className="size-9" data-edit-control>
        <Icon name="plus" className="size-4" />
      </IconButton>
    </div>
  );
}

/** The plays linked to a period or agenda item, each opening in the playbook, and a way to link more. */
export function LinkedPlays({ plays, books, onChange, onPick }: { plays: PlayRef[]; books: Playbook[]; onChange: (plays: PlayRef[]) => void; onPick: () => void }) {
  const { t } = useApp();
  const href = useHref();
  const canEdit = useCanEdit();
  const p = t.practice;
  if (!canEdit && plays.length === 0) return null;
  return (
    <div className="flex flex-wrap items-stretch gap-2 px-2">
      {plays.map((ref) => {
        const found = resolvePlay(books, ref);
        const name = found?.play.name ?? p.period.missingPlay;
        return (
          <span key={`${ref.playbookId}/${ref.playId}`} className="relative w-36 overflow-hidden rounded-[0.7rem] bg-night-900 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]">
            {found ? (
              <a href={href(`/panel/playbook/${ref.playbookId}/${ref.playId}`)} className="block hover:opacity-90">
                <PlayThumb book={found.book} play={found.play} className="pointer-events-none block aspect-[4/2.8] w-full" />
                <span className="block truncate px-2 py-1.5 pr-8 text-[0.78rem] font-semibold">{name}</span>
              </a>
            ) : (
              <span className="block px-2 py-1.5 pr-8 text-[0.78rem] text-mist">{name}</span>
            )}
            {canEdit && (
              <button
                type="button"
                aria-label={fill(p.period.removePlay, { name })}
                onClick={() => onChange(plays.filter((r) => r !== ref))}
                className="absolute right-0.5 bottom-0 grid size-8 place-items-center rounded-full text-mist hover:text-chalk"
              >
                <Icon name="close" className="size-3.5" />
              </button>
            )}
          </span>
        );
      })}
      {canEdit && (
        <button
          type="button"
          onClick={onPick}
          className="inline-flex min-h-10 items-center gap-2 self-center rounded-[0.7rem] px-3 text-[0.88rem] font-semibold text-chalk-dim shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] hover:bg-chalk/6 hover:text-chalk"
        >
          <Icon name="playbook" className="size-4" />
          {p.period.addPlays}
        </button>
      )}
    </div>
  );
}
