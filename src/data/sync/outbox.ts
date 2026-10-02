/**
 * Changes not yet confirmed by the server, kept in this browser so nothing typed is lost to a
 * closed tab or a dropped connection. Each entry remembers the server version it was based on.
 */

export interface OutboxEntry {
  op: "upsert" | "delete";
  value?: unknown;
  /** The row's server version when the change was made; 0 for a row the server doesn't have. */
  base: number;
  /** Increases with every change, so a flush only clears entries it actually sent. */
  seq: number;
}

export type Outbox = Record<string, OutboxEntry>;

const storageKey = (userId: string, workspaceId: string) => `atlethera.v2.outbox.${userId}.${workspaceId}`;

export function loadOutbox(userId: string, workspaceId: string): Outbox {
  try {
    const raw = window.localStorage.getItem(storageKey(userId, workspaceId));
    return raw ? (JSON.parse(raw) as Outbox) : {};
  } catch {
    return {};
  }
}

export function saveOutbox(userId: string, workspaceId: string, outbox: Outbox): void {
  try {
    if (Object.keys(outbox).length) window.localStorage.setItem(storageKey(userId, workspaceId), JSON.stringify(outbox));
    else window.localStorage.removeItem(storageKey(userId, workspaceId));
  } catch {
    // Storage full or blocked: the changes still go out from memory this session.
  }
}

export function clearOutbox(userId: string, workspaceId: string): void {
  try {
    window.localStorage.removeItem(storageKey(userId, workspaceId));
  } catch {
    // Nothing to clear.
  }
}

/**
 * Which saved changes still apply when the app opens again: those made on the version the
 * server still has. A row changed elsewhere in the meantime keeps the other device's change.
 */
export function replayPlan(outbox: Outbox, serverVersions: ReadonlyMap<string, number>): { apply: string[]; dropped: string[] } {
  const apply: string[] = [];
  const dropped: string[] = [];
  for (const [row, entry] of Object.entries(outbox)) {
    if ((serverVersions.get(row) ?? 0) === entry.base) apply.push(row);
    else dropped.push(row);
  }
  return { apply, dropped };
}
