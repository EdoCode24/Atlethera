"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import type { Playbook } from "@/domain/playbook/types";
import type { Player, Roster } from "@/domain/team/roster";
import { decodePlaybooks, diffRows, encodePlaybooks, mergePlayerRoster, type Rows, type Sent } from "./codecs";
import { DOCUMENTS, affected, isPlaybookRow, meRow, readsRow, route, rowsOf, type Role } from "./keys";
import { loadOutbox, replayPlan, saveOutbox, type Outbox } from "./outbox";

/**
 * Keeps the active team's documents in sync: loads them when the account opens, sends local
 * changes (from an outbox that survives reloads) in batches, and pulls other devices' changes
 * when the database signals them. The screens only ever see the cache in store.ts.
 */

export interface SyncContext {
  workspaceId: string;
  role: Role;
  playerId: string | null;
  userId: string;
}

export type SyncStatus = "loading" | "saved" | "saving" | "offline" | "error";
export type Signal = "live" | "access";

export interface EngineHooks {
  /** A logical key's value changed (undefined: nothing stored, use the fallback). */
  set(key: string, value: unknown): void;
  ready(): void;
  status(status: SyncStatus): void;
  signal(kind: Signal): void;
  /** Some offline changes could not be applied: the data changed on another device. */
  dropped(count: number): void;
}

interface Row {
  key: string;
  value?: unknown;
  version: number;
}

const DEBOUNCE = 600;
const MAX_WAIT = 3000;
const BACKOFF = [1000, 2000, 5000, 10000, 30000];
const PAGE = 1000;
const BATCH = 40;

let ctx: SyncContext | null = null;
let hooks: EngineHooks | null = null;
let sb: SupabaseClient | null = null;
let channel: RealtimeChannel | null = null;
let clientId = "";
let generation = 0;

/** Local view of every row (server state plus pending changes). */
const rows: Rows = new Map();
/** What the server has, as far as we know, for diffing. */
const sent = new Map<string, Sent>();
const versions = new Map<string, number>();
let outbox: Outbox = {};
let seq = 0;

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let firstQueued = 0;
let flushing: Promise<void> | null = null;
let attempt = 0;
let status: SyncStatus = "loading";
let lastVisible = Date.now();
const pendingFetch = new Set<string>();
let fetchScheduled = false;
const cleanups: (() => void)[] = [];

function setStatus(next: SyncStatus) {
  if (status === next) return;
  status = next;
  hooks?.status(next);
}

export function engineStatus(): SyncStatus {
  return status;
}

export function activeContext(): SyncContext | null {
  return ctx;
}

export function hasPending(): boolean {
  return Object.keys(outbox).length > 0;
}

// ── Decoding rows into the values the screens read ─────────────────────────

function decode(logicalKey: string): unknown {
  if (!ctx) return undefined;
  const r = route(logicalKey, ctx.workspaceId);
  if (r.kind === "playbooks") {
    return rows.has("playbooks.order") ? (decodePlaybooks(rows) satisfies Playbook[]) : undefined;
  }
  if (r.kind !== "doc") return undefined;
  if (ctx.role === "player" && ctx.playerId) {
    const me = rows.get(meRow(ctx.playerId)) as { player?: Player | null; evaluation?: unknown } | undefined;
    if (r.name === "roster") return mergePlayerRoster(rows.get("roster.public") as Roster | undefined, me?.player);
    if (r.name === "evaluation") return me?.evaluation;
  }
  const [row] = rowsOf(r.name, ctx.role, ctx.playerId);
  return row ? rows.get(row) : undefined;
}

function publish(logicalKeys: Iterable<string>) {
  for (const key of new Set(logicalKeys)) hooks?.set(key, decode(key));
}

function allLogicalKeys(ws: string): string[] {
  return [...DOCUMENTS.map((d) => `${d}.${ws}`), `playbooks.${ws}`];
}

// ── Reading from the server ────────────────────────────────────────────────

