"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { flushNow, onSignal } from "./store";

/** Live meetings of the team: which calendar meetings have an open room right now. */

export interface LiveMeeting {
  id: string;
  eventId: string;
  startedAt: string;
}

/** A session nobody ended counts as over after this long. */
const STALE_MS = 8 * 60 * 60 * 1000;

export function useLiveMeetings(workspaceId: string | undefined): { live: Record<string, LiveMeeting>; loaded: boolean } {
  const [live, setLive] = useState<Record<string, LiveMeeting>>({});
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void (async () => {
      const since = new Date(Date.now() - STALE_MS).toISOString();
      const { data, error } = await getSupabase().from("live_meetings").select("id, event_id, started_at").eq("workspace_id", workspaceId).is("ended_at", null).gt("started_at", since);
      if (cancelled || error) return;
      setLive(Object.fromEntries((data ?? []).map((m) => [m.event_id as string, { id: m.id as string, eventId: m.event_id as string, startedAt: m.started_at as string }])));
      setLoaded(true);
    })();
    const off = onSignal("live", refresh);
    return () => {
      cancelled = true;
      off();
    };
  }, [workspaceId, version, refresh]);

  return { live, loaded };
}

async function post<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "failed" };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Opens (or reopens) the meeting's live room. The meeting must have reached the server first. */
export async function startLive(workspaceId: string, eventId: string) {
  await flushNow();
  return post<{ liveMeetingId: string }>("/api/live/start", { workspaceId, eventId });
}

export function endLive(liveMeetingId: string) {
  return post<{ ok: true }>("/api/live/end", { liveMeetingId });
}

export function liveToken(liveMeetingId: string) {
  return post<{ url: string; token: string }>("/api/live/token", { liveMeetingId });
}

/** Players who joined a live session (for the coach's attendance). */
export async function meetingJoins(liveMeetingId: string): Promise<string[]> {
  const { data } = await getSupabase().from("meeting_joins").select("player_id").eq("live_meeting_id", liveMeetingId);
  return (data ?? []).map((j) => j.player_id as string | null).filter((id): id is string => !!id);
}
