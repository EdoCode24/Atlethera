import { NextResponse } from "next/server";
import type { SportId } from "@/domain/sports/types";
import { invitedPlayers, type Meeting } from "@/domain/team/meeting";
import type { Roster } from "@/domain/team/roster";
import { joinToken, livekitEnv } from "@/lib/livekit/server";
import { createSupabaseServer, currentUser } from "@/lib/supabase/server";

const STALE_MS = 8 * 60 * 60 * 1000;

/**
 * A join token for an open live meeting: members only, and a player only if the meeting is for
 * their position group (or the whole team). Every query runs as the user, under RLS.
 */
export async function POST(request: Request) {
  const noStore = { "Cache-Control": "no-store" };
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401, headers: noStore });
  const env = livekitEnv();
  if (!env) return NextResponse.json({ error: "not_configured" }, { status: 503, headers: noStore });
  const body = (await request.json().catch(() => null)) as { liveMeetingId?: string } | null;
  if (!body?.liveMeetingId) return NextResponse.json({ error: "bad_request" }, { status: 400, headers: noStore });

  const supabase = await createSupabaseServer();
  const { data: live } = await supabase.from("live_meetings").select("id, workspace_id, event_id, room, started_at, ended_at").eq("id", body.liveMeetingId).maybeSingle();
  if (!live || live.ended_at || Date.now() - new Date(live.started_at).getTime() > STALE_MS) {
    return NextResponse.json({ error: "not_live" }, { status: 409, headers: noStore });
  }
  const { data: member } = await supabase.from("memberships").select("role, player_id").eq("workspace_id", live.workspace_id).eq("user_id", user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });

  if (member.role === "player") {
    const [{ data: docs }, { data: ws }] = await Promise.all([
      supabase.from("documents").select("key, value").eq("workspace_id", live.workspace_id).in("key", ["meetings", "roster.public"]),
      supabase.from("workspaces").select("sport").eq("id", live.workspace_id).maybeSingle(),
    ]);
    const meetings = (docs?.find((d) => d.key === "meetings")?.value ?? {}) as Record<string, Meeting>;
    const roster = (docs?.find((d) => d.key === "roster.public")?.value ?? { players: [] }) as Roster;
    const groups = meetings[live.event_id]?.groups ?? [];
    const sport = (ws?.sport ?? null) as SportId | null;
    const invited = sport ? invitedPlayers(roster.players, groups, sport).some((p) => p.id === member.player_id) : groups.length === 0;
    if (!invited) return NextResponse.json({ error: "not_invited" }, { status: 403, headers: noStore });
    await supabase.rpc("record_meeting_join", { p_id: live.id });
  }

  const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
  const token = await joinToken(env, {
    room: live.room,
    identity: user.id,
    name: (profile?.name as string | undefined) || user.email || "",
    metadata: JSON.stringify({ role: member.role, playerId: member.player_id }),
    admin: member.role === "coach",
  });
  return NextResponse.json({ url: env.url, token }, { headers: noStore });
}