async function selectAll(columns: string): Promise<Row[]> {
  if (!sb || !ctx) return [];
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from("documents").select(columns).eq("workspace_id", ctx.workspaceId).order("key").range(from, from + PAGE - 1);
    // The coach's browser has no use for the rows derived for players.
    if (ctx.role === "coach") q = q.not("key", "like", "me:%").neq("key", "roster.public");
    const { data, error } = await q;
    if (error) throw error;
    const page = (data ?? []) as unknown as Row[];
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out;
}

function apply(fetched: Row[]) {
  if (!ctx) return;
  const touched: string[] = [];
  for (const row of fetched) {
    if (outbox[row.key]) continue; // A local change is on its way and wins.
    rows.set(row.key, row.value);
    sent.set(row.key, { value: row.value });
    versions.set(row.key, row.version);
    touched.push(...affected(row.key, ctx.role, ctx.playerId, ctx.workspaceId));
  }
  publish(touched);
}

function forget(keys: string[]) {
  if (!ctx) return;
  const touched: string[] = [];
  for (const key of keys) {
    if (outbox[key]) continue;
    rows.delete(key);
    sent.delete(key);
    versions.delete(key);
    touched.push(...affected(key, ctx.role, ctx.playerId, ctx.workspaceId));
  }
  publish(touched);
}

function scheduleFetch(key: string) {
  pendingFetch.add(key);
  if (fetchScheduled) return;
  fetchScheduled = true;
  const gen = generation;
  queueMicrotask(async () => {
    fetchScheduled = false;
    const keys = [...pendingFetch];
    pendingFetch.clear();
    if (!sb || !ctx || !keys.length) return;
    const { data, error } = await sb.from("documents").select("key,value,version").eq("workspace_id", ctx.workspaceId).in("key", keys);
    if (gen !== generation) return;
    if (error) {
      void catchUp();
      return;
    }
    const found = (data ?? []) as Row[];
    apply(found);
    const missing = keys.filter((k) => !found.some((r) => r.key === k));
    if (missing.length) forget(missing);
  });
}

/** After a gap (reconnect, back online, tab shown again): compare versions and pull what moved. */
async function catchUp() {
  if (!sb || !ctx) return;
  const gen = generation;
  try {
    const list = await selectAll("key,version");
    if (gen !== generation || !ctx) return;
    const onServer = new Set(list.map((r) => r.key));
    for (const r of list) {
      if (readsRow(r.key, ctx.role, ctx.playerId) && !outbox[r.key] && r.version > (versions.get(r.key) ?? 0)) scheduleFetch(r.key);
    }
    forget([...versions.keys()].filter((k) => !onServer.has(k)));
  } catch {
    // Still unreachable: the next reconnect tries again.
  }
}

function onDocSignal(payload: { key?: string; op?: string; version?: number | null; client?: string | null }) {
  if (!ctx || !payload.key) return;
  const row = payload.key;
  if (!readsRow(row, ctx.role, ctx.playerId)) return;
  if (payload.client && payload.client === clientId) return;
  if (outbox[row]) return;
  if (payload.op === "delete") {
    forget([row]);
    return;
  }
  if (payload.version && payload.version <= (versions.get(row) ?? 0)) return;
  scheduleFetch(row);
}

// ── Sending local changes ──────────────────────────────────────────────────

/** A screen wrote a logical key: work out the rows that changed and queue them. */
export function queue(logicalKey: string, value: unknown) {
  if (!ctx || ctx.role !== "coach") return;
  const r = route(logicalKey, ctx.workspaceId);
  let next: Rows;
  let owned: (row: string) => boolean;
  if (r.kind === "playbooks") {
    next = encodePlaybooks((value as Playbook[]) ?? []);
    owned = isPlaybookRow;
  } else if (r.kind === "doc") {
    next = new Map([[r.name, value]]);
    owned = (row) => row === r.name;
  } else {
    return;
  }
  const { upserts, deletes } = diffRows(next, sent, owned);
  let changed = false;
  // Rows back to what the server has: nothing to send any more.
  for (const row of next.keys()) {
    rows.set(row, next.get(row));
    if (!upserts.has(row) && outbox[row]) {
      delete outbox[row];
      changed = true;
    }
  }
  for (const [row, v] of upserts) {
    outbox[row] = { op: "upsert", value: v, base: outbox[row]?.base ?? versions.get(row) ?? 0, seq: ++seq };
    changed = true;
  }
  for (const row of deletes) {
    rows.delete(row);
    outbox[row] = { op: "delete", base: outbox[row]?.base ?? versions.get(row) ?? 0, seq: ++seq };
    changed = true;
  }
  // A row deleted earlier and now back unchanged is covered above; a pending delete of a row that
  // is no longer on the server needs nothing.
  if (!changed) return;
  saveOutbox(ctx.userId, ctx.workspaceId, outbox);
  scheduleFlush();
}

