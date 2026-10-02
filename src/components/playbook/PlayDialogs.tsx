"use client";

import { useId, useState } from "react";
import { useCanEdit } from "@/components/app/access";
import { useApp } from "@/components/app/AppContext";
import { Button, Choice, Dialog, IconButton, TextArea, TextField } from "@/components/app/ui";
import { Icon } from "@/components/ui/Icon";
import { categoryKey, copyBlock, playbookRepo } from "@/data/playbooks";
import { newId } from "@/domain/playbook/formations";
import { DEFENSE_FRONTS, FRONTS, type DefenseFront } from "@/domain/playbook/fronts";
import { SPECIAL_TEAMS, SPECIAL_UNITS, type SpecialUnit } from "@/domain/playbook/special";
import type { Category, Play, Playbook, PlayerSpot, PlaySide } from "@/domain/playbook/types";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/fill";
import { PLAYER_FILL } from "./PlayField";

function CategoryPicker({ categories, value, onChange, label }: { categories: Category[]; value: string[]; onChange: (ids: string[]) => void; label: string }) {
  if (categories.length === 0) return null;
  return (
    <fieldset>
      <legend className="text-[0.85rem] font-medium text-chalk-dim">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {categories.map((c) => {
          const on = value.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== c.id) : [...value, c.id])}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-[0.65rem] px-3.5 text-[0.9rem] font-semibold transition-colors",
                on ? "bg-chalk text-night-950" : "bg-chalk/6 text-chalk-dim hover:text-chalk",
              )}
            >
              {on && <Icon name="check" className="size-4" />}
              {c.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function NewPlayDialog({
  book,
  side,
  defaultCategory,
  author,
  onClose,
  onCreated,
}: {
  book: Playbook;
  side: PlaySide;
  defaultCategory: string | null;
  author: string;
  onClose: () => void;
  onCreated: (play: Play) => void;
}) {
  const { t, locale } = useApp();
  const d = t.playbook.playDialog;
  const [name, setName] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>(() => {
    if (defaultCategory) return [defaultCategory];
    if (side !== "special") return [];
    const names = new Set(Object.values(SPECIAL_TEAMS.kickoff.name));
    return (book.categories.special ?? []).filter((c) => names.has(c.name)).map((c) => c.id);
  });
  const [notes, setNotes] = useState("");
  const [front, setFront] = useState<DefenseFront>("4-3");
  const [unit, setUnit] = useState<SpecialUnit>(() => {
    // Opened from a unit's category (e.g. "Punt"): start with that unit.
    const name = (book.categories[side] ?? []).find((c) => c.id === defaultCategory)?.name;
    return SPECIAL_UNITS.find((u) => name && Object.values(SPECIAL_TEAMS[u].name).includes(name)) ?? "kickoff";
  });
  const [error, setError] = useState<string | null>(null);
  const special = side === "special";
  const withFront = book.sport === "american-football" && !special;
  const categories = book.categories[side] ?? [];
  // A unit picks the category of the same name, when the playbook has one.
  const pickUnit = (next: SpecialUnit) => {
    const names = new Set(Object.values(SPECIAL_TEAMS[next].name));
    const prev = new Set(Object.values(SPECIAL_TEAMS[unit].name));
    setUnit(next);
    const add = categories.filter((c) => names.has(c.name)).map((c) => c.id);
    setCategoryIds((ids) => [...ids.filter((id) => !add.includes(id) && !prev.has(categories.find((c) => c.id === id)?.name ?? "")), ...add]);
  };

  const create = () => {
    if (!name.trim()) {
      setError(d.nameRequired);
      return;
    }
    const play = playbookRepo.createPlay(book.workspaceId, book.id, { side, name, categoryIds, notes, author, ...(withFront ? { front } : {}), ...(special ? { unit } : {}) });
    if (play) onCreated(play);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      onSubmit={create}
      title={`${d.title}: ${t.playbook.sides[side]}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit">{d.create}</Button>
        </>
      }
    >
      <div className="space-y-6">
        <TextField
          label={d.name}
          placeholder={d.namePlaceholder}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          error={error}
          autoFocus
        />
        {special && (
          <Choice label={d.unit} value={unit} onChange={pickUnit} options={SPECIAL_UNITS.map((u) => ({ value: u, label: SPECIAL_TEAMS[u].name[locale] }))} />
        )}
        <CategoryPicker categories={categories} value={categoryIds} onChange={setCategoryIds} label={d.categories} />
        {withFront && (
          <Choice
            label={side === "defense" ? d.front : d.opponentFront}
            value={front}
            onChange={setFront}
            options={DEFENSE_FRONTS.map((f) => ({ value: f, label: FRONTS[f].name[locale] }))}
          />
        )}
        <TextArea label={d.notes} placeholder={d.notesPlaceholder} value={notes} onChange={setNotes} />
      </div>
    </Dialog>
  );
}

export function EditCategoriesDialog({ book, side, onClose }: { book: Playbook; side: PlaySide; onClose: () => void }) {
  const { t } = useApp();
  const errorId = useId();
  // `was`: the name a row opened (or was added) with. A row cleared to nothing keeps it.
  const [items, setItems] = useState(() => (book.categories[side] ?? []).map((c) => ({ ...c, was: c.name })));
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const named = (c: { name: string; was: string }) => c.name.trim() || c.was;
  const taken = (name: string, except?: string) => items.some((c) => c.id !== except && categoryKey(named(c)) === categoryKey(name));

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    if (taken(name)) {
      setError(fill(t.playbook.categoryTaken, { name }));
      return;
    }
    setItems([...items, { id: newId("c"), name, was: name }]);
    setDraft("");
  };
  const edit = (id: string, name: string) => {
    setItems(items.map((x) => (x.id === id ? { ...x, name } : x)));
    setError(null);
  };
  const move = (i: number, delta: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    setItems(next);
  };
  // A name typed in the add field but not added yet still counts; names must stay apart.
  const save = () => {
    const list: Category[] = items.map((c) => ({ id: c.id, name: named(c) }));
    if (draft.trim()) list.push({ id: newId("c"), name: draft.trim() });
    const dup = list.find((c, i) => list.findIndex((o) => categoryKey(o.name) === categoryKey(c.name)) !== i);
    if (dup) {
      setError(fill(t.playbook.categoryTaken, { name: dup.name }));
      return;
    }
    playbookRepo.setCategories(book.workspaceId, book.id, side, list);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={fill(t.playbook.categoriesTitle, { side: t.playbook.sides[side] })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={save}>{t.common.save}</Button>
        </>
      }
    >
      <ul className="space-y-2">
        {items.map((c, i) => (
          <li key={c.id} className="flex items-center gap-1">
            <input
              aria-label={t.common.rename}
              aria-invalid={taken(named(c), c.id) || undefined}
              value={c.name}
              onChange={(e) => edit(c.id, e.target.value)}
              onBlur={() => {
                if (!c.name.trim()) edit(c.id, c.was);
              }}
              className={cn(
                "h-11 min-w-0 flex-1 rounded-[0.65rem] bg-night-950/70 px-3 text-chalk outline-none",
                taken(named(c), c.id)
                  ? "shadow-[inset_0_0_0_1.5px_var(--color-signal)]"
                  : "shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]",
              )}
            />
            <IconButton label={t.common.moveUp} disabled={i === 0} onClick={() => move(i, -1)}>
              <Icon name="arrowDown" className="size-4 rotate-180" />
            </IconButton>
            <IconButton label={t.common.moveDown} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              <Icon name="arrowDown" className="size-4" />
            </IconButton>
            <IconButton
              label={t.common.delete}
              onClick={() => {
                setItems(items.filter((x) => x.id !== c.id));
                setError(null);
              }}
              className="hover:text-signal"
            >
              <Icon name="trash" className="size-4" />
            </IconButton>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          aria-label={t.playbook.addCategory}
          aria-describedby={error ? errorId : undefined}
          placeholder={t.playbook.categoryPlaceholder}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          data-autofocus
          className="h-11 min-w-0 flex-1 rounded-[0.65rem] bg-night-950/70 px-3 text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] outline-none placeholder:text-mist/70 focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]"
        />
        <Button type="submit" variant="ghost">
          <Icon name="plus" className="size-4" />
          {t.playbook.addCategory}
        </Button>
      </form>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-[0.85rem] text-signal">
          {error}
        </p>
      )}
      <p className="mt-4 text-[0.82rem] text-mist">{t.playbook.categoryNote}</p>
    </Dialog>
  );
}

/** Rename, categories, notes, copy, copy to another playbook, delete. */
export function PlayInfoDialog({
  book,
  play,
  books,
  author,
  formatDate,
  onClose,
  onDeleted,
}: {
  book: Playbook;
  play: Play;
  books: Playbook[];
  author: string;
  formatDate: (iso: string) => string;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { t } = useApp();
  const i = t.playbook.info;
  const [name, setName] = useState(play.name);
  const [categoryIds, setCategoryIds] = useState(play.categoryIds);
  const [notes, setNotes] = useState(play.notes);
  const [positionNotes, setPositionNotes] = useState(play.positionNotes);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const targets = books.filter((b) => b.id !== book.id && b.sport === book.sport);
  const noteId = useId();

  const save = () => {
    playbookRepo.updatePlay(book.workspaceId, book.id, play.id, { name: name.trim() || play.name, categoryIds, notes, positionNotes }, author);
    onClose();
  };
  // "Name (copy)", then "Name (copy 2)", "Name (copy 3)"…: the first the playbook doesn't have yet.
  const copyName = () => {
    const taken = new Set(book.plays.map((p) => p.name));
    let n = 1;
    let next = fill(i.copyName, { name: play.name });
    while (taken.has(next)) next = fill(i.copyNameN, { name: play.name, n: ++n });
    return next;
  };
  // Players who share a label (C and C, CB and CB) are told apart by where they stand, left to right.
  const place = (p: PlayerSpot) => {
    const same = play.players.filter((q) => q.label === p.label).sort((a, b) => a.x - b.x);
    if (same.length < 2) return null;
    const k = same.indexOf(p);
    return k === 0 ? i.left : k === same.length - 1 ? i.right : same.length === 3 ? i.middle : `${i.middle} ${k}`;
  };
  const placed = play.players.some((p) => place(p));
  const canEdit = useCanEdit();

  // Players read the play's notes; changing, copying and deleting are the coach's.
  if (!canEdit) {
    const categories = (book.categories[play.side] ?? []).filter((c) => play.categoryIds.includes(c.id));
    const noted = play.players.filter((p) => play.positionNotes[p.id]?.trim());
    return (
      <Dialog
        open
        onClose={onClose}
        title={play.name}
        footer={
          <Button variant="ghost" onClick={onClose}>
            {t.common.close}
          </Button>
        }
      >
        {categories.length > 0 && <p className="text-[0.9rem] text-chalk-dim">{categories.map((c) => c.name).join(", ")}</p>}
        {play.notes && <p className="mt-4 whitespace-pre-line">{play.notes}</p>}
        {noted.length > 0 && (
          <section className="mt-5">
            <h3 className="text-[0.85rem] font-medium text-chalk-dim">{i.positionNotes}</h3>
            <ul className="mt-2 space-y-2">
              {noted.map((p) => (
                <li key={p.id} className="flex items-start gap-3">
                  <span className="display grid size-9 shrink-0 place-items-center rounded-full text-[0.85rem]" style={{ background: PLAYER_FILL[p.color].fill, color: PLAYER_FILL[p.color].text }}>
                    {p.label}
                  </span>
                  <span className="pt-1.5 text-[0.95rem]">{play.positionNotes[p.id]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!play.notes && noted.length === 0 && <p className="text-mist">{t.common.nothingYet}</p>}
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      onSubmit={() => {
        // Enter saves; it never answers the delete question.
        if (!confirming) save();
      }}
      title={i.title}
      footer={
        confirming ? (
          <>
            <p className="mr-auto self-center text-[0.9rem] text-chalk-dim">{fill(i.deleteConfirm, { name: play.name })}</p>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                playbookRepo.deletePlay(book.workspaceId, book.id, play.id);
                onClose();
                onDeleted?.();
              }}
            >
              {t.common.delete}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setConfirming(true)} className="mr-auto text-signal shadow-[inset_0_0_0_1px_rgb(255_106_61/0.4)]">
              <Icon name="trash" className="size-4" />
              {t.common.delete}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit">{t.common.save}</Button>
          </>
        )
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <TextField label={t.playbook.playDialog.name} value={name} onChange={(e) => setName(e.target.value)} />
          <CategoryPicker categories={book.categories[play.side] ?? []} value={categoryIds} onChange={setCategoryIds} label={t.playbook.playDialog.categories} />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                const copy = playbookRepo.copyPlay(book.workspaceId, book.id, play.id, copyName());
                if (copy) setMessage(fill(i.copied, { name: copy.name }));
              }}
            >
              <Icon name="copy" className="size-4" />
              {i.copy}
            </Button>
          </div>
          <div>
            <p className="text-[0.85rem] font-medium text-chalk-dim">{i.copyTo}</p>
            {targets.length === 0 ? (
              <p className="mt-2 text-[0.88rem] text-mist">{i.copyToNone}</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-x-2 gap-y-3">
                {targets.map((b) => {
                  // A play holds one team size; a 25 or 30 yd field is fitted on copy.
                  const blocked = copyBlock(book, b) !== null;
                  const note = blocked
                    ? fill(i.copyToPlayers, { n: b.playersPerSide })
                    : b.fieldWidth !== book.fieldWidth
                      ? fill(i.copyToWidth, { w: b.fieldWidth })
                      : null;
                  return (
                    <li key={b.id} className="flex flex-col items-start gap-1">
                      <Button
                        variant="ghost"
                        disabled={blocked}
                        aria-describedby={note ? `${noteId}-${b.id}` : undefined}
                        onClick={() => {
                          const copy = playbookRepo.copyPlayTo(book.workspaceId, book.id, play.id, b.id);
                          if (copy) setMessage(fill(i.copied, { name: `${b.name}: ${copy.name}` }));
                        }}
                      >
                        {b.name}
                      </Button>
                      {note && (
                        <span id={`${noteId}-${b.id}`} className="px-1 text-[0.78rem] text-mist">
                          {note}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {message && (
            <p role="status" className="text-[0.88rem] text-volt">
              {message}
            </p>
          )}
          <p className="text-[0.82rem] text-mist">{fill(i.modified, { date: formatDate(play.updatedAt), user: play.updatedBy })}</p>
        </div>
        <div className="space-y-5">
          <TextArea label={t.playbook.playDialog.notes} value={notes} onChange={setNotes} placeholder={t.playbook.playDialog.notesPlaceholder} rows={4} />
          <fieldset>
            <legend className="text-[0.85rem] font-medium text-chalk-dim">{i.positionNotes}</legend>
            <div className="mt-2 space-y-2">
              {play.players.map((p) => (
                <label key={p.id} className="flex items-center gap-3">
                  {/* The player's own colour, as on the field. */}
                  <span
                    className="display grid size-9 shrink-0 place-items-center rounded-full text-[0.85rem]"
                    style={{ background: PLAYER_FILL[p.color].fill, color: PLAYER_FILL[p.color].text }}
                  >
                    {p.label}
                  </span>
                  {placed && <span className="w-11 shrink-0 text-[0.82rem] text-chalk-dim">{place(p)}</span>}
                  <input
                    aria-label={fill(i.positionNote, { label: place(p) ? `${p.label} (${place(p)})` : p.label })}
                    value={positionNotes[p.id] ?? ""}
                    onChange={(e) => setPositionNotes({ ...positionNotes, [p.id]: e.target.value })}
                    className="h-10 min-w-0 flex-1 rounded-[0.6rem] bg-night-950/70 px-3 text-[0.9rem] text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
    </Dialog>
  );
}
