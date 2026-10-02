"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { flushNow, onSignal } from "./store";

/**
 * Who on the roster can open the panel: players with a linked account, players with an invite
 * link waiting, and the rest. Coach only (the server lets no one else see invites or members).
 */

export type Access =
  | { state: "none" }
  | { state: "pending"; token: string; expiresAt: string }
  | { state: "linked"; userId: string; name: string; since: string };

export type TeamAccess = Record<string, Access>;

export function useTeamAccess(workspaceId: string | undefined, enabled: boolean): { access: TeamAccess; refresh: () => void } {
  const [access, setAccess] = useState<TeamAccess>({});
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!workspaceId || !enabled) return;
    let cancelled = false;
    const sb = getSupabase();
    void (async () => {
      const now = new Date().toISOString();
      const [invites, members] = await Promise.all([
        sb.from("invites").select("token, player_id, expires_at").eq("workspace_id", workspaceId).is("used_at", null).is("revoked_at", null).gt("expires_at", now),
        sb.from("memberships").select("user_id, player_id, created_at").eq("workspace_id", workspaceId).eq("role", "player"),
      ]);
      if (cancelled || invites.error || members.error) return;
      const ids = (members.data ?? []).map((m) => m.user_id as string);
      const profiles = ids.length ? await sb.from("profiles").select("id, name").in("id", ids) : { data: [] as { id: string; name: string }[] };
      if (cancelled) return;
      const names = new Map((profiles.data ?? []).map((p) => [p.id as string, p.name as string]));
      const next: TeamAccess = {};
      for (const i of invites.data ?? []) next[i.player_id as string] = { state: "pending", token: i.token as string, expiresAt: i.expires_at as string };
      for (const m of members.data ?? []) {
        next[m.player_id as string] = { state: "linked", userId: m.user_id as string, name: names.get(m.user_id as string) ?? "", since: m.created_at as string };
      }
      setAccess(next);
    })();
    // A player accepting, or another coach tab creating a link, shows up right away.
    const off = onSignal("access", refresh);
    return () => {
      cancelled = true;
      off();
    };
  }, [workspaceId, enabled, version, refresh]);

  return { access, refresh };
}

export type InviteError = "player_not_found" | "player_linked" | "failed";

/** A new invite link for a roster player (any open one is revoked). */
export async function createInvite(workspaceId: string, playerId: string): Promise<{ ok: true; token: string } | { ok: false; error: InviteError }> {
  // The server checks the player is on the roster: make sure a just-added player has reached it.
  await flushNow();
  const { data, error } = await getSupabase().rpc("create_invite", { p_ws: workspaceId, p_player: playerId });
  if (error || typeof data !== "string") {
    const message = error?.message ?? "";
    return { ok: false, error: message.includes("player_not_found") ? "player_not_found" : message.includes("player_linked") ? "player_linked" : "failed" };
  }
  return { ok: true, token: data };
}

export async function revokeInvite(token: string): Promise<boolean> {
  const { error } = await getSupabase().rpc("revoke_invite", { p_token: token });
  return !error;
}

/** Takes a player's account off the team; their roster record stays. */
export async function removeAccess(workspaceId: string, userId: string): Promise<boolean> {
  const { error } = await getSupabase().from("memberships").delete().eq("workspace_id", workspaceId).eq("user_id", userId).eq("role", "player");
  return !error;
}

export function inviteUrl(origin: string, locale: string, token: string): string {
  return `${origin}/${locale}/join/${token}`;
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// ── Joining ────────────────────────────────────────────────────────────────

export type InviteStatus = "open" | "mine" | "used" | "expired" | "revoked";

export interface InviteInfo {
  team: string;
  sport: string | null;
  firstName: string | null;
  lastInitial: string | null;
  jersey: number | null;
  status: InviteStatus;
}

export async function inviteInfo(token: string): Promise<InviteInfo | null> {
  const { data, error } = await getSupabase().rpc("invite_info", { p_token: token });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) return null;
  return { team: row.team, sport: row.sport, firstName: row.first_name, lastInitial: row.last_initial, jersey: row.jersey, status: row.status };
}

export type AcceptError = "invite_invalid" | "invite_used" | "invite_expired" | "already_member" | "player_taken" | "failed";

export async function acceptInvite(token: string): Promise<{ ok: true; workspaceId: string } | { ok: false; error: AcceptError }> {
  const { data, error } = await getSupabase().rpc("accept_invite", { p_token: token });
  if (error || typeof data !== "string") {
    const message = error?.message ?? "";
    const known: AcceptError[] = ["invite_invalid", "invite_used", "invite_expired", "already_member", "player_taken"];
    return { ok: false, error: known.find((k) => message.includes(k)) ?? "failed" };
  }
  return { ok: true, workspaceId: data };
}
