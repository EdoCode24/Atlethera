"use client";

import { useId, useMemo, useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Button, Dialog } from "@/components/app/ui";
import { rosterRepo } from "@/data/roster";
import { parseBulk, type PlayerInput } from "@/domain/team/roster";
import type { SportId } from "@/domain/sports/types";
import { fill } from "@/lib/fill";
import { plural } from "@/lib/plural";
import { Jersey, PositionChips } from "./ui";

/** Pastes a list (from a sheet, a message, a note) and adds every line that names a player. */
export function BulkAddDialog({ open, onClose, sport, workspaceId }: { open: boolean; onClose: () => void; sport: SportId; workspaceId: string }) {
  const { t, locale } = useApp();
  const b = t.roster.bulk;
  const id = useId();
  const [text, setText] = useState("");
  const lines = useMemo(() => parseBulk(text, sport, locale), [text, sport, locale]);
  const players = lines.map((l) => l.input).filter((p): p is PlayerInput => p !== null);
  const notes = lines.flatMap((l) => [
    ...(l.input ? [] : [fill(b.skipped, { line: l.line })]),
    ...(l.unknown.length ? [fill(b.unknown, { line: l.line, words: l.unknown.join(", ") })] : []),
  ]);

  const add = () => {
    if (!players.length) return;
    rosterRepo.addMany(workspaceId, players);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={b.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={add} disabled={!players.length}>
            {plural(locale, b.add, players.length)}
          </Button>
        </>
      }
    >
      <p className="text-[0.95rem] text-chalk-dim">{b.body}</p>
      <label htmlFor={id} className="mt-5 block">
        <span className="text-[0.85rem] font-medium text-chalk-dim">{b.label}</span>
        <textarea
          id={id}
          rows={7}
          value={text}
          placeholder={b.placeholder}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          className="mt-2 w-full resize-y rounded-[0.7rem] bg-night-950/70 px-3.5 py-3 font-mono text-[0.9rem] leading-relaxed text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] outline-none placeholder:text-mist/60 focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]"
        />
      </label>

      {lines.length > 0 && (
        <section className="mt-6" aria-labelledby={`${id}-preview`}>
          <h3 id={`${id}-preview`} className="text-[0.85rem] font-medium text-chalk-dim">
            {b.preview}
          </h3>
          {notes.length > 0 && (
            <ul className="mt-2 space-y-1 text-[0.85rem] text-amber" aria-live="polite">
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          {players.length > 0 && (
            <ul className="mt-2 divide-y divide-hairline rounded-[var(--radius-card)] bg-night-900 shadow-[inset_0_0_0_1px_var(--color-hairline)]">
              {players.map((p, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <Jersey number={p.number ?? null} className="w-8 text-right text-[1.35rem]" />
                  <span className="min-w-0 flex-1 truncate font-medium">{`${p.firstName} ${p.lastName ?? ""}`.trim()}</span>
                  {p.positions?.length ? <PositionChips positions={p.positions} /> : <span className="text-[0.8rem] text-mist">{b.noPosition}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Dialog>
  );
}
