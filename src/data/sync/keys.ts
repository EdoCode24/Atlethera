/**
 * Where each storage key lives. Team data ("roster.<ws>", "playbooks.<ws>", …) syncs with the
 * server as rows of the documents table; device preferences ("print.<ws>", "hints.editor")
 * stay in this browser.
 */

export type Role = "coach" | "player";

/** Team data kept as one document row each. */
export const DOCUMENTS = ["roster", "calendar", "practice", "meetings", "games", "evaluation", "videos"] as const;
export type DocumentName = (typeof DOCUMENTS)[number];

export type Route = { kind: "local" } | { kind: "doc"; name: DocumentName } | { kind: "playbooks" };

/** How a key of the active workspace is stored. Keys of other workspaces, or with none, stay local. */
export function route(key: string, workspaceId: string | null): Route {
  if (!workspaceId) return { kind: "local" };
  const dot = key.lastIndexOf(".");
  if (dot < 0 || key.slice(dot + 1) !== workspaceId) return { kind: "local" };
  const name = key.slice(0, dot);
  if (name === "playbooks") return { kind: "playbooks" };
  return (DOCUMENTS as readonly string[]).includes(name) ? { kind: "doc", name: name as DocumentName } : { kind: "local" };
}

export const meRow = (playerId: string) => `me:${playerId}`;
export const PLAYBOOK_ORDER = "playbooks.order";

export function isPlaybookRow(row: string): boolean {
  return row === PLAYBOOK_ORDER || row.startsWith("pb:") || row.startsWith("play:");
}

/**
 * The rows a document is built from. A player reads the public roster plus their own row
 * instead of the coach's roster, and only their own evaluation.
 */
export function rowsOf(name: DocumentName, role: Role, playerId: string | null): string[] {
  if (role === "player") {
    if (name === "roster") return playerId ? ["roster.public", meRow(playerId)] : ["roster.public"];
    if (name === "evaluation") return playerId ? [meRow(playerId)] : [];
  }
  return [name];
}

/** The logical keys a changed row feeds, for this role. */
export function affected(row: string, role: Role, playerId: string | null, workspaceId: string): string[] {
  if (isPlaybookRow(row)) return [`playbooks.${workspaceId}`];
  if (role === "player") {
    if (row === "roster.public") return [`roster.${workspaceId}`];
    if (playerId && row === meRow(playerId)) return [`roster.${workspaceId}`, `evaluation.${workspaceId}`];
    if (row === "roster" || row === "evaluation" || row.startsWith("me:")) return [];
  } else if (row === "roster.public" || row.startsWith("me:")) {
    return [];
  }
  return (DOCUMENTS as readonly string[]).includes(row) ? [`${row}.${workspaceId}`] : [];
}

/** Whether this role reads the row at all (the server enforces it; this skips needless fetches). */
export function readsRow(row: string, role: Role, playerId: string | null): boolean {
  if (role === "coach") return row !== "roster.public" && !row.startsWith("me:");
  if (row === "roster" || row === "evaluation") return false;
  if (row.startsWith("me:")) return playerId !== null && row === meRow(playerId);
  return true;
}
