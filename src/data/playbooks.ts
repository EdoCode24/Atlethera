"use client";

import { clonePlay, newPlay, newPlaybook, type NewPlayInput, type NewPlaybookInput } from "@/domain/playbook/factory";
import { newId } from "@/domain/playbook/formations";
import { SPECIAL_TEAMS, SPECIAL_UNITS } from "@/domain/playbook/special";
import type { Category, Play, Playbook, PlayerSpot, PlaySide, Vec } from "@/domain/playbook/types";
import { read, useStored, write } from "./store";

/** Category names compare without case, in Turkish and English alike ("PAS", "pas", "İleri", "ileri"). */
export const categoryKey = (name: string) => name.trim().toLocaleLowerCase("tr").replace(/ı/g, "i");

/**
 * Default categories are named in the coach's language when a playbook is made, so one says
 * "Pass" and another "Pas". Names in one group are the same category; so are a unit's names.
 */
const CATEGORY_GROUPS: string[][] = [["Koşu", "Run"], ["Pas", "Pass"], ["Base"], ["Red zone"], ...SPECIAL_UNITS.map((u) => Object.values(SPECIAL_TEAMS[u].name))].map(
  (group) => group.map(categoryKey),
);

/**
 * Why a play can't go into another playbook, or null when it can. A play holds one team of an
 * exact size, so the player count must match; a different field width is fitted on copy.
 */
export function copyBlock(from: Playbook, to: Playbook): "sport" | "players" | null {
  if (from.sport !== to.sport) return "sport";
  return from.playersPerSide === to.playersPerSide ? null : "players";
}

/** The copy of `source` that lands in `to`: fresh ids, x fitted to its field width, categories matched by name. */
export function playCopyFor(from: Playbook, source: Play, to: Playbook): Play | null {
  if (copyBlock(from, to)) return null;
  // Playbooks saved before special teams have no list for that side.
  const names = new Set((from.categories[source.side] ?? []).filter((c) => source.categoryIds.includes(c.id)).map((c) => categoryKey(c.name)));
  for (const group of CATEGORY_GROUPS) if (group.some((n) => names.has(n))) group.forEach((n) => names.add(n));
  const categoryIds = (to.categories[source.side] ?? []).filter((c) => names.has(categoryKey(c.name))).map((c) => c.id);
  const copy = clonePlay(source, { categoryIds });
  // Flag fields are 25 or 30 yd wide: players, ghosts and route corners keep their place across the
  // field (zones follow, sitting where a route ends); depth and zone sizes stay in yards.
  const k = to.fieldWidth / from.fieldWidth;
  if (k === 1) return copy;
  const sx = <T extends Vec>(v: T): T => ({ ...v, x: Math.round(v.x * k * 100) / 100 });
  const fit = (p: PlayerSpot): PlayerSpot => ({ ...sx(p), route: p.route && { ...p.route, points: p.route.points.map(sx) } });
  return { ...copy, players: copy.players.map(fit), opponent: copy.opponent.map(fit) };
}

const NONE: Playbook[] = [];
const key = (workspaceId: string) => `playbooks.${workspaceId}`;

function all(workspaceId: string): Playbook[] {
  return read(key(workspaceId), NONE);
}

function save(workspaceId: string, books: Playbook[]) {
  write(key(workspaceId), books);
}

function touch(book: Playbook): Playbook {
  return { ...book, updatedAt: new Date().toISOString() };
}

function updateBook(workspaceId: string, id: string, fn: (b: Playbook) => Playbook) {
  save(
    workspaceId,
    all(workspaceId).map((b) => (b.id === id ? touch(fn(b)) : b)),
  );
}

export function usePlaybooks(workspaceId: string | undefined): Playbook[] {
  return useStored(workspaceId ? key(workspaceId) : "playbooks.none", NONE);
}

export const playbookRepo = {
  create(input: NewPlaybookInput): Playbook {
    const book = newPlaybook(input);
    save(input.workspaceId, [...all(input.workspaceId), book]);
    return book;
  },
  rename(workspaceId: string, id: string, name: string) {
    updateBook(workspaceId, id, (b) => ({ ...b, name: name.trim() || b.name }));
  },
  duplicate(workspaceId: string, id: string, name: string): Playbook | null {
    const source = all(workspaceId).find((b) => b.id === id);
    if (!source) return null;
    const copy: Playbook = {
      ...structuredClone(source),
      id: newId("pb"),
      name,
      plays: source.plays.map((p) => clonePlay(p)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    save(workspaceId, [...all(workspaceId), copy]);
    return copy;
  },
  remove(workspaceId: string, id: string) {
    save(
      workspaceId,
      all(workspaceId).filter((b) => b.id !== id),
    );
  },
  move(workspaceId: string, id: string, delta: -1 | 1) {
    const books = [...all(workspaceId)];
    const i = books.findIndex((b) => b.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= books.length) return;
    [books[i], books[j]] = [books[j], books[i]];
    save(workspaceId, books);
  },

  setCategories(workspaceId: string, id: string, side: PlaySide, categories: Category[]) {
    updateBook(workspaceId, id, (b) => {
      const kept = new Set(categories.map((c) => c.id));
      // Plays keep existing; they just drop categories that no longer exist.
      const plays = b.plays.map((p) => (p.side === side ? { ...p, categoryIds: p.categoryIds.filter((c) => kept.has(c)) } : p));
      return { ...b, categories: { ...b.categories, [side]: categories }, plays };
    });
  },

  createPlay(workspaceId: string, bookId: string, input: NewPlayInput): Play | null {
    const book = all(workspaceId).find((b) => b.id === bookId);
    if (!book) return null;
    const play = newPlay(book, input);
    updateBook(workspaceId, bookId, (b) => ({ ...b, plays: [...b.plays, play] }));
    return play;
  },
  updatePlay(workspaceId: string, bookId: string, playId: string, patch: Partial<Play>, author: string) {
    updateBook(workspaceId, bookId, (b) => ({
      ...b,
      plays: b.plays.map((p) => (p.id === playId ? { ...p, ...patch, updatedAt: new Date().toISOString(), updatedBy: author } : p)),
    }));
  },
  copyPlay(workspaceId: string, bookId: string, playId: string, name: string): Play | null {
    const source = all(workspaceId)
      .find((b) => b.id === bookId)
      ?.plays.find((p) => p.id === playId);
    if (!source) return null;
    const copy = clonePlay(source, { name });
    updateBook(workspaceId, bookId, (b) => {
      const at = b.plays.findIndex((p) => p.id === playId);
      const plays = [...b.plays];
      plays.splice(at + 1, 0, copy);
      return { ...b, plays };
    });
    return copy;
  },
  /** Copies into another playbook of the same sport and team size (see playCopyFor). */
  copyPlayTo(workspaceId: string, fromId: string, playId: string, toId: string): Play | null {
    const books = all(workspaceId);
    const from = books.find((b) => b.id === fromId);
    const to = books.find((b) => b.id === toId);
    const source = from?.plays.find((p) => p.id === playId);
    const copy = from && to && source ? playCopyFor(from, source, to) : null;
    if (!copy) return null;
    updateBook(workspaceId, toId, (b) => ({ ...b, plays: [...b.plays, copy] }));
    return copy;
  },
  deletePlay(workspaceId: string, bookId: string, playId: string) {
    updateBook(workspaceId, bookId, (b) => ({ ...b, plays: b.plays.filter((p) => p.id !== playId) }));
  },
};
