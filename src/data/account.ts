"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { SportId } from "@/domain/sports/types";
import { getSupabase } from "@/lib/supabase/client";
import { supabaseEnv } from "@/lib/supabase/env";
import { flushNow, setAccountResolved, startTeam, stopTeam } from "./store";

/**
 * Accounts on Supabase Auth. A user coaches their own team (workspace), and/or plays in teams
 * that invited them; the active one opens in the panel. Coaches edit, players only read.
 */

export type PackageId = "pt" | "coach";
export type Role = "coach" | "player";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Workspace {
  id: string;
  ownerId: string;
  package: PackageId;
  /** Chosen when the Coach package is set up; PT has none. */
  sport: SportId | null;
  name: string;
  createdAt: string;
}

export interface Membership {
  role: Role;
  /** The roster player a player account is linked to. */
  playerId: string | null;
  workspace: Workspace;
}

export interface AccountState {
  /** "unconfigured": the Supabase keys are missing from the environment. */
  status: "loading" | "signed-out" | "ready" | "unconfigured";
  user: User | null;
  workspace: Workspace | null;
  role: Role | null;
  playerId: string | null;
  memberships: Membership[];
  /** Coaches change things; players only look. */
  canEdit: boolean;
}

export const PASSWORD_MIN = 8;
const WS_COOKIE = "atl_ws";

const LOADING: AccountState = { status: "loading", user: null, workspace: null, role: null, playerId: null, memberships: [], canEdit: false };
const SIGNED_OUT: AccountState = { ...LOADING, status: "signed-out" };

let state: AccountState = LOADING;
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;
let listening = false;

function setState(next: AccountState) {
  state = next;
  for (const l of listeners) l();
}

interface WorkspaceRow {
  id: string;
  owner_id: string;
  package: PackageId;
  sport: string | null;
  name: string;
  created_at: string;
}

const toWorkspace = (w: WorkspaceRow): Workspace => ({
  id: w.id,
  ownerId: w.owner_id,
  package: w.package,
  sport: (w.sport as SportId | null) ?? null,
  name: w.name,
  createdAt: w.created_at,
});

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

async function load(): Promise<void> {
  if (!supabaseEnv()) {
    setState({ ...SIGNED_OUT, status: "unconfigured" });
    setAccountResolved(true);
    return;
  }
  const sb = getSupabase();
  for (let tries = 0; ; tries++) {
    const { data } = await sb.auth.getSession();
    const session = data.session;
    if (!session) {
      stopTeam();
      setState(SIGNED_OUT);
      setAccountResolved(true);
      return;
    }
    const uid = session.user.id;
    const [profile, memberships] = await Promise.all([
      sb.from("profiles").select("name").eq("id", uid).maybeSingle(),
      sb.from("memberships").select("role, player_id, created_at, workspace:workspaces(id, owner_id, package, sport, name, created_at)").eq("user_id", uid).order("created_at", { ascending: false }),
    ]);
    if (profile.error || memberships.error) {
      // Unreachable for now: try again shortly rather than showing the user as signed out.
      await new Promise((resolve) => setTimeout(resolve, Math.min(10000, 1000 * 2 ** tries)));
      continue;
    }
    const list: Membership[] = ((memberships.data ?? []) as unknown as { role: Role; player_id: string | null; workspace: WorkspaceRow | null }[])
      .filter((m) => m.workspace)
      .map((m) => ({ role: m.role, playerId: m.player_id, workspace: toWorkspace(m.workspace!) }));
    const preferred = readCookie(WS_COOKIE);
    const active = list.find((m) => m.workspace.id === preferred) ?? list.find((m) => m.role === "coach" && m.workspace.ownerId === uid) ?? list[0] ?? null;
    const email = session.user.email ?? "";
    const name = (profile.data?.name as string | undefined) || (session.user.user_metadata?.name as string | undefined) || email;
    setState({
      status: "ready",
      user: { id: uid, name, email },
      workspace: active?.workspace ?? null,
      role: active?.role ?? null,
      playerId: active?.playerId ?? null,
      memberships: list,
      canEdit: active?.role === "coach",
    });
    if (active) startTeam({ workspaceId: active.workspace.id, role: active.role, playerId: active.playerId, userId: uid });
    else stopTeam();
    setAccountResolved(true);
    return;
  }
}

