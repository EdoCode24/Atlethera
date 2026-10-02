"use client";

import { useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Button, Dialog } from "@/components/app/ui";
import { PlayThumb } from "@/components/playbook/PlayThumb";
import { Icon } from "@/components/ui/Icon";
import { sidesFor } from "@/domain/playbook/factory";
import type { Playbook } from "@/domain/playbook/types";
import type { PlayRef } from "@/domain/team/practice";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";

const same = (a: PlayRef, b: PlayRef) => a.playbookId === b.playbookId && a.playId === b.playId;

/** Picks the playbook plays a period runs; the choice is kept only when the coach confirms it. */
export function PlayPicker({ books, selected, onClose, onPick }: { books: Playbook[]; selected: PlayRef[]; onClose: () => void; onPick: (refs: PlayRef[]) => void }) {
  const { t, locale } = useApp();
  const p = t.practice.picker;
  const [refs, setRefs] = useState(selected);
  const toggle = (ref: PlayRef) => setRefs((list) => (list.some((r) => same(r, ref)) ? list.filter((r) => !same(r, ref)) : [...list, ref]));
  const withPlays = books.filter((b) => b.plays.length > 0);

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={p.title}
      footer={
        <>
          <span className="mr-auto self-center text-[0.9rem] text-mist">{plural(locale, p.selected, refs.length)}</span>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            onClick={() => {
              onPick(refs);
              onClose();
            }}
          >
            {t.common.done}
          </Button>
        </>
      }
    >
      {withPlays.length === 0 ? (
        <p className="text-chalk-dim">{p.empty}</p>
      ) : (
        <div className="space-y-8">
          <p className="text-[0.95rem] text-chalk-dim">{p.body}</p>
          {withPlays.map((book) => (
            <section key={book.id} aria-label={book.name}>
              {withPlays.length > 1 && <h3 className="text-[1rem] font-semibold">{book.name}</h3>}
              {sidesFor(book.sport)
                .map((side) => ({ side, plays: book.plays.filter((pl) => pl.side === side) }))
                .filter((g) => g.plays.length > 0)
                .map(({ side, plays }) => (
                  <div key={side} className="mt-3">
                    <h4 className="text-[0.85rem] font-medium text-mist">{t.playbook.sides[side]}</h4>
                    <ul className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {plays.map((play) => {
                        const ref = { playbookId: book.id, playId: play.id };
                        const on = refs.some((r) => same(r, ref));
                        return (
                          <li key={play.id}>
                            <button
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggle(ref)}
                              className={cn(
                                "relative block w-full overflow-hidden rounded-[0.9rem] bg-night-900 text-left transition-shadow",
                                on ? "shadow-[inset_0_0_0_2px_var(--color-volt)]" : "shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] hover:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]",
                              )}
                            >
                              <PlayThumb book={book} play={play} className="pointer-events-none block aspect-[4/2.8] w-full" />
                              <span className="flex items-center gap-2 px-2.5 py-2">
                                <span className="min-w-0 flex-1 truncate text-[0.85rem] font-semibold">{play.name}</span>
                                <span className={cn("grid size-5 shrink-0 place-items-center rounded-full", on ? "bg-volt text-night-950" : "shadow-[inset_0_0_0_1.5px_var(--color-hairline-strong)]")}>
                                  {on && <Icon name="check" className="size-3.5" />}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
            </section>
          ))}
        </div>
      )}
    </Dialog>
  );
}
