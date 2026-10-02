import { NextResponse } from "next/server";
import { livekitEnv, roomService } from "@/lib/livekit/server";
import { createSupabaseServer, currentUser } from "@/lib/supabase/server";

/** The coach opens a meeting's live room (or rejoins the one already open). */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const env = livekitEnv();
  if (!env) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { workspaceId?: string; eventId?: string } | null;
  if (!body?.workspaceId || !body.eventId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = await createSupabaseServer();
  // The database checks the caller coaches this team and that the event is a meeting.
  const { data, error } = await supabase.rpc("start_live_meeting", { p_ws: body.workspaceId, p_event: body.eventId });
  if (error || !data) {
    const forbidden = error?.code === "42501";
    return NextResponse.json({ error: forbidden ? "forbidden" : error?.message.includes("not_a_meeting") ? "not_a_meeting" : "failed" }, { status: forbidden ? 403 : 400 });
  }
  const live = data as { id: string; room: string };
  try {
    await roomService(env).createRoom({ name: live.room, emptyTimeout: 600, maxParticipants: 60 });
  } catch {
    // Already open (a rejoin): joining creates it anyway.
  }
  return NextResponse.json({ liveMeetingId: live.id }, { headers: { "Cache-Control": "no-store" } });
}
