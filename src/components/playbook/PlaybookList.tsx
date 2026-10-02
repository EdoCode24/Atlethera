"use client";

import { useState } from "react";
import { EditOnly, useCanEdit } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button, Choice, Dialog, IconButton, TextField } from "@/components/app/ui";
import { Icon } from "@/components/ui/Icon";
import { playbookRepo } from "@/data/playbooks";
import { FIELD_WIDTHS, PLAYERS_PER_SIDE } from "@/domain/playbook/formations";
import type { FieldLines, Playbook } from "@/domain/playbook/types";
import { sports } from "@/domain/sports";
import type { SportId } from "@/domain/sports/types";
import { fill } from "@/lib/fill";
import { plural } from "@/lib/plural";
import { usePlaybookContext } from "./hooks";
import { PrintOverlay } from "./PrintOverlay";

function widthLabel(t: ReturnType<typeof useApp>["t"], sport: SportId, w: number) {
  if (sport === "american-football") return t.playbook.create.widths.af;
  return w === 25 ? t.playbook.create.widths.ifaf : t.playbook.create.widths.nflFlag;
}

function NewPlaybookDialog({ open, onClose, sport, workspaceId }: { open: boolean; onClose: () => void; sport: SportId; workspaceId: string }) {
  const { t } = useApp();
  const href = useHref();
  const c = t.playbook.create;
  const range = PLAYERS_PER_SIDE[sport];
  const [name, setName] = useState("");
  const [players, setPlayers] = useState(range.default);
  const [width, setWidth] = useState(FIELD_WIDTHS[sport][0]);
  const [lines, setLines] = useState<FieldLines>("five");
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    if (!name.trim()) {
      setError(c.nameRequired);
      return;
    }
    const book = playbookRepo.create({
      workspaceId,
      name,
      sport,
      playersPerSide: players,
      fieldWidth: width,
      fieldLines: lines,
      categoryNames: c.defaultCategories,
    });
    window.location.assign(href(`/panel/playbook/${book.id}`));
  };

  const counts = Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onSubmit={create}
      title={c.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit">{t.common.create}</Button>
        </>
      }
    >
      <div className="space-y-6">
        <TextField
          label={c.name}
          placeholder={c.namePlaceholder}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          error={error}
          autoFocus
        />
        {counts.length > 1 && <Choice label={c.playersPerSide} value={players} onChange={setPlayers} options={counts.map((n) => ({ value: n, label: String(n) }))} />}
        {FIELD_WIDTHS[sport].length > 1 && (
          <Choice label={c.fieldWidth} value={width} onChange={setWidth} options={FIELD_WIDTHS[sport].map((w) => ({ value: w, label: widthLabel(t, sport, w) }))} />
        )}
        <Choice
          label={c.fieldLines}
          value={lines}
          onChange={setLines}
          options={(["five", "fiveNumbered", "none"] as FieldLines[]).map((l) => ({ value: l, label: c.lines[l] }))}
        />
      </div>
    </Dialog>
  );
}

function RenameDialog({ book, onClose }: { book: Playbook | null; onClose: () => void }) {
  const { t } = useApp();
  const [name, setName] = useState(book?.name ?? "");
  const save = () => {
    if (book) playbookRepo.rename(book.workspaceId, book.id, name);
    onClose();
  };
  return (
    <Dialog
      open={book !== null}
      onClose={onClose}
      onSubmit={save}
      title={t.common.rename}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit">{t.common.save}</Button>
        </>
      }
    >
      <TextField label={t.playbook.create.name} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
    </Dialog>
  );
}

function ConfirmDelete({ book, onClose }: { book: Playbook | null; onClose: () => void }) {
  const { t, locale } = useApp();
  return (
    <Dialog
      open={book !== null}
      onClose={onClose}
      title={t.common.delete}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (book) playbookRepo.remove(book.workspaceId, book.id);
              onClose();
            }}
          >
            {t.common.delete}
          </Button>
        </>
      }
    >
      <p className="text-chalk-dim">{book && plural(locale, t.playbook.counts.deleteConfirm, book.plays.length, { name: book.name })}</p>
    </Dialog>
  );
}