function scheduleFlush(delay?: number) {
  if (!hasPending()) {
    if (status === "saving") setStatus("saved");
    return;
  }
  const now = Date.now();
  if (!flushTimer) firstQueued = now;
  if (flushTimer) clearTimeout(flushTimer);
  const wait = delay ?? Math.max(0, Math.min(DEBOUNCE, firstQueued + MAX_WAIT - now));
  if (status !== "offline" && status !== "error") setStatus("saving");
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, wait);
}

type Failure = "network" | "auth" | "fatal";

function classify(error: { code?: string; message?: string } | null, httpStatus: number): Failure {
  if (httpStatus === 0 || (typeof navigator !== "undefined" && !navigator.onLine) || /fetch|network/i.test(error?.message ?? "")) return "network";
  if (httpStatus === 401 || error?.code === "PGRST301" || error?.code === "PGRST303") return "auth";
  return "fatal";
}

async function sendOnce(): Promise<Failure | null> {
  if (!sb || !ctx) return null;
  const snapshot = Object.entries(outbox);
  if (!snapshot.length) return null;
  const upserts = snapshot.filter(([, e]) => e.op === "upsert");
  const deletes = snapshot.filter(([, e]) => e.op === "delete");

  for (let i = 0; i < upserts.length; i += BATCH) {
    const chunk = upserts.slice(i, i + BATCH);
    const res = await sb
      .from("documents")
      .upsert(
        chunk.map(([key, e]) => ({ workspace_id: ctx!.workspaceId, key, value: e.value, client_id: clientId })),
        { onConflict: "workspace_id,key" },
      )
      .select("key,version");
    if (res.error) return classify(res.error, res.status);
    for (const r of (res.data ?? []) as Row[]) versions.set(r.key, r.version);
    for (const [key, e] of chunk) {
      sent.set(key, { value: e.value });
      if (outbox[key]?.seq === e.seq) delete outbox[key];
    }
  }
  if (deletes.length) {
    const keys = deletes.map(([key]) => key);
    const res = await sb.from("documents").delete().eq("workspace_id", ctx.workspaceId).in("key", keys);
    if (res.error) return classify(res.error, res.status);
    for (const [key, e] of deletes) {
      sent.delete(key);
      versions.delete(key);
      if (outbox[key]?.seq === e.seq) delete outbox[key];
    }
  }
  return null;
}