/** Loads (or reloads) the account; concurrent calls share one load. */
export function reloadAccount(): Promise<void> {
  loading = load().finally(() => {
    loading = null;
  });
  return loading;
}

function ensureAccount() {
  if (typeof window === "undefined") return;
  if (!listening && supabaseEnv()) {
    listening = true;
    getSupabase().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        stopTeam();
        setState(SIGNED_OUT);
      } else if (event === "SIGNED_IN" && session && session.user.id !== state.user?.id && !loading) {
        // Signed in from another tab.
        void reloadAccount();
      }
    });
  }
  if (state.status === "loading" && !loading) void reloadAccount();
}

export function useAccount(): AccountState {
  useEffect(ensureAccount, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => LOADING,
  );
}

export function useCanEdit(): boolean {
  return useAccount().canEdit;
}

// ── Sign up, log in, log out ───────────────────────────────────────────────

const normalizeEmail = (email: string) => email.trim().toLocaleLowerCase("en-US");

export type SignUpError = "nameRequired" | "emailInvalid" | "passwordShort" | "emailTaken" | "failed";

export async function signUp(input: { name: string; email: string; password: string }): Promise<{ ok: true } | { ok: false; error: SignUpError }> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (!name) return { ok: false, error: "nameRequired" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "emailInvalid" };
  if (input.password.length < PASSWORD_MIN) return { ok: false, error: "passwordShort" };
  if (!supabaseEnv()) return { ok: false, error: "failed" };
  const { data, error } = await getSupabase().auth.signUp({ email, password: input.password, options: { data: { name } } });
  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists" || /already registered/i.test(error.message)) return { ok: false, error: "emailTaken" };
    if (error.code === "weak_password") return { ok: false, error: "passwordShort" };
    if (error.code === "email_address_invalid") return { ok: false, error: "emailInvalid" };
    return { ok: false, error: "failed" };
  }
  // With e-mail confirmation on there is no session yet; the project is set up with it off.
  if (!data.session) return { ok: false, error: "failed" };
  await reloadAccount();
  return { ok: true };
}

export async function logIn(input: { email: string; password: string }): Promise<{ ok: true } | { ok: false; error: "invalid" | "failed" }> {
  if (!supabaseEnv()) return { ok: false, error: "failed" };
  const { error } = await getSupabase().auth.signInWithPassword({ email: normalizeEmail(input.email), password: input.password });
  if (error) return { ok: false, error: error.code === "invalid_credentials" || error.status === 400 ? "invalid" : "failed" };
  await reloadAccount();
  return { ok: true };
}

export async function logOut(): Promise<void> {
  await flushNow();
  if (supabaseEnv()) await getSupabase().auth.signOut();
  stopTeam();
  setState(SIGNED_OUT);
}

// ── Teams ──────────────────────────────────────────────────────────────────

export async function createWorkspace(input: { package: PackageId; sport: SportId | null; name: string }): Promise<Workspace | null> {
  const { data, error } = await getSupabase().rpc("create_workspace", {
    p_package: input.package,
    p_sport: input.package === "coach" ? input.sport : null,
    p_name: input.name.trim(),
  });
  if (error || !data) return null;
  const workspace = toWorkspace(data as WorkspaceRow);
  writeCookie(WS_COOKIE, workspace.id);
  await reloadAccount();
  return workspace;
}

/** Opens another team the user belongs to. */
export async function switchWorkspace(workspaceId: string): Promise<void> {
  await flushNow();
  writeCookie(WS_COOKIE, workspaceId);
  await reloadAccount();
}