export function PlaybookList() {
  const { t, locale } = useApp();
  const href = useHref();
  const { workspace, books, formatDate } = usePlaybookContext();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Playbook | null>(null);
  const [deleting, setDeleting] = useState<Playbook | null>(null);
  const canEdit = useCanEdit();
  const [printingId, setPrintingId] = useState<string | null>(null);

  if (!workspace) return null;
  const printing = books.find((b) => b.id === printingId) ?? null;
  /** "Name (kopya)", then "Name (kopya 2)"… so no two playbooks share a name. */
  const copyName = (name: string) => {
    const taken = new Set(books.map((b) => b.name));
    let candidate = fill(t.playbook.duplicateName, { name });
    for (let n = 2; taken.has(candidate); n++) candidate = fill(t.playbook.info.copyNameN, { name, n });
    return candidate;
  };
  if (workspace.package !== "coach" || !workspace.sport) return <p className="px-8 py-14 text-chalk-dim">{workspace.package !== "coach" ? t.playbook.coachOnly : t.playbook.notFound}</p>;
  const sport = workspace.sport;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[0.9rem] font-semibold text-volt">{sports[sport].name[locale]}</p>
          <h1 className="display mt-2 text-display-md">{t.playbook.title}</h1>
          <p className="mt-3 max-w-[40rem] text-chalk-dim">{t.playbook.listBody}</p>
        </div>
        <EditOnly>
          <Button onClick={() => setCreating(true)}>
            <Icon name="plus" className="size-5" />
            {t.playbook.newPlaybook}
          </Button>
        </EditOnly>
      </div>

      {books.length === 0 ? (
        <div className="mt-10 rounded-[var(--radius-panel)] bg-night-850 p-8 text-center shadow-[inset_0_0_0_1px_var(--color-hairline)]">
          <Icon name="playbook" className="mx-auto size-8 text-mist" />
          <p className="mx-auto mt-4 max-w-[28rem] text-chalk-dim">{canEdit ? t.playbook.empty : t.common.nothingYet}</p>
          <EditOnly>
            <Button className="mt-6" onClick={() => setCreating(true)}>
              {t.playbook.newPlaybook}
            </Button>
          </EditOnly>
        </div>
      ) : (
        <ol className="mt-10 divide-y divide-hairline overflow-hidden rounded-[var(--radius-panel)] bg-night-850 shadow-[inset_0_0_0_1px_var(--color-hairline)]">
          {books.map((book, i) => (
            <li key={book.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
              <span className="display tabular w-8 text-[1.5rem] text-mist">{i + 1}</span>
              <a href={href(`/panel/playbook/${book.id}`)} className="min-w-0 flex-1 py-2">
                <span className="block truncate text-[1.05rem] font-semibold hover:underline">{book.name}</span>
                <span className="mt-0.5 block text-[0.82rem] text-mist">
                  {plural(locale, t.playbook.counts.plays, book.plays.length)}, {fill(t.playbook.updated, { date: formatDate(book.updatedAt) })}
                </span>
              </a>
              <div className="flex items-center">
                <IconButton label={fill(t.playbook.printBook, { name: book.name })} onClick={() => setPrintingId(book.id)}>
                  <Icon name="printer" className="size-[1.1rem]" />
                </IconButton>
                <EditOnly>
                <IconButton label={t.common.moveUp} disabled={i === 0} onClick={() => playbookRepo.move(workspace.id, book.id, -1)}>
                  <Icon name="arrowDown" className="size-4 rotate-180" />
                </IconButton>
                <IconButton label={t.common.moveDown} disabled={i === books.length - 1} onClick={() => playbookRepo.move(workspace.id, book.id, 1)}>
                  <Icon name="arrowDown" className="size-4" />
                </IconButton>
                <IconButton label={t.common.rename} onClick={() => setRenaming(book)}>
                  <Icon name="pencil" className="size-4" />
                </IconButton>
                <IconButton label={t.common.duplicate} onClick={() => playbookRepo.duplicate(workspace.id, book.id, copyName(book.name))}>
                  <Icon name="copy" className="size-4" />
                </IconButton>
                <IconButton label={t.common.delete} onClick={() => setDeleting(book)} className="hover:text-signal">
                  <Icon name="trash" className="size-4" />
                </IconButton>
                </EditOnly>
              </div>
            </li>
          ))}
        </ol>
      )}

      {creating && canEdit && <NewPlaybookDialog open onClose={() => setCreating(false)} sport={sport} workspaceId={workspace.id} />}
      {renaming && canEdit && <RenameDialog key={renaming.id} book={renaming} onClose={() => setRenaming(null)} />}
      <ConfirmDelete book={deleting} onClose={() => setDeleting(null)} />
      {printing && <PrintOverlay book={printing} workspaceId={workspace.id} team={workspace.name} onClose={() => setPrintingId(null)} />}
    </div>
  );
}
