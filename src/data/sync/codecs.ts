import type { Playbook, Play } from "@/domain/playbook/types";
import type { Player, Roster } from "@/domain/team/roster";
import { PLAYBOOK_ORDER } from "./keys";

/**
 * Logical values ↔ rows. Playbooks travel one row per play, so saving a play sends only that
 * play; the other documents are one row each.
 */

export type Rows = Map<string, unknown>;

type BookMeta = Omit<Playbook, "plays"> & { playIds: string[] };

export function encodePlaybooks(books: Playbook[]): Rows {
  const rows: Rows = new Map();
  rows.set(PLAYBOOK_ORDER, { ids: books.map((b) => b.id) });
  for (const book of books) {
    const { plays, ...meta } = book;
    rows.set(`pb:${book.id}`, { ...meta, playIds: plays.map((p) => p.id) } satisfies BookMeta);
    // The play object itself is the row: an untouched play is the same object, so it is not resent.
    for (const play of plays) rows.set(`play:${play.id}`, play);
  }
  return rows;
}

/** Playbooks from their rows, in the saved order; a play or book row that is missing is left out. */
export function decodePlaybooks(rows: Rows): Playbook[] {
  const order = rows.get(PLAYBOOK_ORDER) as { ids?: string[] } | undefined;
  const ids = order?.ids ?? [];
  const books: Playbook[] = [];
  for (const id of ids) {
    const meta = rows.get(`pb:${id}`) as BookMeta | undefined;
    if (!meta) continue;
    const { playIds, ...book } = meta;
    const plays = (playIds ?? []).map((pid) => rows.get(`play:${pid}`) as Play | undefined).filter((p): p is Play => !!p);
    books.push({ ...book, plays });
  }
  return books;
}

/**
 * A player's roster: the public roster with their own entry (full record, from their "me" row)
 * put in its place.
 */
export function mergePlayerRoster(publicRoster: Roster | undefined, own: Player | null | undefined): Roster | undefined {
  if (!publicRoster) return undefined;
  if (!own) return publicRoster;
  return { ...publicRoster, players: publicRoster.players.map((p) => (p.id === own.id ? own : p)) };
}

/** What a sent row looked like, to tell a real change from the same content in a new object. */
export interface Sent {
  value: unknown;
  json?: string;
}

/**
 * The rows that differ from what the server has: new or changed rows to upsert, and rows that
 * are gone to delete. An identical object is skipped without serialising it.
 */
export function diffRows(next: Rows, sent: Map<string, Sent>, owned: (row: string) => boolean): { upserts: Rows; deletes: string[] } {
  const upserts: Rows = new Map();
  for (const [row, value] of next) {
    const before = sent.get(row);
    if (before && before.value === value) continue;
    const json = JSON.stringify(value);
    if (before) {
      before.json ??= JSON.stringify(before.value);
      if (before.json === json) {
        // Same content in a new object: remember the new object so the next check is by identity.
        before.value = value;
        before.json = json;
        continue;
      }
    }
    upserts.set(row, value);
  }
  const deletes = [...sent.keys()].filter((row) => owned(row) && !next.has(row));
  return { upserts, deletes };
}
