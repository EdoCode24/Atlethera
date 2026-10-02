"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EditOnly, useCanEdit } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { Icon } from "@/components/ui/Icon";
import { sidesFor } from "@/domain/playbook/factory";
import type { Play, PlaySide } from "@/domain/playbook/types";
import { cn } from "@/lib/cn";
import { usePlaybookContext } from "./hooks";
import { EditCategoriesDialog, NewPlayDialog, PlayInfoDialog } from "./PlayDialogs";
import { PlayThumb } from "./PlayThumb";
import { PrintOverlay } from "./PrintOverlay";
import { SideIcon } from "./SideIcon";

type Filter = "all" | "none" | string;

export function PlaybookDetail({ playbookId }: { playbookId: string }) {
  const { t } = useApp();
  const href = useHref();
  const router = useRouter();
  const { user, workspace, books, formatDate } = usePlaybookContext();
  // Where the coach was in this playbook (side and filter), kept for the tab so coming back from the
  // editor lands on the same list.
  const viewKey = `atlethera.pbview.${playbookId}`;
  const [view, setView] = useState<{ side: PlaySide; filter: Filter }>(() => {
    try {
      const saved = typeof window === "undefined" ? null : JSON.parse(window.sessionStorage.getItem(viewKey) ?? "null");
      if (saved && typeof saved.side === "string" && typeof saved.filter === "string") return saved;
    } catch {}
    return { side: "offense", filter: "all" };
  });
  const remember = (next: { side: PlaySide; filter: Filter }) => {
    setView(next);
    try {
      window.sessionStorage.setItem(viewKey, JSON.stringify(next));
    } catch {}
  };
  const [creating, setCreating] = useState(false);
  const canEdit = useCanEdit();
  const [editingCategories, setEditingCategories] = useState(false);
  const [info, setInfo] = useState<Play | null>(null);
  const [printing, setPrinting] = useState(false);

  if (!workspace || !user) return null;
  const book = books.find((b) => b.id === playbookId);
  if (!book) {
    return (
      <div className="px-8 py-14">
        <p className="text-chalk-dim">{t.playbook.notFound}</p>
        <a href={href("/panel/playbook")} className="mt-4 inline-block font-semibold text-volt underline underline-offset-4">
          {t.playbook.title}
        </a>
      </div>
    );
  }

  const sides = sidesFor(book.sport);
  const side: PlaySide = sides.includes(view.side) ? view.side : "offense";
  const plays = book.plays.filter((p) => p.side === side);
  const categories = book.categories[side] ?? [];
  // A filter on a category that no longer exists falls back to all plays.
  const filter: Filter = view.filter === "all" || view.filter === "none" || categories.some((c) => c.id === view.filter) ? view.filter : "all";
  const setFilter = (f: Filter) => remember({ side, filter: f });
  const shown = plays.filter((p) =>
    filter === "all" ? true : filter === "none" ? p.categoryIds.length === 0 : p.categoryIds.includes(filter),
  );
  const count = (f: Filter) => (f === "all" ? plays.length : f === "none" ? plays.filter((p) => p.categoryIds.length === 0).length : plays.filter((p) => p.categoryIds.includes(f)).length);
  const editorHref = (id: string) => href(`/panel/playbook/${book.id}/${id}`);

  const filterButton = (f: Filter, label: string) => (
    <li key={f} className="shrink-0 lg:shrink">
      <button
        type="button"
        aria-pressed={filter === f}
        onClick={() => setFilter(f)}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-3 rounded-[0.65rem] px-3 text-left text-[0.92rem] whitespace-nowrap transition-colors lg:whitespace-normal",
          filter === f ? "bg-chalk/10 font-semibold text-chalk" : "text-chalk-dim hover:bg-chalk/6 hover:text-chalk",
        )}
      >
        <span className="truncate">{label}</span>
        <span className="tabular text-[0.82rem] text-mist">{count(f)}</span>
      </button>
    </li>
  );

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col lg:min-h-dvh lg:flex-row">
      <aside className="border-b border-hairline bg-night-900/60 p-4 lg:w-[17rem] lg:shrink-0 lg:border-r lg:border-b-0 lg:p-5">
        <div className="flex items-center justify-between gap-3">
          <a href={href("/panel/playbook")} className="flex items-center gap-1.5 text-[0.85rem] text-mist hover:text-chalk">
            <Icon name="chevronLeft" className="size-4" />
            {t.playbook.title}
          </a>
          <button
            type="button"
            onClick={() => setPrinting(true)}
            className="flex h-9 items-center gap-1.5 rounded-[0.6rem] px-2.5 text-[0.82rem] font-semibold text-chalk-dim shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] transition-colors hover:bg-chalk/6 hover:text-chalk"
          >
            <Icon name="printer" className="size-4" />
            {t.playbook.printButton}
          </button>
        </div>
        <h1 className="display mt-3 text-[1.9rem] leading-none">{book.name}</h1>

        <div role="group" aria-label={t.playbook.title} className={cn("mt-5 grid gap-1 rounded-[0.8rem] bg-night-950/60 p-1", sides.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
          {sides.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={side === s}
              onClick={() => remember({ side: s, filter: "all" })}
              className={cn(
                "flex min-h-10 items-center justify-center gap-1.5 rounded-[0.6rem] px-1 py-1 text-center text-[0.8rem] leading-tight font-semibold transition-colors",
                side === s ? "bg-chalk text-night-950" : "text-chalk-dim hover:text-chalk",
              )}
            >
              <SideIcon side={s} />
              {t.playbook.sides[s]}
            </button>
          ))}
        </div>

        <ul className="-mx-1 mt-4 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
          {filterButton("all", t.playbook.allPlays[side])}
          {categories.map((c) => filterButton(c.id, c.name))}
          {filterButton("none", t.playbook.uncategorized)}
        </ul>
        <EditOnly>
          <button
            type="button"
            onClick={() => setEditingCategories(true)}
            className="mt-3 flex min-h-11 items-center gap-2 px-3 text-[0.88rem] font-semibold text-chalk-dim hover:text-chalk"
          >
            <Icon name="pencil" className="size-4" />
            {t.playbook.editCategories}
          </button>
        </EditOnly>
      </aside>

      <section className="flex-1 p-4 sm:p-6 lg:p-8" aria-label={t.playbook.allPlays[side]}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {canEdit && (
          <li>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex aspect-[4/3.4] w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] bg-night-850 text-chalk-dim shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] transition-colors hover:bg-night-800 hover:text-chalk"
            >
              <Icon name="plus" className="size-8" />
              <span className="px-3 text-center text-[0.88rem] font-semibold">{t.playbook.newPlay[side]}</span>
            </button>
          </li>
          )}
          {shown.map((play) => {
            const number = plays.indexOf(play) + 1;
            return (
              <li key={play.id} className="relative">
                <a
                  href={editorHref(play.id)}
                  className="group block overflow-hidden rounded-[var(--radius-card)] bg-night-850 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] transition-shadow hover:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]"
                >
                  <PlayThumb book={book} play={play} className="block aspect-[4/2.8] w-full" />
                  <span className="flex items-center gap-2 py-2.5 pr-11 pl-3">
                    <span className="tabular grid size-6 shrink-0 place-items-center rounded-md bg-chalk/10 text-[0.75rem] font-semibold">{number}</span>
                    <span className="truncate text-[0.9rem] font-semibold">{play.name}</span>
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => setInfo(play)}
                  aria-label={`${t.playbook.info.title}: ${play.name}`}
                  className="absolute right-1.5 bottom-1 grid size-9 place-items-center rounded-full text-chalk-dim hover:bg-chalk/8 hover:text-chalk"
                >
                  <Icon name="info" className="size-4.5" />
                </button>
              </li>
            );
          })}
        </ul>
        {shown.length === 0 && (plays.length > 0 || !canEdit) && <p className="mt-6 text-chalk-dim">{plays.length > 0 ? t.playbook.noPlays : t.common.nothingYet}</p>}
      </section>

      {creating && canEdit && (
        <NewPlayDialog
          book={book}
          side={side}
          defaultCategory={filter !== "all" && filter !== "none" ? filter : null}
          author={user.name}
          onClose={() => setCreating(false)}
          onCreated={(play) => router.push(editorHref(play.id))}
        />
      )}
      {editingCategories && canEdit && <EditCategoriesDialog book={book} side={side} onClose={() => setEditingCategories(false)} />}
      {printing && <PrintOverlay book={book} workspaceId={workspace.id} team={workspace.name} initialSide={side} initialFilter={filter} onClose={() => setPrinting(false)} />}
      {info && (
        <PlayInfoDialog
          key={info.id}
          book={book}
          play={book.plays.find((p) => p.id === info.id) ?? info}
          books={books}
          author={user.name}
          formatDate={formatDate}
          onClose={() => setInfo(null)}
        />
      )}
    </div>
  );
}