async function flush(): Promise<void> {
  if (flushing) return flushing;
  const gen = generation;
  flushing = (async () => {
    try {
      const failure = await sendOnce();
      if (gen !== generation || !ctx) return;
      saveOutbox(ctx.userId, ctx.workspaceId, outbox);
      if (!failure) {
        attempt = 0;
        if (hasPending()) scheduleFlush(0);
        else setStatus("saved");
        return;
      }
      if (failure === "fatal") {
        setStatus("error");
        return;
      }
      if (failure === "auth") await sb?.auth.refreshSession();
      else setStatus("offline");
      const wait = BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
      attempt++;
      scheduleFlush(wait);
    } catch {
      if (gen !== generation) return;
      setStatus("offline");
      scheduleFlush(BACKOFF[Math.min(attempt++, BACKOFF.length - 1)]);
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/** Sends everything queued now; resolves when the outbox is empty or sending failed. */
export async function flushNow(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  for (let i = 0; i < 5 && hasPending(); i++) {
    await flush();
    if (status === "offline" || status === "error") return;
  }
}

/** Tries again after an error the user can act on (the "Kaydedilemedi" pill). */
export function retry() {
  attempt = 0;
  if (hasPending()) scheduleFlush(0);
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

function listen(target: EventTarget, type: string, handler: EventListener) {
  target.addEventListener(type, handler);
  cleanups.push(() => target.removeEventListener(type, handler));
}

export async function startEngine(next: SyncContext, h: EngineHooks): Promise<void> {
  stopEngine();
  const gen = ++generation;
  ctx = next;
  hooks = h;
  sb = getSupabase();
  clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  setStatus("loading");

  for (let tries = 0; ; tries++) {
    try {
      const list = await selectAll("key,value,version");
      if (gen !== generation) return;
      for (const r of list) {
        rows.set(r.key, r.value);
        sent.set(r.key, { value: r.value });
        versions.set(r.key, r.version);
      }
      break;
    } catch {
      if (gen !== generation) return;
      setStatus("offline");
      await new Promise((resolve) => setTimeout(resolve, BACKOFF[Math.min(tries, BACKOFF.length - 1)]));
      if (gen !== generation) return;
    }
  }

  // Changes saved in this browser but never confirmed: reapply those still based on the server's version.
  if (next.role === "coach") {
    const saved = loadOutbox(next.userId, next.workspaceId);
    const { apply: keep, dropped: changedElsewhere } = replayPlan(saved, versions);
    // A change that reached the server just before the tab closed (no reply) is already there.
    const dropped = changedElsewhere.filter((row) => {
      const entry = saved[row];
      const landed = entry.op === "delete" ? !rows.has(row) : JSON.stringify(rows.get(row)) === JSON.stringify(entry.value);
      return !landed;
    });
    for (const row of keep) {
      const entry = saved[row];
      outbox[row] = { ...entry, seq: ++seq };
      if (entry.op === "upsert") rows.set(row, entry.value);
      else rows.delete(row);
    }
    if (dropped.length) h.dropped(dropped.length);
    saveOutbox(next.userId, next.workspaceId, outbox);
  }

  publish(allLogicalKeys(next.workspaceId));
  setStatus(hasPending() ? "saving" : "saved");
  h.ready();

  // Other devices' changes arrive as small signals on the team's private channel.
  await sb.realtime.setAuth();
  if (gen !== generation) return;
  let joined = false;
  channel = sb
    .channel(`ws:${next.workspaceId}`, { config: { private: true } })
    .on("broadcast", { event: "doc" }, (msg) => onDocSignal(msg.payload as Parameters<typeof onDocSignal>[0]))
    .on("broadcast", { event: "live" }, () => hooks?.signal("live"))
    .on("broadcast", { event: "access" }, () => hooks?.signal("access"))
    .subscribe((state) => {
      if (state === "SUBSCRIBED") {
        // Anything missed while the channel was down.
        if (joined) void catchUp();
        joined = true;
      }
    });

  if (typeof window !== "undefined") {
    listen(window, "online", () => {
      retry();
      void catchUp();
    });
    listen(document, "visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        lastVisible = Date.now();
        void flushNow();
      } else if (Date.now() - lastVisible > 30_000) {
        void catchUp();
      }
    });
    listen(window, "pagehide", () => void flushNow());
    listen(window, "beforeunload", ((e: BeforeUnloadEvent) => {
      // Only when changes may really be stuck; the outbox keeps them either way.
      if (hasPending() && (status === "offline" || status === "error")) e.preventDefault();
    }) as EventListener);
  }
  if (hasPending()) scheduleFlush(0);
}

export function stopEngine() {
  generation++;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (channel && sb) void sb.removeChannel(channel);
  channel = null;
  for (const off of cleanups.splice(0)) off();
  rows.clear();
  sent.clear();
  versions.clear();
  pendingFetch.clear();
  outbox = {};
  attempt = 0;
  ctx = null;
  hooks = null;
  status = "loading";
}
