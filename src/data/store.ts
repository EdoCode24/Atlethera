"use client";

import { useCallback, useSyncExternalStore } from "react";
import { activeContext, engineStatus, flushNow as engineFlush, queue, retry as engineRetry, startEngine, stopEngine, type Signal, type SyncContext, type SyncStatus } from "./sync/engine";
import { route } from "./sync/keys";

/**
 * The app's one storage layer. Screens and repositories read and write synchronously, as before;
 * behind it:
 * - the active team's data is a cache kept in sync with the server (src/data/sync/engine.ts);
 * - device preferences (print settings, editor hints) stay in this browser's localStorage.
 *
 * A player's browser is read-only: writes to team data are refused here as well as by the server.
 */

const PREFIX = "atlethera.v1.";
const listeners = new Set<() => void>();
/** Device-local values, read through from localStorage. */
const local = new Map<string, unknown>();
/** The active team's values, filled by the sync engine. */
const team = new Map<string, unknown>();

let accountResolved = false;
let teamReady = false;
let syncStatus: SyncStatus = "loading";
let droppedChanges = 0;
const signalListeners: Record<Signal, Set<() => void>> = { live: new Set(), access: new Set() };

function emit() {
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === null || e.key.startsWith(PREFIX)) {
      local.clear();
      emit();
    }
  });
}

const isTeamKey = (key: string) => route(key, activeContext()?.workspaceId ?? null).kind !== "local";

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  if (local.has(key)) return local.get(key) as T;
  let value = fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw !== null) value = JSON.parse(raw) as T;
  } catch {
    value = fallback;
  }
  local.set(key, value);
  return value;
}

export function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  if (isTeamKey(key)) return team.has(key) ? (team.get(key) as T) : fallback;
  return readLocal(key, fallback);
}

export function write<T>(key: string, value: T): void {
  if (isTeamKey(key)) {
    if (activeContext()?.role !== "coach") {
      if (process.env.NODE_ENV !== "production") console.error(`Read-only: a player's browser cannot change "${key}".`);
      return;
    }
    team.set(key, value);
    emit();
    queue(key, value);
    return;
  }
  local.set(key, value);
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked (private mode); the in-memory copy still works this session.
  }
  emit();
}

export function remove(key: string): void {
  local.delete(key);
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Ignore: nothing to remove.
  }
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Server render and hydration see `fallback`; the stored value arrives right after. */
export function useStored<T>(key: string, fallback: T): T {
  const get = useCallback(() => read(key, fallback), [key, fallback]);
  return useSyncExternalStore(subscribe, get, () => fallback);
}

/**
 * True once the account is known and, when there is a team, its data has loaded. Screens wait
 * for it so they never flash empty states or "not found" before the data arrives.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => accountResolved && (activeContext() === null || teamReady),
    () => false,
  );
}

// ── Team lifecycle (called by the account layer) ───────────────────────────

export function setAccountResolved(resolved: boolean) {
  if (accountResolved === resolved) return;
  accountResolved = resolved;
  emit();
}

/** Opens the team's data: load, then keep in sync until the account changes. */
export function startTeam(ctx: SyncContext) {
  const current = activeContext();
  if (current && current.workspaceId === ctx.workspaceId && current.userId === ctx.userId && current.role === ctx.role && current.playerId === ctx.playerId) return;
  team.clear();
  teamReady = false;
  droppedChanges = 0;
  void startEngine(ctx, {
    set: (key, value) => {
      if (value === undefined) team.delete(key);
      else team.set(key, value);
      emit();
    },
    ready: () => {
      teamReady = true;
      emit();
    },
    status: (s) => {
      syncStatus = s;
      emit();
    },
    signal: (kind) => {
      for (const l of signalListeners[kind]) l();
    },
    dropped: (count) => {
      droppedChanges = count;
      emit();
    },
  });
  emit();
}

export function stopTeam() {
  stopEngine();
  team.clear();
  teamReady = false;
  syncStatus = "loading";
  emit();
}

export async function flushNow(): Promise<void> {
  await engineFlush();
}

export function retrySync() {
  engineRetry();
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    subscribe,
    () => (activeContext() ? syncStatus : "saved"),
    () => "saved",
  );
}

/** Offline changes that were not applied because the data changed on another device. */
export function useDroppedChanges(): number {
  return useSyncExternalStore(
    subscribe,
    () => droppedChanges,
    () => 0,
  );
}

export function dismissDroppedChanges() {
  droppedChanges = 0;
  emit();
}

/** Runs `listener` when the server signals a change of that kind (live meetings, team access). */
export function onSignal(kind: Signal, listener: () => void): () => void {
  signalListeners[kind].add(listener);
  return () => signalListeners[kind].delete(listener);
}

export { engineStatus };
export type { SyncStatus };
